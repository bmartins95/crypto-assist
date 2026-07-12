import { useState } from 'react';
import type { Platform } from '@/lib/types';
import { hashColor, initials } from './platformAvatar';

type Size = 'sm' | 'md';

interface Props {
  platform: Platform;
  size?: Size;
}

export default function PlatformLogo({ platform, size = 'sm' }: Props) {
  const [failed, setFailed] = useState(false);
  const showImg = !!platform.logoUrl && !failed;
  return (
    <span
      className={`plogo plogo-${size}`}
      style={showImg ? undefined : { background: hashColor(platform.name) }}
    >
      {showImg
        ? <img src={platform.logoUrl} alt="" onError={() => setFailed(true)} />
        : initials(platform.name)}
    </span>
  );
}
