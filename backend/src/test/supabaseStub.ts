import { vi } from 'vitest';

/**
 * Builds a chainable stub that mimics the part of the Supabase
 * query-builder API used by our routes (.from().select().eq()...).
 * Every method returns the stub itself so calls can be chained in any
 * order, and the stub is "thenable" so `await`-ing it anywhere in the
 * chain resolves to the configured `{ data, error }` result — exactly
 * like the real PostgrestFilterBuilder.
 */
export function makeQueryStub(result: { data?: unknown; error?: unknown }) {
  const stub: Record<string, unknown> = {};
  const methods = ['select', 'order', 'eq', 'in', 'insert', 'update', 'delete', 'upsert', 'single'];
  for (const m of methods) {
    stub[m] = vi.fn(() => stub);
  }
  stub.then = (resolve: (r: typeof result) => unknown) => resolve(result);
  return stub;
}

/** Builds a fake Supabase client whose `.from(table)` returns the given stub. */
export function makeSupabaseClientStub(stub: ReturnType<typeof makeQueryStub>) {
  return { from: vi.fn(() => stub) };
}
