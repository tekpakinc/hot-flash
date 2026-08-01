(() => {
  const nav = document.querySelector('.site-header nav');
  if (!nav) return;

  const links = [
    ['feed.html', 'Discover'],
    ['hoon.html', 'Hoon Pad'],
    ['events.html', 'Events'],
    ['shops.html', 'Shops'],
    ['messages.html', 'Messages'],
    ['notifications.html', 'Notifications'],
    ['dashboard.html', 'My Garage'],
    ['settings.html', 'Settings'],
  ];

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const existing = new Map([...nav.querySelectorAll('a[href]')].map((link) => [link.getAttribute('href').split('?')[0], link]));

  for (const [href, label] of links) {
    let link = existing.get(href);
    if (!link) {
      link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      nav.appendChild(link);
      existing.set(href, link);
    }
    const active = currentPage === href;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  const getSession = async () => window.hotFlashGetStableSession
    ? window.hotFlashGetStableSession()
    : (await window.hotflashSupabase.auth.getSession()).data.session;

  const syncAuthNavigation = async () => {
    if (!window.hotflashSupabase) return;
    const session = await getSession();
    const signedIn = Boolean(session);

    nav.querySelectorAll('a[href="login.html"], a[href="signup.html"]').forEach((link) => { link.hidden = signedIn; });
    nav.querySelectorAll('a[href="dashboard.html"], a[href="messages.html"], a[href="notifications.html"], a[href="settings.html"]').forEach((link) => { link.hidden = !signedIn; });

    let logout = nav.querySelector('[data-shared-logout]');
    if (signedIn && !nav.querySelector('[data-logout]') && !logout) {
      logout = document.createElement('button');
      logout.type = 'button';
      logout.dataset.sharedLogout = '';
      logout.textContent = 'Logout';
      logout.addEventListener('click', async () => {
        if (logout.disabled) return;
        logout.disabled = true;
        logout.textContent = 'Logging out…';
        const { error } = await window.hotflashSupabase.auth.signOut();
        if (error) {
          logout.disabled = false;
          logout.textContent = 'Logout';
          console.warn('[Hot Flash logout]', error);
          return;
        }
        window.location.replace('index.html');
      });
      nav.appendChild(logout);
    }

    if (!signedIn) {
      logout?.remove();
      if (!nav.querySelector('a[href="login.html"]')) {
        const login = document.createElement('a');
        login.href = `login.html?returnTo=${encodeURIComponent(location.pathname + location.search)}`;
        login.textContent = 'Login';
        nav.appendChild(login);
      }
    }
  };

  syncAuthNavigation().catch((error) => console.warn('[Hot Flash navigation]', error));
  window.hotflashSupabase?.auth?.onAuthStateChange?.(() => syncAuthNavigation().catch((error) => console.warn('[Hot Flash navigation sync]', error)));
})();