import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase config: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY ' +
      'are inlined at build time. Locally they come from .env.local; in CI from ' +
      'the repository Actions variables.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
