(() => {
  if (!window.hotflashSupabase || document.body?.dataset?.page === 'beta-feedback') return;

  async function init() {
    const session = await (window.hotFlashGetStableSession ? window.hotFlashGetStableSession() : hotflashSupabase.auth.getSession().then(r => r.data.session));
    if (!session) return;
    const { data } = await hotflashSupabase
      .from('beta_testers')
      .select('is_active')
      .eq('user_id', session.user.id)
      .eq('is_active', true)
      .maybeSingle();
    if (!data) return;

    const style = document.createElement('style');
    style.textContent = `.hf-beta-feedback-button{position:fixed;right:14px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:9998;width:46px;height:46px;border:1px solid rgba(166,255,0,.65);border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,#151b23,#080b10);color:#a6ff00;text-decoration:none;font-size:21px;box-shadow:0 8px 24px rgba(0,0,0,.45),0 0 16px rgba(166,255,0,.15)}.hf-beta-feedback-button:active{transform:scale(.96)}`;
    document.head.appendChild(style);

    const link = document.createElement('a');
    link.className = 'hf-beta-feedback-button';
    link.href = `beta-feedback.html?from=${encodeURIComponent(location.href)}`;
    link.setAttribute('aria-label', 'Send beta feedback');
    link.title = 'Send beta feedback';
    link.textContent = '⚠';
    document.body.appendChild(link);
  }

  init().catch(error => console.warn('[Beta feedback widget]', error));
})();