import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TermsPage from './terms';

describe('TermsPage', () => {
  it('renders the terms heading and a link to the privacy policy', () => {
    render(<TermsPage />);
    expect(screen.getByRole('heading', { name: /termos de uso/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /política de privacidade/i }).getAttribute('href')).toBe('/privacy');
  });
});
