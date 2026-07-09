const HOTFLASH_SUPABASE_URL = "https://juwkzmlchffbovlrqhex.supabase.co";
const HOTFLASH_SUPABASE_ANON_KEY = "PASTE_SUPABASE_PUBLISHABLE_KEY_HERE";

const hotflashSupabase = window.supabase.createClient(
  HOTFLASH_SUPABASE_URL,
  HOTFLASH_SUPABASE_ANON_KEY,
);
