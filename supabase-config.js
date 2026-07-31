const HOTFLASH_SUPABASE_URL = "https://juwkzmlchffbovlrqhex.supabase.co";
const HOTFLASH_SUPABASE_ANON_KEY = "sb_publishable_mWZZuoYhHOb4ivMpxZNuHA_DeUKW_zB";
const HOTFLASH_AUTH_STORAGE_KEY = "hotflash-auth-session";
const HOTFLASH_LEGACY_AUTH_STORAGE_KEY = "sb-juwkzmlchffbovlrqhex-auth-token";

function hotFlashLoadStyle(selector, href, dataKey) {
  if (document.querySelector(selector)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset[dataKey] = 'true';
  document.head.appendChild(link);
}

function hotFlashLoadScript(selector, src, dataKey) {
  if (document.querySelector(selector)) return;
  const script = document.createElement('script');
  script.src = src;
  script.defer = true;
  script.dataset[dataKey] = 'true';
  document.head.appendChild(script);
}

hotFlashLoadStyle('link[data-hotflash-final-theme]', 'final-theme.css?v=1', 'hotflashFinalTheme');
hotFlashLoadStyle('link[data-hotflash-app-navigation]', 'app-navigation.css?v=1', 'hotflashAppNavigation');
hotFlashLoadStyle('link[data-hotflash-dashboard-themes]', 'dashboard-themes.css?v=2', 'hotflashDashboardThemes');
hotFlashLoadStyle('link[data-hotflash-action-feedback]', 'action-feedback.css?v=1', 'hotflashActionFeedback');
hotFlashLoadStyle('link[data-hotflash-flashtag-orders]', 'flashtag-orders.css?v=1', 'hotflashFlashtagOrders');

hotFlashLoadScript('script[data-hotflash-pwa]', '/pwa.js?v=2', 'hotflashPwa');
hotFlashLoadScript('script[data-hotflash-membership]', 'membership.js?v=1', 'hotflashMembership');
hotFlashLoadScript('script[data-hotflash-app-navigation]', 'app-navigation.js?v=1', 'hotflashAppNavigation');
hotFlashLoadScript('script[data-hotflash-dashboard-themes]', 'dashboard-themes.js?v=3', 'hotflashDashboardThemes');
hotFlashLoadScript('script[data-hotflash-action-feedback]', 'action-feedback.js?v=1', 'hotflashActionFeedback');
hotFlashLoadScript('script[data-hotflash-flashtag-orders]', 'flashtag-orders.js?v=3', 'hotflashFlashtagOrders');

if (document.body?.dataset?.page === 'dashboard' || window.location.pathname.endsWith('/dashboard.html')) {
  hotFlashLoadStyle('link[data-member-sections]', 'member-sections.css?v=1', 'memberSections');
  hotFlashLoadScript('script[data-member-sections]', 'member-sections.js?v=1', 'memberSections');
  hotFlashLoadStyle('link[data-hotflash-game-garage]', 'game-garage.css?v=1', 'hotflashGameGarage');
  hotFlashLoadScript('script[data-hotflash-game-garage]', 'game-garage.js?v=1', 'hotflashGameGarage');
}

if (window.location.hostname === "www.hotflash.app") {
  const canonical = new URL(window.location.href);
  canonical.hostname = "hotflash.app";
  window.location.replace(canonical.toString());
}

try {
  if (!window.localStorage.getItem(HOTFLASH_AUTH_STORAGE_KEY)) {
    const legacySession = window.localStorage.getItem(HOTFLASH_LEGACY_AUTH_STORAGE_KEY);
    if (legacySession) window.localStorage.setItem(HOTFLASH_AUTH_STORAGE_KEY, legacySession);
  }
} catch (error) {
  console.warn("[Hot Flash auth storage unavailable]", error);
}

const hotflashSupabase = window.supabase.createClient(
  HOTFLASH_SUPABASE_URL,
  HOTFLASH_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: window.localStorage,
      storageKey: HOTFLASH_AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce"
    },
  },
);

window.hotFlashGetStableSession = async function hotFlashGetStableSession() {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await hotflashSupabase.auth.getSession();
    if (error) console.warn(`[Hot Flash session check ${attempt + 1}]`, error);
    if (data?.session) return data.session;
    if (attempt < 3) await new Promise((resolve) => window.setTimeout(resolve, 350));
  }
  return null;
};

hotflashSupabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    try { window.localStorage.setItem('hotflash-last-authenticated', String(Date.now())); } catch (_) {}
  }
  if (event === 'TOKEN_REFRESHED') console.info('[Hot Flash session refreshed]');
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    hotflashSupabase.auth.startAutoRefresh();
    window.hotFlashGetStableSession();
  } else {
    hotflashSupabase.auth.stopAutoRefresh();
  }
});