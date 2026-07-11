interface SuccessStateProps {
  title: string;
  subtitle: string;
}

export default function SuccessState({ title, subtitle }: SuccessStateProps) {
  return (
    <div className="auth-loader">
      <div className="auth-check-wrap">
        <svg viewBox="0 0 24 24" width="38" height="38" aria-hidden="true">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2>{title}</h2>
      <p className="auth-msg">{subtitle}</p>
    </div>
  );
}
