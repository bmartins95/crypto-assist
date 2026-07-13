const HUES = [210, 265, 175, 32, 340, 145];

export function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${HUES[Math.abs(h) % HUES.length]} 55% 45%)`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const raw = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return raw.replace(/[^\w]/g, '').toUpperCase();
}

// Mirrors backend/app/platform_resolve.py's _slugify — only needs to be a stable,
// readable id for this user's own custom platform, not byte-identical across
// languages (custom ids are stored verbatim, never re-derived server-side).
export function slugify(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'platform';
}
