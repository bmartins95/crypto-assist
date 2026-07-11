interface BackButtonProps {
  label: string;
  onClick: () => void;
}

export default function BackButton({ label, onClick }: BackButtonProps) {
  return (
    <button type="button" className="auth-back" onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
}
