interface BrandMarkProps {
  size?: number;
}

export default function BrandMark({ size = 60 }: BrandMarkProps) {
  return (
    <svg
      className="auth-logo"
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="Carteira de Criptoativos"
    >
      <defs>
        <linearGradient id="auth-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7931a" />
          <stop offset="0.55" stopColor="#22b899" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="230" fill="url(#auth-logo-bg)" />
      <g transform="translate(-34,0)" stroke="#fff" fill="none" strokeWidth="86" strokeLinecap="round" strokeLinejoin="round">
        <path d="M402 278 L402 746" />
        <path d="M452 278 L452 746" />
        <path d="M410 320 L410 700" />
        <path d="M410 320 C 566 320, 664 364, 664 418 C 664 468, 566 510, 410 510" />
        <path d="M410 510 C 588 510, 706 558, 706 614 C 706 670, 588 700, 410 700" />
      </g>
    </svg>
  );
}
