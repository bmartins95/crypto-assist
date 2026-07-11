import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouterState } from '@tanstack/react-router';

type SlotName = 'primary' | 'secondary';

interface SlotProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}

const SLOT_NAMES: SlotName[] = ['primary', 'secondary'];

interface VaultContextValue {
  claim: (slot: SlotName, target: HTMLElement, props: SlotProps) => void;
  release: (slot: SlotName) => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

const AUTH_ROUTE_PREFIXES = ['/login', '/signup'];

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTE_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

function makeWrapper(): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = 'display:contents';
  return el;
}

// React's own createPortal reconciliation does NOT preserve a node's identity when
// its target container prop changes between renders — it unmounts the old portal and
// mounts a fresh one, which recreates the underlying <input> just as surely as a
// normal unmount would. So React always portals each slot's <input> into ONE fixed
// wrapper <div> that React itself never moves or loses track of; all actual on-screen
// relocation is done by hand — appendChild-ing that WRAPPER (never the <input> React
// owns directly) into wherever it's currently needed. React still finds its <input>
// exactly where it left it (inside the wrapper) whenever it needs to update or clean
// it up, regardless of where our own code has physically moved the wrapper since —
// the technique behind libraries like react-reverse-portal.
export function PasswordVaultProvider({ children }: { children: ReactNode }) {
  const [poolEl] = useState(() => {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none';
    return el;
  });
  const [wrappers] = useState<Record<SlotName, HTMLDivElement>>(() => ({
    primary: makeWrapper(),
    secondary: makeWrapper(),
  }));
  const [renderProps, setRenderProps] = useState<Record<SlotName, SlotProps | null>>({
    primary: null,
    secondary: null,
  });
  const pathname = useRouterState({ select: s => s.location.pathname });

  useLayoutEffect(() => {
    document.body.appendChild(poolEl);
    return () => poolEl.remove();
    // Deliberately does NOT eagerly park wrappers into poolEl here — a slot that a
    // PasswordSlot child has already claimed in this same commit (children's layout
    // effects run before the parent's) would otherwise get yanked right back out.
    // Parking only ever happens lazily, in release(), when a slot is actually given up.
  }, [poolEl]);

  const relocate = useCallback(
    (slot: SlotName, target: HTMLElement | null) => {
      const wrapper = wrappers[slot];
      const dest = target ?? poolEl;
      if (wrapper.parentElement !== dest) dest.appendChild(wrapper);
    },
    [poolEl, wrappers]
  );

  // A single entry point, called on every relevant render (claim is idempotent — the
  // guard in relocate() skips the DOM move if already correctly placed — so it's safe
  // to call on every keystroke, not just the first).
  const claim = useCallback(
    (slot: SlotName, target: HTMLElement, props: SlotProps) => {
      relocate(slot, target);
      setRenderProps(prev => ({ ...prev, [slot]: props }));
    },
    [relocate]
  );

  const release = useCallback(
    (slot: SlotName) => {
      relocate(slot, null);
      setRenderProps(prev => (prev[slot] === null ? prev : { ...prev, [slot]: null }));
    },
    [relocate]
  );

  // Leaving the auth flow entirely (a real, successful sign-in/sign-up) is the one
  // case where the field SHOULD look like a genuine submission — that's what lets the
  // browser's own "save this password?" prompt fire, which is desirable there. Every
  // other transition (back, cancel, switching between login/signup/forgot-password)
  // only relocates the wrapper, so it never reads as a removed form.
  useLayoutEffect(() => {
    if (!isAuthRoute(pathname)) {
      SLOT_NAMES.forEach(slot => wrappers[slot].remove());
    }
  }, [pathname, wrappers]);

  // A fresh object literal here would re-render every PasswordSlot consumer on every
  // slots update, and since each consumer's own effect writes back into this state,
  // that could cascade into repeated, avoidable render passes.
  const contextValue = useMemo(() => ({ claim, release }), [claim, release]);

  return (
    <VaultContext.Provider value={contextValue}>
      {children}
      {SLOT_NAMES.map(slot => {
        const props = renderProps[slot];
        return createPortal(
          <input
            key={slot}
            id={props?.id}
            className="auth-inp"
            type="password"
            value={props?.value ?? ''}
            onChange={e => props?.onChange(e.target.value)}
            placeholder={props?.placeholder}
            autoComplete={props?.autoComplete}
            aria-invalid={props?.ariaInvalid}
            aria-describedby={props?.ariaDescribedBy}
            tabIndex={props ? undefined : -1}
          />,
          wrappers[slot],
          slot
        );
      })}
    </VaultContext.Provider>
  );
}

interface PasswordSlotProps {
  slot: SlotName;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: string;
}

export default function PasswordSlot({ slot, label, value, onChange, placeholder, autoComplete, error }: PasswordSlotProps) {
  const vault = useContext(VaultContext);
  const id = useId();
  const targetRef = useRef<HTMLDivElement>(null);

  // Claims (or re-claims, idempotently) this slot on every render — cheap, since
  // relocate() only actually touches the DOM when the wrapper isn't already in
  // place — and keeps the portal's live <input> in sync with this instance's latest
  // value/handlers. A separate, dependency-free effect (below) owns the release-on-
  // unmount so it isn't entangled with this one's per-render work.
  useLayoutEffect(() => {
    if (!vault || !targetRef.current) return;
    vault.claim(slot, targetRef.current, {
      id,
      value,
      onChange,
      placeholder,
      autoComplete,
      ariaInvalid: Boolean(error),
      ariaDescribedBy: error ? `${id}-error` : undefined,
    });
  });

  const vaultRef = useRef(vault);
  vaultRef.current = vault;
  const slotRef = useRef(slot);
  slotRef.current = slot;

  useLayoutEffect(() => {
    return () => vaultRef.current?.release(slotRef.current);
  }, []);

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {vault ? (
        <div ref={targetRef} />
      ) : (
        <input
          id={id}
          className="auth-inp"
          type="password"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      )}
      {error && (
        <p id={`${id}-error`} className="auth-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
