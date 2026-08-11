(() => {
  const VERSION_KEY = 'hotflash-app-version';
  const REFRESH_KEY = 'hotflash-version-refresh';
  const INSTALL_DISMISSED_KEY = 'hotflash-pwa-install-dismissed-at';
  const INSTALL_DISMISS_TTL = 7 * 24 * 60 * 60 * 1000;
  let registration = null;
  let checkingVersion = false;

  const currentPage = () => location.pathname.split('/').pop() || 'index.html';
  const authCallbackPages = new Set(['update-password.html', 'login.html', 'signup.html']);
  const hasAuthCallback = () => {
    const query = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    return authCallbackPages.has(currentPage()) && (
      query.has('code') || query.has('token_hash') || query.get('type') === 'recovery' ||
      hash.has('access_token') || hash.has('refresh_token') || hash.get('type') === 'recovery'
    );
  };

  const ensureHeadTag = (selector, tagName, attrs) => {
    if (document.head.querySelector(selector)) return;
    const node = document.createElement(tagName);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    document.head.appendChild(node);
  };

  ensureHeadTag('link[rel="manifest"]', 'link', { rel: 'manifest', href: '/manifest.webmanifest' });
  ensureHeadTag('meta[name="theme-color"]', 'meta', { name: 'theme-color', content: '#ff4b19' });
  ensureHeadTag('meta[name="apple-mobile-web-app-capable"]', 'meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  ensureHeadTag('meta[name="apple-mobile-web-app-status-bar-style"]', 'meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' });
  ensureHeadTag('meta[name="apple-mobile-web-app-title"]', 'meta', { name: 'apple-mobile-web-app-title', content: 'Hot Flash' });
  ensureHeadTag('link[rel="apple-touch-icon"]', 'link', { rel: 'apple-touch-icon', href: '/assets/hot-flash-logo.png' });

  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  async function fetchBuildVersion() {
    const response = await fetch(`/app-version.json?ts=${Date.now()}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Version check failed (${response.status}).`);
    return String((await response.json()).version || '').trim();
  }

  async function refreshForNewBuild(version) {
    if (hasAuthCallback() || !version || sessionStorage.getItem(REFRESH_KEY) === version) return;
    sessionStorage.setItem(REFRESH_KEY, version);
    localStorage.setItem(VERSION_KEY, version);
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('hotflash-pwa-')).map((key) => caches.delete(key)));
    }
    registration?.waiting?.postMessage('SKIP_WAITING');
    registration?.active?.postMessage('CLEAR_APP_CACHES');
    const url = new URL(location.href);
    url.searchParams.set('_hfbuild', version);
    location.replace(url.toString());
  }

  async function checkForFreshBuild() {
    if (hasAuthCallback() || checkingVersion || !navigator.onLine) return;
    checkingVersion = true;
    try {
      await registration?.update?.();
      if (registration?.waiting) registration.waiting.postMessage('SKIP_WAITING');
      const latest = await fetchBuildVersion();
      const known = localStorage.getItem(VERSION_KEY);
      if (!known) localStorage.setItem(VERSION_KEY, latest);
      else if (latest && latest !== known) await refreshForNewBuild(latest);
    } catch (error) {
      console.warn('[Hot Flash freshness check]', error);
    } finally {
      checkingVersion = false;
    }
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' });
        await registration.update();
        if (!hasAuthCallback() && registration.waiting) registration.waiting.postMessage('SKIP_WAITING');
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (!hasAuthCallback() && worker.state === 'installed' && navigator.serviceWorker.controller) worker.postMessage('SKIP_WAITING');
          });
        });
        await checkForFreshBuild();
      } catch (error) {
        console.warn('[Hot Flash PWA registration]', error);
      }
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasAuthCallback() || refreshing) return;
      refreshing = true;
      location.reload();
    });
  }

  window.addEventListener('pageshow', (event) => {
    if (!hasAuthCallback() && (standalone() || event.persisted)) checkForFreshBuild();
  });
  document.addEventListener('visibilitychange', () => {
    if (!hasAuthCallback() && document.visibilityState === 'visible' && standalone()) checkForFreshBuild();
  });
  window.addEventListener('focus', () => {
    if (!hasAuthCallback() && standalone()) checkForFreshBuild();
  });

  let deferredInstallPrompt = null;

  function installDismissedRecently() {
    const legacy = localStorage.getItem('hotflash-pwa-install-dismissed');
    if (legacy === 'true') localStorage.removeItem('hotflash-pwa-install-dismissed');
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISSED_KEY) || 0);
    if (!dismissedAt) return false;
    if (Date.now() - dismissedAt >= INSTALL_DISMISS_TTL) {
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
      return false;
    }
    return true;
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallPrompt();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    document.querySelector('[data-pwa-install-banner]')?.remove();
    localStorage.setItem('hotflash-pwa-installed', 'true');
    localStorage.removeItem(INSTALL_DISMISSED_KEY);
    localStorage.removeItem('hotflash-pwa-install-dismissed');
  });

  function showInstallPrompt() {
    if (!deferredInstallPrompt || document.querySelector('[data-pwa-install-banner]')) return;
    if (installDismissedRecently() || standalone()) return;

    const banner = document.createElement('aside');
    banner.dataset.pwaInstallBanner = '';
    banner.setAttribute('aria-label', 'Install Hot Flash');
    banner.style.cssText = 'position:fixed;left:50%;bottom:88px;z-index:1000;width:min(560px,calc(100% - 28px));transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:14px;border:1px solid rgba(255,90,0,.45);border-radius:16px;background:rgba(8,9,10,.96);box-shadow:0 18px 55px rgba(0,0,0,.5);backdrop-filter:blur(18px);color:#fff;font-family:Inter,system-ui,sans-serif';
    banner.innerHTML = `
      <img src="/assets/hot-flash-logo.png" alt="" style="width:52px;height:52px;border-radius:12px;object-fit:cover">
      <div style="min-width:0;flex:1"><strong style="display:block;font-size:1rem">Install Hot Flash</strong><span style="display:block;margin-top:3px;color:#b8bcc0;font-size:.85rem">Add it to your home screen and open it like an app.</span></div>
      <button type="button" data-pwa-install style="min-height:40px;padding:0 14px">Install</button>
      <button type="button" data-pwa-dismiss aria-label="Dismiss for 7 days" style="min-width:40px;min-height:40px;padding:0;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.15);box-shadow:none">×</button>`;

    banner.querySelector('[data-pwa-install]').addEventListener('click', async () => {
      const prompt = deferredInstallPrompt;
      if (!prompt) return;
      prompt.prompt();
      const choice = await prompt.userChoice;
      deferredInstallPrompt = null;
      banner.remove();
      if (choice?.outcome === 'dismissed') localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
    });

    banner.querySelector('[data-pwa-dismiss]').addEventListener('click', () => {
      localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()));
      banner.remove();
    });

    document.body.appendChild(banner);
  }
})();
