(() => {
  const VERSION_KEY = 'hotflash-app-version';
  const REFRESH_KEY = 'hotflash-version-refresh';
  let registration = null;
  let checkingVersion = false;

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
    const response = await fetch(`/app-version.json?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) throw new Error(`Version check failed (${response.status}).`);
    return String((await response.json()).version || '').trim();
  }

  async function refreshForNewBuild(version) {
    if (!version || sessionStorage.getItem(REFRESH_KEY) === version) return;
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
    if (checkingVersion || !navigator.onLine) return;
    checkingVersion = true;
    try {
      await registration?.update?.();
      if (registration?.waiting) registration.waiting.postMessage('SKIP_WAITING');
      const latest = await fetchBuildVersion();
      const known = localStorage.getItem(VERSION_KEY);
      if (!known) {
        localStorage.setItem(VERSION_KEY, latest);
      } else if (latest && latest !== known) {
        await refreshForNewBuild(latest);
      }
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

        if (registration.waiting) registration.waiting.postMessage('SKIP_WAITING');
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage('SKIP_WAITING');
            }
          });
        });

        await checkForFreshBuild();
      } catch (error) {
        console.warn('[Hot Flash PWA registration]', error);
      }
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });
  }

  window.addEventListener('pageshow', (event) => {
    if (standalone() || event.persisted) checkForFreshBuild();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && standalone()) checkForFreshBuild();
  });

  window.addEventListener('focus', () => {
    if (standalone()) checkForFreshBuild();
  });

  let deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallPrompt();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    document.querySelector('[data-pwa-install-banner]')?.remove();
    localStorage.setItem('hotflash-pwa-installed', 'true');
  });

  function showInstallPrompt() {
    if (!deferredInstallPrompt || document.querySelector('[data-pwa-install-banner]')) return;
    if (localStorage.getItem('hotflash-pwa-install-dismissed') === 'true') return;
    if (standalone()) return;

    const banner = document.createElement('aside');
    banner.dataset.pwaInstallBanner = '';
    banner.setAttribute('aria-label', 'Install Hot Flash');
    banner.style.cssText = 'position:fixed;left:50%;bottom:88px;z-index:1000;width:min(560px,calc(100% - 28px));transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:14px;border:1px solid rgba(255,90,0,.45);border-radius:16px;background:rgba(8,9,10,.96);box-shadow:0 18px 55px rgba(0,0,0,.5);backdrop-filter:blur(18px);color:#fff;font-family:Inter,system-ui,sans-serif';
    banner.innerHTML = `
      <img src="/assets/hot-flash-logo.png" alt="" style="width:52px;height:52px;border-radius:12px;object-fit:cover">
      <div style="min-width:0;flex:1"><strong style="display:block;font-size:1rem">Install Hot Flash</strong><span style="display:block;margin-top:3px;color:#b8bcc0;font-size:.85rem">Add it to your home screen and open it like an app.</span></div>
      <button type="button" data-pwa-install style="min-height:40px;padding:0 14px">Install</button>
      <button type="button" data-pwa-dismiss aria-label="Dismiss" style="min-width:40px;min-height:40px;padding:0;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.15);box-shadow:none">×</button>`;

    banner.querySelector('[data-pwa-install]').addEventListener('click', async () => {
      const prompt = deferredInstallPrompt;
      if (!prompt) return;
      prompt.prompt();
      await prompt.userChoice;
      deferredInstallPrompt = null;
      banner.remove();
    });

    banner.querySelector('[data-pwa-dismiss]').addEventListener('click', () => {
      localStorage.setItem('hotflash-pwa-install-dismissed', 'true');
      banner.remove();
    });

    document.body.appendChild(banner);
  }
})();
