const HOTFLASH_SUPABASE_URL = "https://juwkzmlchffbovlrqhex.supabase.co";
const HOTFLASH_SUPABASE_ANON_KEY = "sb_publishable_mWZZuoYhHOb4ivMpxZNuHA_DeUKW_zB";
const HOTFLASH_AUTH_STORAGE_KEY = "hotflash-auth-session";
const HOTFLASH_LEGACY_AUTH_STORAGE_KEY = "sb-juwkzmlchffbovlrqhex-auth-token";

if (!document.querySelector('link[data-hotflash-final-theme]')) {
  const theme = document.createElement('link');
  theme.rel = 'stylesheet';
  theme.href = 'final-theme.css?v=1';
  theme.dataset.hotflashFinalTheme = 'true';
  document.head.appendChild(theme);
}

if (!document.querySelector('script[data-hotflash-pwa]')) {
  const pwa = document.createElement('script');
  pwa.src = '/pwa.js?v=2';
  pwa.defer = true;
  pwa.dataset.hotflashPwa = 'true';
  document.head.appendChild(pwa);
}

if (document.body?.dataset?.page === 'dashboard' || window.location.pathname.endsWith('/dashboard.html')) {
  if (!document.querySelector('link[data-member-sections]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'member-sections.css?v=1';
    css.dataset.memberSections = 'true';
    document.head.appendChild(css);
  }
  if (!document.querySelector('script[data-member-sections]')) {
    const script = document.createElement('script');
    script.src = 'member-sections.js?v=1';
    script.defer = true;
    script.dataset.memberSections = 'true';
    document.head.appendChild(script);
  }
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
      flowType: "pkce",
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