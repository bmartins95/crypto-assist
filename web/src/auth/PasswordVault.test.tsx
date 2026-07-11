import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { PasswordVaultProvider } from './PasswordVault';
import PasswordSlot from './PasswordVault';

let mockPathname = '/login/email';
vi.mock('@tanstack/react-router', () => ({
  useRouterState: <T,>({ select }: { select: (s: { location: { pathname: string } }) => T }) =>
    select({ location: { pathname: mockPathname } }),
}));

function FieldA() {
  const [value, setValue] = useState('');
  return <PasswordSlot slot="primary" label="Field A" value={value} onChange={setValue} />;
}

function FieldB() {
  const [value, setValue] = useState('');
  return <PasswordSlot slot="primary" label="Field B" value={value} onChange={setValue} />;
}

function Toggle({ initial }: { initial: 'a' | 'b' | 'none' }) {
  const [which, setWhich] = useState(initial);
  return (
    <div>
      <button type="button" onClick={() => setWhich('a')}>show a</button>
      <button type="button" onClick={() => setWhich('b')}>show b</button>
      <button type="button" onClick={() => setWhich('none')}>show none</button>
      {which === 'a' && <FieldA />}
      {which === 'b' && <FieldB />}
    </div>
  );
}

describe('PasswordVault', () => {
  beforeEach(() => {
    mockPathname = '/login/email';
  });

  it('renders a real password input for a claimed slot', () => {
    render(
      <PasswordVaultProvider>
        <FieldA />
      </PasswordVaultProvider>
    );
    const input = screen.getByLabelText('Field A') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.change(input, { target: { value: 'secret' } });
    expect(input.value).toBe('secret');
  });

  it('keeps the same DOM node connected when the claiming component swaps', () => {
    const { container } = render(
      <PasswordVaultProvider>
        <Toggle initial="a" />
      </PasswordVaultProvider>
    );
    const inputBefore = container.querySelector('input[type=password]');
    expect(inputBefore).not.toBeNull();

    fireEvent.click(screen.getByText('show b'));

    const inputAfter = container.querySelector('input[type=password]');
    expect(inputAfter).not.toBeNull();
    expect(inputAfter).toBe(inputBefore);
    expect(document.body.contains(inputAfter)).toBe(true);
  });

  it('parks the input in the document instead of removing it when unclaimed', () => {
    const { container } = render(
      <PasswordVaultProvider>
        <Toggle initial="a" />
      </PasswordVaultProvider>
    );
    const input = container.querySelector('input[type=password]');
    expect(input).not.toBeNull();

    fireEvent.click(screen.getByText('show none'));

    expect(document.body.contains(input)).toBe(true);
  });

  it('destroys parked slots once the route leaves the auth flow', () => {
    const { rerender, container } = render(
      <PasswordVaultProvider>
        <Toggle initial="a" />
      </PasswordVaultProvider>
    );
    const input = container.querySelector('input[type=password]');
    expect(input).not.toBeNull();
    expect(document.body.contains(input)).toBe(true);

    fireEvent.click(screen.getByText('show none'));
    expect(document.body.contains(input)).toBe(true);

    mockPathname = '/wallet';
    rerender(
      <PasswordVaultProvider>
        <Toggle initial="a" />
      </PasswordVaultProvider>
    );

    expect(document.body.contains(input)).toBe(false);
  });

  it('falls back to a plain input when rendered without a provider', () => {
    render(<FieldA />);
    const input = screen.getByLabelText('Field A') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.change(input, { target: { value: 'secret' } });
    expect(input.value).toBe('secret');
  });
});
