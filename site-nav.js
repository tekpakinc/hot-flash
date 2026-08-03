(() => {
  const nav = document.querySelector('.site-header nav');
  if (!nav) return;

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const getSession = async () => window.hotFlashGetStableSession
    ? window.hotFlashGetStableSession()
    : window.hotflashSupabase
      ? (await window.hotflashSupabase.auth.getSession()).data.session
      : null;

  const link = (href, label) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (currentPage === href) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
    return a;
  };

  async function renderNavigation() {
    const session = await getSession();
    nav.replaceChildren();

    const publicLinks = [
      ['feed.html', 'Discover'],
      ['hoon.html', 'Hoon Pad'],
      ['events.html', 'Events'],
      ['shops.html', 'Shops'],
      ['pricing.html', 'Memberships'],
    ];
    publicLinks.forEach(([href, label]) => nav.appendChild(link(href, label)));

    if (session) {
      [
        ['messages.html', 'Messages'],
        ['notifications.html', 'Notifications'],
        ['dashboard.html', 'My Garage'],
        ['settings.html', 'Settings'],
      ].forEach(([href, label]) => nav.appendChild(link(href, label)));

      const logout = document.createElement('button');
      logout.type = 'button';
      logout.dataset.sharedLogout = '';
      logout.textContent = 'Logout';
      logout.addEventListener('click', async () => {
        if (logout.disabled || !window.hotflashSupabase) return;
        logout.disabled = true;
        logout.textContent = 'Logging out…';
        const { error } = await window.hotflashSupabase.auth.signOut();
        if (error) {
          logout.disabled = false;
          logout.textContent = 'Logout';
          return;
        }
        window.location.replace('index.html');
      });
      nav.appendChild(logout);
    } else {
      nav.appendChild(link(`login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`, 'Login'));
      nav.appendChild(link('signup.html', 'Sign Up'));
    }
  }

  renderNavigation().catch((error) => console.warn('[Hot Flash navigation]', error));
  window.hotflashSupabase?.auth?.onAuthStateChange?.(() => renderNavigation().catch((error) => console.warn('[Hot Flash navigation sync]', error)));

  if (!document.querySelector('script[data-permission-gates]')) {
    const gates = document.createElement('script');
    gates.src = 'permission-gates.js?v=1';
    gates.dataset.permissionGates = '';
    document.body.appendChild(gates);
  }

  if (document.body?.classList.contains('shop-page') && !document.querySelector('script[data-shop-pro-state]')) {
    const proState = document.createElement('script');
    proState.src = 'shop-pro-state.js?v=1';
    proState.dataset.shopProState = '';
    document.body.appendChild(proState);
  }

  if (document.body?.dataset?.page === 'vehicle') {
    const scripts = [
      ['vehicle-permission-guard.js?v=1', 'vehiclePermissionGuard'],
      ['vehicle-upload-compat.js?v=1', 'vehicleUploadCompat'],
      ['vehicle-photo-manager.js?v=1', 'vehiclePhotoManager'],
      ['vehicle-stock-specs.js?v=1', 'vehicleStockSpecs'],
    ];
    scripts.forEach(([src, datasetName]) => {
      if (document.querySelector(`script[data-${datasetName.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}]`)) return;
      const script = document.createElement('script');
      script.src = src;
      script.dataset[datasetName] = '';
      document.body.appendChild(script);
    });
  }
})();