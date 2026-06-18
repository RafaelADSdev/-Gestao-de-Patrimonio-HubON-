// =============================================
//  Supabase Configuration
//  Preencha com suas credenciais:
//  Dashboard → Settings → API
// =============================================
const SUPABASE_URL      = 'https://jiqfedifxirhejrdqzkq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppcWZlZGlmeGlyaGVqcmRxemtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDM5OTIsImV4cCI6MjA5MDAxOTk5Mn0.e4_f0KErvYxOmnf8pK_Zj2AQfQDfX-vREd6DNDGQ0E4';

var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
