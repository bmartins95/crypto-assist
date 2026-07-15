interface WordmarkProps {
  size?: number;
}

export default function Wordmark({ size = 17 }: WordmarkProps) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      datum<span className="wm-dot">.</span>
    </span>
  );
}
