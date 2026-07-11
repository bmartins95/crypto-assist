import '@testing-library/jest-dom/vitest';

// jsdom defaults navigator.language to 'en-US', which would silently flip every
// test's default locale away from pt-BR now that LocaleContext detects the browser
// language. Pin it so existing tests keep seeing the app's actual default; tests that
// specifically exercise browser-language detection override this per-test.
Object.defineProperty(window.navigator, 'language', { value: 'pt-BR', configurable: true });
Object.defineProperty(window.navigator, 'languages', { value: ['pt-BR'], configurable: true });
