const HOTFLASH_SUPABASE_URL = "https://juwkzmlchffbovlrqhex.supabase.co";
const HOTFLASH_SUPABASE_ANON_KEY = "sb_publishable_mWZZuoYhHOb4ivMpxZNuHA_DeUKW_zB";
const HOTFLASH_AUTH_STORAGE_KEY = "hotflash-auth-session";
const HOTFLASH_LEGACY_AUTH_STORAGE_KEY = "sb-juwkzmlchffbovlrqhex-auth-token";

// Keep every page on one origin. Browser storage is origin-specific, so
// www.hotflash.app and hotflash.app would otherwise behave like two accounts.
if (window.location.hostname === "www.hotflash.app") {
  const canonical = new URL(window.location.href);
  canonical.hostname = "hotflash.app";
  window.location.replace(canonical.toString());
}

// Preserve existing member sessions when moving from Supabase's generated
// storage key to Hot Flash's explicit shared key.
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

// Multi-page sites can occasionally ask for a session during the same instant
// that Supabase is restoring or refreshing it. This helper gives protected
// pages one brief recovery attempt before treating the member as signed out.
window.hotFlashGetStableSession = async function hotFlashGetStableSession() {
  const first = await hotflashSupabase.auth.getSession();
  if (first.error) console.warn("[Hot Flash session check]", first.error);
  if (first.data?.session) return first.data.session;

  await new Promise((resolve) => window.setTimeout(resolve, 250));
  const second = await hotflashSupabase.auth.getSession();
  if (second.error) console.warn("[Hot Flash session recovery]", second.error);
  return second.data?.session || null;
};

// Resume token refreshing after a phone or laptop tab has been asleep.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    hotflashSupabase.auth.startAutoRefresh();
  } else {
    hotflashSupabase.auth.stopAutoRefresh();
  }
});
