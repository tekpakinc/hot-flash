document.addEventListener('DOMContentLoaded', async () => {
  const dashboard = document.querySelector('[data-shop-dashboard]');
  if (!dashboard || !window.hotflashSupabase) return;

  const profilePanel = document.querySelector('[data-shop-panel="profile"]');
  const staffPanel = document.querySelector('[data-shop-panel="staff"]');
  const stewardPanel = document.querySelector('[data-shop-panel="steward"]');
  const profileTab = document.querySelector('[data-shop-tab="profile"]');
  const staffTab = document.querySelector('[data-shop-tab="staff"]');
  const stewardTab = document.querySelector('[data-shop-tab="steward"]');

  const lock = (element) => {
    if (!element) return;
    element.hidden = true;
    element.querySelectorAll('button,input,select,textarea').forEach((control) => { control.disabled = true; });
  };
  const unlock = (element) => {
    if (!element) return;
    element.hidden = false;
    element.querySelectorAll('button,input,select,textarea').forEach((control) => { control.disabled = false; });
  };

  [dashboard, profilePanel, staffPanel, stewardPanel].forEach(lock);
  [profileTab, staffTab, stewardTab].forEach((button) => { if (button) button.disabled = true; });

  try {
    const slug = new URLSearchParams(location.search).get('s');
    if (!slug) return;
    const session = window.hotFlashGetStableSession
      ? await window.hotFlashGetStableSession()
      : (await window.hotflashSupabase.auth.getSession()).data.session;
    if (!session) return;

    const { data: shop } = await window.hotflashSupabase.from('shops').select('id').eq('slug', slug).maybeSingle();
    if (!shop) return;
    const { data: membership } = await window.hotflashSupabase.from('shop_members').select('role,status').eq('shop_id', shop.id).eq('user_id', session.user.id).eq('status', 'active').maybeSingle();
    if (!membership) return;

    const role = membership.role;
    unlock(dashboard);

    if (role === 'owner' || role === 'manager') {
      unlock(profilePanel);
      if (profileTab) profileTab.disabled = false;
    } else if (profileTab) {
      profileTab.hidden = true;
    }

    if (role === 'owner') {
      unlock(staffPanel);
      if (staffTab) staffTab.disabled = false;
    } else if (staffTab) {
      staffTab.hidden = true;
    }

    if (role === 'owner' || role === 'manager' || role === 'event_staff') {
      unlock(stewardPanel);
      if (stewardTab) stewardTab.disabled = false;
    }
  } catch (error) {
    console.warn('[Hot Flash shop role guard]', error);
    [dashboard, profilePanel, staffPanel, stewardPanel].forEach(lock);
  }
});