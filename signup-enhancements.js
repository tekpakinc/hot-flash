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

if (enhancedSignupForm) {
  enhancedSignupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const button = enhancedSignupForm.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    hfSignupStatus('Creating your Hot Flash account…');

    const form = new FormData(enhancedSignupForm);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const username = hfSlugify(form.get('username'));
    const displayName = String(form.get('display_name') || '').trim();

    try {
      if (!username) throw new Error('Please choose a username using letters or numbers.');

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

      const { error: profileError } = await hotflashSupabase.from('profiles').upsert({
        id: data.user.id,
        username,
        display_name: displayName,
        email,
        bio: '',
      });
      if (profileError) console.error('[Hot Flash profile setup warning]', profileError);

      sessionStorage.setItem('hotflash_pending_email', email);
      sessionStorage.setItem('hotflash_confirmation_sent_at', String(Date.now()));

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
