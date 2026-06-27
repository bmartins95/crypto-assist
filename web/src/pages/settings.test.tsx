import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from './settings';
import { LocaleProvider } from '@/context/LocaleContext';

const STORAGE_KEY = 'crypto-assist:locale';

function renderSettings() {
  return render(<LocaleProvider><SettingsPage /></LocaleProvider>);
}

describe('SettingsPage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('renders all 10 locale options in the language picker', () => {
    renderSettings();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(10);
  });

  it('has a label associated with the language select', () => {
    renderSettings();
    expect(screen.getByLabelText(/idioma/i)).toBeInTheDocument();
  });

  it('persists the selected locale to localStorage', () => {
    renderSettings();
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'en-US' } });
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en-US');
  });

  it('updates the select value when locale changes', () => {
    renderSettings();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'de-DE' } });
    expect(select.value).toBe('de-DE');
  });
});
