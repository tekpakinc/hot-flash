const enhancedSignupForm = document.querySelector('[data-signup-form]');

function hfSlugify(value) {
  return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function hfSignupStatus(message, type = '') {
  const el = document.querySelector('[data-auth-status]');
  if (!el) return;
  el.textContent = message;
  el.className = `small-muted ${type}`.trim();
}

function hfSavePendingProfile(profile) {
  try {
    sessionStorage.setItem('hotflash_pending_profile', JSON.stringify(profile));
    sessionStorage.setItem('hotflash_pending_email', profile.email);
    sessionStorage.setItem('hotflash_confirmation_sent_at', String(Date.now()));
  } catch (error) {
    console.warn('[Hot Flash pending signup storage unavailable]', error);
  }
}

if (enhancedSignupForm) {
  enhancedSignupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const button = enhancedSignupForm.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    hfSignupStatus('Creating your Hot Flash account…');

    const form = new FormData(enhancedSignupForm);
    const email = String(form.get('email') || '').trim().toLowerCase();
    const password = String(form.get('password') || '');
    const username = hfSlugify(form.get('username'));
    const displayName = String(form.get('display_name') || '').trim();
    const pendingProfile = { username, display_name: displayName, email, bio: '' };

    try {
      if (!username) throw new Error('Please choose a username using letters or numbers.');
      if (password.length < 8) throw new Error('Please choose a stronger password with at least 8 characters.');

      const confirmationPage = new URL('signup-success.html', window.location.href);
      confirmationPage.searchParams.set('verified', '1');

      const { data, error } = await hotflashSupabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, display_name: displayName },
          emailRedirectTo: confirmationPage.toString(),
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Account creation returned no user.');

      // Supabase may intentionally return an obfuscated user for an existing email
      // when email confirmation is enabled. An empty identities array means no new
      // account or confirmation email was created, so do not show a false success.
      if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('An account already exists with that email. Try signing in instead.');
      }

      hfSavePendingProfile(pendingProfile);

      const { error: profileError } = await hotflashSupabase.from('profiles').upsert({
        id: data.user.id,
        ...pendingProfile,
      });
      if (profileError) {
        // This is expected on projects whose RLS requires an authenticated session.
        // The profile metadata remains on the auth user and in session storage so it
        // can be completed after email verification and first login.
        console.warn('[Hot Flash profile setup deferred until verification]', profileError);
      }

      if (data.session) {
        window.location.href = 'signup-success.html?verified=1';
      } else {
        window.location.href = `signup-success.html?email=${encodeURIComponent(email)}`;
      }
    } catch (error) {
      const friendly = typeof window.hotFlashFriendlyError === 'function'
        ? window.hotFlashFriendlyError(error, 'signup')
        : (error?.message || 'Something went wrong. Please try again.');
      hfSignupStatus(friendly, 'error');
      if (button) button.disabled = false;
    }
  }, true);
}