// Dummy values so importing lib/supabase.ts doesn't throw during tests.
// Tests that need specific Supabase behavior mock '../lib/supabase' directly.
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
