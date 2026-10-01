import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
const supabaseKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

/**
 * Client-side Supabase Client
 * Project: mgpjlhjcpdhkuzhwxtqn
 */
export const supabase = createClient(supabaseUrl, supabaseKey);
