import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Configuração do Supabase
const supabaseUrl = "https://jaouwhckqqnaxqyfvgyq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3V3aGNrcXFuYXhxeWZ2Z3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNzQyNTksImV4cCI6MjA2Nzc1MDI1OX0.lQ72wQeKL9F9L9T-1kjJif5SEY_cHYFI7rM-uXN5ARc";

// Cliente Supabase configurado
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});