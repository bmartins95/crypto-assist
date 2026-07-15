interface BrandMarkProps {
  size?: number;
}

export default function BrandMark({ size = 60 }: BrandMarkProps) {
  return (
    <svg
      className="auth-logo"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Datum"
    >
      <rect width="512" height="512" rx="115" fill="#17171a" stroke="#26262b" />
      <path
        d="M148 118 L148 394 L232 394 C348 394 410 336 410 256 C410 176 348 118 232 118 Z"
        fill="none"
        stroke="#2dd4bf"
        strokeWidth="31"
        strokeLinejoin="round"
      />
      <circle cx="263" cy="256" r="31" fill="#f97316" />
    </svg>
  );
}
