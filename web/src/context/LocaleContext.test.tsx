import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocaleProvider, useLocale } from './LocaleContext';

function LocaleConsumer() {
  const { locale, t, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="label">{t.tabs_wallet}</span>
      <button onClick={() => setLocale('en-US')}>switch-en</button>
      <button onClick={() => setLocale('ar-SA')}>switch-ar</button>
      <button onClick={() => setLocale('fr-FR')}>switch-fr</button>
    </div>
  );
}

function stubBrowserLanguages(languages: string[]) {
  vi.stubGlobal('navigator', { ...navigator, language: languages[0] ?? '', languages });
}

describe('LocaleContext', () => {
  beforeEach(() => {
    localStorage.clear();
    stubBrowserLanguages(['pt-BR']);
  });
  afterEach(() => {
    localStorage.clear();
    document.documentElement.dir = '';
    document.documentElement.lang = '';
    vi.unstubAllGlobals();
  });

  it('defaults to pt-BR when localStorage is empty and the browser reports pt-BR', () => {
    render(<LocaleProvider><LocaleConsumer /></LocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('pt-BR');
    expect(screen.getByTestId('label').textContent).toBe('Carteira');
  });

  it('restores locale from localStorage on mount, overriding browser language', () => {
    stubBrowserLanguages(['en-US']);
    localStorage.setItem('crypto-assist:locale', 'fr-FR');
    render(<LocaleProvider><LocaleConsumer /></LocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('fr-FR');
    expect(screen.getByTestId('label').textContent).toBe('Portefeuille');
  });

  it('persists locale to localStorage when setLocale is called', () => {
    render(<LocaleProvider><LocaleConsumer /></LocaleProvider>);
    fireEvent.click(screen.getByText('switch-en'));
    expect(localStorage.getItem('crypto-assist:locale')).toBe('en-US');
    expect(screen.getByTestId('locale').textContent).toBe('en-US');
  });

  it('sets document dir to rtl for ar-SA', () => {
    render(<LocaleProvider><LocaleConsumer /></LocaleProvider>);
    fireEvent.click(screen.getByText('switch-ar'));
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets document dir back to ltr when switching away from ar-SA', () => {
    localStorage.setItem('crypto-assist:locale', 'ar-SA');
    render(<LocaleProvider><LocaleConsumer /></LocaleProvider>);
    expect(document.documentElement.dir).toBe('rtl');
    fireEvent.click(screen.getByText('switch-fr'));
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('falls back to pt-BR for an unknown stored locale', () => {
    localStorage.setItem('crypto-assist:locale', 'xx-XX');
    render(<LocaleProvider><LocaleConsumer /></LocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('pt-BR');
  });

  it('picks up an exact supported browser locale (de-DE) with no stored preference', () => {
    stubBrowserLanguages(['de-DE']);
    render(<LocaleProvider><LocaleConsumer /></LocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('de-DE');
  });

  it('matches a supported locale by language-only subtag (en-GB -> en-US)', () => {
    stubBrowserLanguages(['en-GB']);
    render(<LocaleProvider><LocaleConsumer /></LocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('en-US');
  });

  it('walks navigator.languages in priority order past unsupported entries', () => {
    stubBrowserLanguages(['nl-NL', 'ja-JP', 'en-US']);
    render(<LocaleProvider><LocaleConsumer /></LocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('ja-JP');
  });

  it('falls back to pt-BR when no browser language is supported', () => {
    stubBrowserLanguages(['nl-NL', 'sv-SE']);
    render(<LocaleProvider><LocaleConsumer /></LocaleProvider>);
    expect(screen.getByTestId('locale').textContent).toBe('pt-BR');
  });
});
