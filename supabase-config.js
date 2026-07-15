const HOTFLASH_SUPABASE_URL = "https://juwkzmlchffbovlrqhex.supabase.co";
const HOTFLASH_SUPABASE_ANON_KEY = "sb_publishable_mWZZuoYhHOb4ivMpxZNuHA_DeUKW_zB";
const HOTFLASH_AUTH_STORAGE_KEY = "hotflash-auth-session";
const HOTFLASH_LEGACY_AUTH_STORAGE_KEY = "sb-juwkzmlchffbovlrqhex-auth-token";

// Load the shared final theme on every Supabase-powered Hot Flash page.
if (!document.querySelector('link[data-hotflash-final-theme]')) {
  const theme = document.createElement('link');
  theme.rel = 'stylesheet';
  theme.href = 'final-theme.css?v=1';
  theme.dataset.hotflashFinalTheme = 'true';
  document.head.appendChild(theme);
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
  const first = await hotflashSupabase.auth.getSession();
  if (first.error) console.warn("[Hot Flash session check]", first.error);
  if (first.data?.session) return first.data.session;
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  const second = await hotflashSupabase.auth.getSession();
  if (second.error) console.warn("[Hot Flash session recovery]", second.error);
  return second.data?.session || null;
};

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") hotflashSupabase.auth.startAutoRefresh();
  else hotflashSupabase.auth.stopAutoRefresh();
});