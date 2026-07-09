const HOTFLASH_SUPABASE_URL = "https://juwkzmlchffbovlrqhex.supabase.co";
const HOTFLASH_SUPABASE_ANON_KEY = "sb_publishable_mWZZuoYhHOb4ivMpxZNuHA_DeUKW_zB";

const hotflashSupabase = window.supabase.createClient(
  HOTFLASH_SUPABASE_URL,
  HOTFLASH_SUPABASE_ANON_KEY,
);
