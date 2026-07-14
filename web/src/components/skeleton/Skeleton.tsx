interface SkProps {
  w: number | string;
  h?: number;
  radius?: number | string;
}

// Placeholder bar matching the size of the real content it stands in for —
// callers pass the exact width/height of the text or element being replaced.
export function Sk({ w, h = 14, radius }: SkProps) {
  return (
    <span
      className="sk"
      style={{
        width: typeof w === 'number' ? `${w}px` : w,
        height: h,
        display: 'inline-block',
        borderRadius: radius !== undefined ? (typeof radius === 'number' ? `${radius}px` : radius) : undefined,
      }}
    />
  );
}
