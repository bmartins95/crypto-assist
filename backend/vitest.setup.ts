// Dummy values so importing lib/supabase.ts doesn't throw during tests.
// Tests that need specific Supabase behavior mock '../lib/supabase' directly.
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
