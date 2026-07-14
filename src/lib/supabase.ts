import { createClient } from '@supabase/supabase-js'

// Project URL + ANON (publishable) key – veřejné, patří do frontendu.
// Zabezpečení řeší RLS + přihlášení, ne skrytí klíče.
const SUPABASE_URL = 'https://gboeuihqqncwiomksfxy.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdib2V1aWhxcW5jd2lvbWtzZnh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNTEzODUsImV4cCI6MjA5OTYyNzM4NX0.bs5tyRJThczQVurHLfkR5k5nDQ7o2JEETdsYpCc-qwA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const STORAGE_BUCKET = 'contracts'
