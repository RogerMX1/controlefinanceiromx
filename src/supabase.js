import { createClient } from '@supabase/supabase-js'

// ATENÇÃO: Mantenha as SUAS chaves que já estão aí. 
// Não apague as aspas.
const supabaseUrl = 'https://xuztxbsdjsnwadajvzmv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1enR4YnNkanNud2FkYWp2em12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MjgxNjcsImV4cCI6MjA4MTMwNDE2N30.LWTN0eJIGZW9u_Z8mNm3YRu5mcIyuj5LRz_HZFknKUA' // (Sua chave gigante)

export const supabase = createClient(supabaseUrl, supabaseKey)