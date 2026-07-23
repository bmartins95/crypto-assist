const PALETTE = ['#534AB7', '#1D9E75', '#D85A30', '#D4537E', '#378ADD', '#639922', '#BA7517', '#E24B4A', '#888780', '#0F6E56'];

export function assetColor(coinId: string, coinIds: string[]): string {
  const index = coinIds.indexOf(coinId);
  return PALETTE[(index < 0 ? 0 : index) % PALETTE.length];
}
