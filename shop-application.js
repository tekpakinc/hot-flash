document.addEventListener('DOMContentLoaded', async () => {
  const form = document.querySelector('[data-shop-application]');
  const status = document.querySelector('[data-shop-status]');
  if (!form) return;
  const session = window.hotFlashGetStableSession ? await window.hotFlashGetStableSession() : (await hotflashSupabase.auth.getSession()).data.session;
  if (!session) {
    status.textContent = 'Log in to submit a shop application.';
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const active = window.hotFlashGetStableSession ? await window.hotFlashGetStableSession() : (await hotflashSupabase.auth.getSession()).data.session;
    if (!active) {
      location.href = `login.html?returnTo=${encodeURIComponent('shop-application.html')}`;
      return;
    }
    status.textContent = 'Submitting application…';
    const fd = new FormData(form);
    const slug = String(fd.get('name') || '').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70);
    const { error } = await hotflashSupabase.from('shop_profiles').upsert({
      owner_id: active.user.id,
      name: fd.get('name'),
      slug: `${slug}-${active.user.id.slice(0,6)}`,
      email: fd.get('email'),
      phone: fd.get('phone') || null,
      website_url: fd.get('website_url') || null,
      city: fd.get('city'),
      state_region: fd.get('state_region'),
      description: fd.get('description'),
      supports_e_tuning: Boolean(fd.get('supports_e_tuning')),
      status: 'pending_review',
    }, { onConflict: 'owner_id' });
    if (error) { console.error(error); status.textContent = 'Could not submit the application.'; return; }
    status.textContent = 'Application received. We’ll show review and activation status in your member area.';
    form.querySelector('button[type="submit"]').disabled = true;
  });
});