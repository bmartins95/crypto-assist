import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { useLocale } from '@/context/LocaleContext';

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A11 11 0 0 1 12 5c7 0 11 7 11 7a17.7 17.7 0 0 1-3.2 3.9M6.6 6.6C3.9 8.3 2 12 2 12s4 7 11 7a10 10 0 0 0 4.4-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

function supportsMasking(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('-webkit-text-security', 'disc');
}

// Chrome's password manager records every keystroke that lands in a field that is —
// or EVER WAS — type="password" (Blink's has_been_password_field flag is permanent,
// so flipping the type after mount doesn't untrack it, and clearing the value later
// doesn't either), then treats any same-document navigation while that field is gone
// as a successful login and offers to save. The only typed input Chrome provably
// ignores (verified against chrome://password-manager-internals) is a text field that
// was never a password field. So: the field starts as a real password input purely so
// the browser's saved-credential autofill works, and the instant the user types, that
// element is discarded (still empty and untouched — harmless) and replaced by a
// brand-new visually-masked text element, which React creates fresh via the key
// switch below. The save prompt for REAL logins is then triggered explicitly with
// storePasswordCredential() — never by Chrome's heuristics.
export default function PasswordField({ label, value, onChange, placeholder, autoComplete, error }: PasswordFieldProps) {
  const { t } = useLocale();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);
  const prevMaskedRef = useRef(false);
  const [masked, setMasked] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (masked) return;
    const el = inputRef.current;
    if (!el) return;
    const handleBeforeInput = (e: InputEvent) => {
      if (!supportsMasking()) return;
      // Composition (IME) insertions are not cancelable per spec — let them fall
      // through to the plain password field rather than half-breaking the IME.
      if (e.inputType === 'insertCompositionText') return;
      const inserted = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
      const isDeletion = e.inputType.startsWith('delete');
      if (!inserted && !isDeletion) return;
      e.preventDefault();
      if (isDeletion) {
        // Only reachable when the browser autofilled the plain field; letting the
        // deletion edit it in place would count as user-typed password input, so
        // clear the whole value programmatically instead (script-set changes are
        // not tracked) — retyping a password from scratch is the expected UX anyway.
        if (el.value !== '') onChange('');
        return;
      }
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      caretRef.current = start + inserted.length;
      onChange(el.value.slice(0, start) + inserted + el.value.slice(end));
      setMasked(true);
    };
    el.addEventListener('beforeinput', handleBeforeInput);
    return () => el.removeEventListener('beforeinput', handleBeforeInput);
  }, [masked, onChange]);

  useEffect(() => {
    if (prevMaskedRef.current === masked) return;
    prevMaskedRef.current = masked;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const caret = caretRef.current ?? el.value.length;
    caretRef.current = null;
    el.setSelectionRange(caret, caret);
  }, [masked]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    onChange(next);
    if (next === '' && masked) setMasked(false);
  };

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-inp-wrap">
        <input
          // The key switch forces React to build a NEW DOM element on each transition:
          // reusing the node would carry Blink's permanent has_been_password_field flag
          // into the masked state and defeat the whole mechanism. Toggling `revealed`
          // deliberately does NOT affect this key — it only flips CSS masking (once
          // `masked`) or the `type` of this same, already-flagged node (before `masked`),
          // never causing a remount.
          key={masked ? 'masked' : 'plain'}
          ref={inputRef}
          id={id}
          className={masked && !revealed ? 'auth-inp auth-inp-masked' : 'auth-inp'}
          type={masked ? 'text' : revealed ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          // Chrome's autofill doesn't always reliably fire a plain 'input' event; the
          // auth-autofill-detect keyframe (globals.css) only runs while
          // :-webkit-autofill is active, so this catches it and syncs React's value.
          onAnimationStart={e => {
            if (e.animationName === 'auth-autofill-detect') onChange(e.currentTarget.value);
          }}
          placeholder={placeholder}
          autoComplete={masked ? 'off' : autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="auth-eye-toggle"
          onClick={() => setRevealed(r => !r)}
          aria-label={revealed ? t.auth_password_hide : t.auth_password_show}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="auth-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
