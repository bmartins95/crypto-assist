import type { Platform } from '@/lib/types';
import { useLocale } from '@/context/LocaleContext';
import PlatformLogo from './PlatformLogo';

interface Props {
  platform: Platform;
  size?: 'sm' | 'md';
  bold?: boolean;
  showCustomTag?: boolean;
}

export default function PlatformChip({ platform, size = 'sm', bold = false, showCustomTag = false }: Props) {
  const { t } = useLocale();
  return (
    <span className="plat">
      <PlatformLogo platform={platform} size={size} />
      <span className="pn" style={bold ? { fontWeight: 600 } : undefined}>{platform.name}</span>
      {showCustomTag && platform.kind === 'custom' && (
        <span className="cat custom">{t.platform_kind_custom}</span>
      )}
    </span>
  );
}
