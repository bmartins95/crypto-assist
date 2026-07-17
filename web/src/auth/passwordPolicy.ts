export type PasswordRuleKey = 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';

export interface PasswordRule {
  key: PasswordRuleKey;
  met: boolean;
}

export interface PasswordStrength {
  level: 0 | 1 | 2 | 3;
}

const RULE_TESTS: { key: PasswordRuleKey; test: (password: string) => boolean }[] = [
  { key: 'length', test: p => p.length >= 8 },
  { key: 'uppercase', test: p => /[A-Z]/.test(p) },
  { key: 'lowercase', test: p => /[a-z]/.test(p) },
  { key: 'number', test: p => /[0-9]/.test(p) },
  { key: 'special', test: p => /[^A-Za-z0-9]/.test(p) },
];

export function evaluatePasswordRules(password: string): PasswordRule[] {
  return RULE_TESTS.map(({ key, test }) => ({ key, met: test(password) }));
}

// null only for an empty rule set — evaluatePasswordRules always returns all 5 rules, so
// callers with a non-empty password get a real level even when zero rules are met (e.g. "level 0").
// Whether to display a strength meter at all for an empty password is the caller's decision
// (PasswordRequirements skips rendering entirely when the password itself is empty).
export function computePasswordStrength(rules: PasswordRule[]): PasswordStrength | null {
  if (rules.length === 0) return null;
  const metCount = rules.filter(r => r.met).length;
  const level = metCount <= 2 ? 0 : metCount === 3 ? 1 : metCount === 4 ? 2 : 3;
  return { level };
}

export function isPasswordValid(password: string): boolean {
  return evaluatePasswordRules(password).every(r => r.met);
}
