import { useState } from 'react';

type Size = 'sm' | 'md';

interface Props {
  image?: string | null;
  symbol: string;
  size?: Size;
}

export default function CoinLogo({ image, symbol, size = 'sm' }: Props) {
  const [failed, setFailed] = useState(false);
  const showImg = !!image && !failed;
  return (
    <span className={`coin${size === 'sm' ? ' coin-sm' : ''}`}>
      {showImg
        ? <img src={image ?? undefined} alt="" onError={() => setFailed(true)} />
        : (symbol || '?').slice(0, 3).toUpperCase()}
    </span>
  );
}
