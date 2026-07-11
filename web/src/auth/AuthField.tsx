import { useId } from 'react';

interface AuthFieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  required?: boolean;
}

export default function AuthField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  required = true,
}: AuthFieldProps) {
  const id = useId();
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="auth-inp"
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        // Chrome's autofill doesn't always reliably fire a plain 'input' event; the
        // auth-autofill-detect keyframe (globals.css) only runs while :-webkit-autofill
        // is active, so this reliably catches it and forces React's controlled value
        // to match what's actually showing on screen.
        onAnimationStart={e => {
          if (e.animationName === 'auth-autofill-detect') onChange(e.currentTarget.value);
        }}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="auth-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
