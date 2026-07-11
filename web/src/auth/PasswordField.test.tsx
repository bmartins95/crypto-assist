import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import PasswordField from './PasswordField';

function Harness({ autoComplete = 'current-password' }: { autoComplete?: string }) {
  const [value, setValue] = useState('');
  return <PasswordField label="Senha" value={value} onChange={setValue} autoComplete={autoComplete} />;
}

function getInput(): HTMLInputElement {
  return screen.getByLabelText('Senha') as HTMLInputElement;
}

function fireBeforeInput(input: HTMLInputElement, data = 'a', inputType = 'insertText') {
  fireEvent(input, new InputEvent('beforeinput', { bubbles: true, cancelable: true, data, inputType }));
}

function stubMaskingSupport(supported: boolean) {
  // jsdom's CSS global has no supports() at all, so emulate a browser that does
  // (or doesn't) support -webkit-text-security to exercise both branches.
  vi.stubGlobal('CSS', { supports: vi.fn(() => supported) });
}

describe('PasswordField', () => {
  beforeEach(() => {
    stubMaskingSupport(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts as a real password input so browser autofill works', () => {
    render(<Harness />);
    const input = getInput();
    expect(input.type).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('current-password');
  });

  it('replaces the password element with a fresh masked text element on the first keystroke', () => {
    render(<Harness />);
    const before = getInput();
    fireBeforeInput(before, 's');
    const after = getInput();
    expect(after).not.toBe(before);
    expect(after.type).toBe('text');
    expect(after.classList.contains('auth-inp-masked')).toBe(true);
    expect(after.getAttribute('autocomplete')).toBe('off');
    expect(after.value).toBe('s');
  });

  it('never lets the intercepted character land in the password element', () => {
    render(<Harness />);
    const input = getInput();
    const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: 's', inputType: 'insertText' });
    fireEvent(input, event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('accepts continued typing through the masked element', () => {
    render(<Harness />);
    fireBeforeInput(getInput(), 's');
    fireEvent.change(getInput(), { target: { value: 'secret123' } });
    const input = getInput();
    expect(input.value).toBe('secret123');
    expect(input.type).toBe('text');
  });

  it('inserts pasted text via the masked element', () => {
    render(<Harness />);
    fireBeforeInput(getInput(), 'pasted-secret', 'insertFromPaste');
    const input = getInput();
    expect(input.type).toBe('text');
    expect(input.value).toBe('pasted-secret');
  });

  it('returns to a fresh password element when the value is fully cleared', () => {
    render(<Harness />);
    fireBeforeInput(getInput(), 's');
    const masked = getInput();
    fireEvent.change(masked, { target: { value: '' } });
    const restored = getInput();
    expect(restored).not.toBe(masked);
    expect(restored.type).toBe('password');
    expect(restored.getAttribute('autocomplete')).toBe('current-password');
  });

  it('clears an autofilled value instead of editing it in place on deletion', () => {
    const onChange = vi.fn();
    render(<PasswordField label="Senha" value="Autofilled1" onChange={onChange} />);
    const input = getInput();
    fireEvent(input, new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(input.type).toBe('password');
  });

  it('leaves the password element untouched when masking is unsupported', () => {
    stubMaskingSupport(false);
    render(<Harness />);
    const before = getInput();
    const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: 's', inputType: 'insertText' });
    fireEvent(before, event);
    expect(event.defaultPrevented).toBe(false);
    expect(getInput()).toBe(before);
    expect(getInput().type).toBe('password');
  });

  it('lets IME composition fall through to the password element', () => {
    render(<Harness />);
    const input = getInput();
    const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: 'あ', inputType: 'insertCompositionText' });
    fireEvent(input, event);
    expect(event.defaultPrevented).toBe(false);
    expect(getInput().type).toBe('password');
  });

  it('syncs React state when Chrome autofills without an input event', () => {
    render(<Harness />);
    const input = getInput();
    input.value = 'Autofilled1';
    fireEvent.animationStart(input, { animationName: 'auth-autofill-detect' });
    expect(input.value).toBe('Autofilled1');
    expect(input.type).toBe('password');
  });

  it('renders an error message associated with the input', () => {
    render(<PasswordField label="Senha" value="" onChange={() => {}} error="Campo obrigatório" />);
    const input = getInput();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Campo obrigatório');
  });
});
