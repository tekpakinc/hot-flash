(() => {
  const nav = document.querySelector('.site-header nav');
  if (!nav) return;

  const links = [
    ['feed.html', 'Discover'],
    ['events.html', 'Events'],
    ['messages.html', 'Messages'],
    ['notifications.html', 'Notifications'],
    ['dashboard.html', 'My Garage'],
    ['settings.html', 'Settings'],
  ];

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const existing = new Map(
    [...nav.querySelectorAll('a[href]')].map((link) => [link.getAttribute('href').split('?')[0], link])
  );

  for (const [href, label] of links) {
    let link = existing.get(href);
    if (!link) {
      link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      nav.appendChild(link);
      existing.set(href, link);
    }
    link.classList.toggle('active', currentPage === href);
  }

  const syncAuthNavigation = async () => {
    if (!window.hotflashSupabase) return;

    const { data } = await window.hotflashSupabase.auth.getSession();
    const signedIn = Boolean(data?.session);

    nav.querySelectorAll('a[href="login.html"], a[href="signup.html"]').forEach((link) => {
      link.hidden = signedIn;
    });

    let logout = nav.querySelector('[data-shared-logout]');
    if (signedIn && !nav.querySelector('[data-logout]') && !logout) {
      logout = document.createElement('button');
      logout.type = 'button';
      logout.dataset.sharedLogout = '';
      logout.textContent = 'Logout';
      logout.addEventListener('click', async () => {
        logout.disabled = true;
        await window.hotflashSupabase.auth.signOut();
        window.location.href = 'index.html';
      });
      nav.appendChild(logout);
    }

    if (!signedIn) {
      logout?.remove();
      if (!nav.querySelector('a[href="login.html"]')) {
        const login = document.createElement('a');
        login.href = 'login.html';
        login.textContent = 'Login';
        nav.appendChild(login);
      }
    }
  };

  syncAuthNavigation().catch((error) => console.warn('[Hot Flash navigation]', error));
})();
