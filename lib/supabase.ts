import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Lazy Supabase client. Creation is deferred until first accessed,
 * so the static export build never initializes it (env vars are
 * only needed at runtime in the browser).
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      _client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    const value = Reflect.get(_client, prop);
    return typeof value === 'function' ? value.bind(_client) : value;
  },
});