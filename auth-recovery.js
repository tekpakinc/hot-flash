const recoveryRequestForm = document.querySelector('[data-recovery-request-form]');
const passwordUpdateForm = document.querySelector('[data-password-update-form]');
const recoveryStatus = document.querySelector('[data-auth-status]');

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
    const redirectTo = new URL('update-password.html', window.location.href).toString();
    const { error } = await hotflashSupabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    recoveryRequestForm.reset();
    setRecoveryStatus('Check your email for a password-reset link. It may take a minute to arrive.', 'success');
  } catch (error) {
    setRecoveryStatus(recoveryFriendlyError(error, 'password reset'), 'error');
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

async function preparePasswordUpdate() {
  if (!passwordUpdateForm) return;
  const submitButton = passwordUpdateForm.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  setRecoveryStatus('Checking your reset link…');

  try {
    const { data, error } = await hotflashSupabase.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      setRecoveryStatus('This reset link is invalid or has expired. Request a new one.', 'error');
      return;
    }
    if (submitButton) submitButton.disabled = false;
    setRecoveryStatus('Choose a new password for your account.');
  } catch (error) {
    setRecoveryStatus(recoveryFriendlyError(error, 'password recovery'), 'error');
  }
}

passwordUpdateForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = passwordUpdateForm.querySelector('button[type="submit"]');
  const form = new FormData(passwordUpdateForm);
  const password = String(form.get('password') || '');
  const confirmation = String(form.get('password_confirmation') || '');

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
  if (event === 'PASSWORD_RECOVERY') preparePasswordUpdate();
});

preparePasswordUpdate();
