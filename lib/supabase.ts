import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Lazy Supabase client.
 * Includes fallback values to prevent fatal unhandled initialization crashes
 * if client-side bundles load before environment injection finishes.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_client) {
      if (!supabaseUrl || !supabaseAnonKey) {
        console.warn('Supabase credentials missing or invalid in bundle:', {
          hasUrl: Boolean(supabaseUrl),
          hasKey: Boolean(supabaseAnonKey),
        });
        _client = createClient(
          supabaseUrl || 'https://placeholder.supabase.co',
          supabaseAnonKey || 'placeholder-anon-key'
        );
      } else {
        _client = createClient(supabaseUrl, supabaseAnonKey);
      }
    }
    const value = Reflect.get(_client, prop);
    return typeof value === 'function' ? value.bind(_client) : value;
  },
});