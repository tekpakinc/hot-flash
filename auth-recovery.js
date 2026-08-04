const recoveryRequestForm = document.querySelector('[data-recovery-request-form]');
const passwordUpdateForm = document.querySelector('[data-password-update-form]');
const recoveryStatus = document.querySelector('[data-auth-status]');
let recoveryReady = false;
let preparingRecovery = false;

function setRecoveryStatus(message, type = '') {
  if (!recoveryStatus) return;
  recoveryStatus.textContent = message;
  recoveryStatus.className = type;
}

function recoveryFriendlyError(error, context = 'general') {
  if (typeof window.hotFlashFriendlyError === 'function') {
    return window.hotFlashFriendlyError(error, context);
  }
  console.error(`[Hot Flash ${context} error]`, error);
  return 'Something went wrong. Please try again.';
}

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function getRecoverySession() {
  // Supabase may already be automatically exchanging the PKCE code because
  // detectSessionInUrl is enabled. Give that exchange a moment to finish.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await hotflashSupabase.auth.getSession();
    if (error) console.warn('[Hot Flash recovery session check]', error);
    if (data?.session) return data.session;
    if (attempt < 5) await sleep(250);
  }

  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (code) {
    const { data, error } = await hotflashSupabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (data?.session) return data.session;
  }

  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  if (tokenHash && type === 'recovery') {
    const { data, error } = await hotflashSupabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery'
    });
    if (error) throw error;
    if (data?.session) return data.session;
  }

  return null;
}

function cleanRecoveryUrl() {
  const url = new URL(window.location.href);
  ['code', 'token_hash', 'type', 'error', 'error_code', 'error_description'].forEach((key) => url.searchParams.delete(key));
  if (url.hash) url.hash = '';
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

recoveryRequestForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = recoveryRequestForm.querySelector('button[type="submit"]');
  const form = new FormData(recoveryRequestForm);
  const email = String(form.get('email') || '').trim();

  if (!email) {
    setRecoveryStatus('Enter the email address used for your Hot Flash account.', 'error');
    return;
  }

  if (submitButton) submitButton.disabled = true;
  setRecoveryStatus('Sending your reset link…');

  try {
    const redirectTo = new URL('update-password.html', window.location.origin + window.location.pathname).toString();
    const { error } = await hotflashSupabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    recoveryRequestForm.reset();
    setRecoveryStatus('Check your email for a password-reset link. Open it in the same browser where you requested it.', 'success');
  } catch (error) {
    setRecoveryStatus(recoveryFriendlyError(error, 'password reset'), 'error');
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

async function preparePasswordUpdate() {
  if (!passwordUpdateForm || preparingRecovery || recoveryReady) return;
  preparingRecovery = true;
  const submitButton = passwordUpdateForm.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  setRecoveryStatus('Checking your reset link…');

  try {
    const session = await getRecoverySession();
    if (!session) {
      const params = new URLSearchParams(location.search);
      const message = params.get('error_description');
      setRecoveryStatus(message || 'This reset link could not be verified. Request a new link and open it in the same browser where it was requested.', 'error');
      return;
    }

    recoveryReady = true;
    cleanRecoveryUrl();
    if (submitButton) submitButton.disabled = false;
    setRecoveryStatus('Choose a new password for your account.');
  } catch (error) {
    console.error('[Hot Flash password recovery]', error);
    const code = error?.code || '';
    const sameBrowserHint = ['bad_code_verifier', 'flow_state_not_found', 'flow_state_expired'].includes(code)
      ? ' Request a fresh link and open it in the same browser and device where you requested it.'
      : '';
    setRecoveryStatus(`${recoveryFriendlyError(error, 'password recovery')}${sameBrowserHint}`, 'error');
  } finally {
    preparingRecovery = false;
  }
}

passwordUpdateForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = passwordUpdateForm.querySelector('button[type="submit"]');
  const form = new FormData(passwordUpdateForm);
  const password = String(form.get('password') || '');
  const confirmation = String(form.get('password_confirmation') || '');

  if (!recoveryReady) {
    setRecoveryStatus('The recovery session is not ready. Please reopen the newest reset link.', 'error');
    return;
  }
  if (password.length < 8) {
    setRecoveryStatus('Use at least 8 characters for your new password.', 'error');
    return;
  }
  if (password !== confirmation) {
    setRecoveryStatus('Those passwords do not match.', 'error');
    return;
  }

  if (submitButton) submitButton.disabled = true;
  setRecoveryStatus('Updating your password…');

  try {
    const { error } = await hotflashSupabase.auth.updateUser({ password });
    if (error) throw error;
    passwordUpdateForm.reset();
    setRecoveryStatus('Password updated. Taking you back to login…', 'success');
    await hotflashSupabase.auth.signOut();
    window.setTimeout(() => { window.location.href = 'login.html'; }, 1000);
  } catch (error) {
    setRecoveryStatus(recoveryFriendlyError(error, 'password update'), 'error');
    if (submitButton) submitButton.disabled = false;
  }
});

hotflashSupabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') preparePasswordUpdate();
});

preparePasswordUpdate();
