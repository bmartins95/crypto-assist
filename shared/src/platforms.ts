import seedData from './platforms/seed.json';

export type PlatformKind = 'exchange' | 'wallet' | 'defi' | 'custom';

export interface Platform {
  id: string;
  name: string;
  kind: PlatformKind;
  subtitle?: string;
  logoUrl?: string;
}

export const PLATFORM_SEED: Platform[] = seedData as Platform[];
