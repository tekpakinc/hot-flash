document.addEventListener('DOMContentLoaded', async () => {
  const consoleRoot = document.querySelector('[data-admin-console]');
  const resultRoot = document.querySelector('[data-admin-result]');
  const status = document.querySelector('[data-admin-status]');
  if (!consoleRoot || !window.hotflashSupabase) return;

  const lock = () => {
    consoleRoot.hidden = true;
    if (resultRoot) resultRoot.hidden = true;
    document.querySelectorAll('[data-admin-console] button,[data-admin-console] input,[data-admin-console] select,[data-admin-result] button,[data-admin-result] a').forEach((control) => {
      if ('disabled' in control) control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
    });
  };
  lock();

  window.hotFlashRequireAdmin = async () => {
    const session = window.hotFlashGetStableSession
      ? await window.hotFlashGetStableSession()
      : (await window.hotflashSupabase.auth.getSession()).data.session;
    if (!session) throw new Error('Your admin session expired. Please sign in again.');
    const { data, error } = await window.hotflashSupabase.rpc('is_hotflash_admin');
    if (error || !data) throw new Error('Admin access could not be verified.');
    return session;
  };

  try {
    await window.hotFlashRequireAdmin();
    consoleRoot.hidden = false;
    consoleRoot.querySelectorAll('button,input,select').forEach((control) => {
      control.disabled = false;
      control.removeAttribute('aria-disabled');
    });
  } catch (error) {
    lock();
    if (status) {
      status.textContent = error.message || 'Admin access denied.';
      status.className = 'small-muted error';
    }
  }
});