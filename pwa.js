(() => {
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

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
        registration.update();

        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateNotice(worker);
            }
          });
        });
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
    if (window.matchMedia('(display-mode: standalone)').matches) return;

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

  function showUpdateNotice(worker) {
    if (document.querySelector('[data-pwa-update]')) return;
    const notice = document.createElement('aside');
    notice.dataset.pwaUpdate = '';
    notice.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:1001;display:flex;align-items:center;gap:12px;max-width:420px;padding:14px 16px;border:1px solid rgba(255,90,0,.45);border-radius:14px;background:#101214;color:#fff;box-shadow:0 18px 55px rgba(0,0,0,.5);font-family:Inter,system-ui,sans-serif';
    notice.innerHTML = '<span style="flex:1">A fresh Hot Flash update is ready.</span><button type="button" data-pwa-refresh>Update</button>';
    notice.querySelector('[data-pwa-refresh]').addEventListener('click', () => worker.postMessage('SKIP_WAITING'));
    document.body.appendChild(notice);
  }
})();
