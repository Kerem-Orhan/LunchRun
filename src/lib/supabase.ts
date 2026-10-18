import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Shared Supabase client. The anon key is meant to be public — Row Level
 * Security (see supabase/schema.sql) is what actually protects the data.
 *
 * It's `null` until the env vars are set, so the UI can still run locally
 * (and show a friendly message) before Supabase is configured.
 */
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null
