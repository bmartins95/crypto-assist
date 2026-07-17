import { describe, it, expect } from 'vitest';
import { evaluatePasswordRules, computePasswordStrength, isPasswordValid } from './passwordPolicy';

describe('evaluatePasswordRules', () => {
  it('reports length unmet under 8 characters and met at 8 or more', () => {
    expect(evaluatePasswordRules('Abc123!').find(r => r.key === 'length')?.met).toBe(false);
    expect(evaluatePasswordRules('Abc123!!').find(r => r.key === 'length')?.met).toBe(true);
  });

  it('reports uppercase unmet without an uppercase letter and met with one', () => {
    expect(evaluatePasswordRules('abc12345!').find(r => r.key === 'uppercase')?.met).toBe(false);
    expect(evaluatePasswordRules('Abc12345!').find(r => r.key === 'uppercase')?.met).toBe(true);
  });

  it('reports lowercase unmet without a lowercase letter and met with one', () => {
    expect(evaluatePasswordRules('ABC12345!').find(r => r.key === 'lowercase')?.met).toBe(false);
    expect(evaluatePasswordRules('ABc12345!').find(r => r.key === 'lowercase')?.met).toBe(true);
  });

  it('reports number unmet without a digit and met with one', () => {
    expect(evaluatePasswordRules('Abcdefgh!').find(r => r.key === 'number')?.met).toBe(false);
    expect(evaluatePasswordRules('Abcdefg1!').find(r => r.key === 'number')?.met).toBe(true);
  });

  it('reports special unmet without a special character and met with one', () => {
    expect(evaluatePasswordRules('Abcdefg1').find(r => r.key === 'special')?.met).toBe(false);
    expect(evaluatePasswordRules('Abcdefg1!').find(r => r.key === 'special')?.met).toBe(true);
  });

  it('returns all 5 rules for an empty password, all unmet', () => {
    const rules = evaluatePasswordRules('');
    expect(rules).toHaveLength(5);
    expect(rules.every(r => !r.met)).toBe(true);
  });
});

describe('isPasswordValid', () => {
  it('is false when any rule is unmet', () => {
    expect(isPasswordValid('abc12345!')).toBe(false); // missing uppercase
  });

  it('is true only when every rule is met', () => {
    expect(isPasswordValid('Abcdefg1!')).toBe(true);
  });
});

describe('computePasswordStrength', () => {
  it('returns null for an empty rule set', () => {
    expect(computePasswordStrength([])).toBeNull();
  });

  it('returns level 0 (weak) for 0-2 met rules', () => {
    expect(computePasswordStrength(evaluatePasswordRules(''))?.level).toBe(0);
    expect(computePasswordStrength(evaluatePasswordRules('abc'))?.level).toBe(0); // lowercase only
  });

  it('returns level 1 (fair) for exactly 3 met rules', () => {
    expect(computePasswordStrength(evaluatePasswordRules('Abcdefgh'))?.level).toBe(1); // length+upper+lower
  });

  it('returns level 2 (good) for exactly 4 met rules', () => {
    expect(computePasswordStrength(evaluatePasswordRules('Abcdefg1'))?.level).toBe(2); // length+upper+lower+number
  });

  it('returns level 3 (strong) when all 5 rules are met', () => {
    expect(computePasswordStrength(evaluatePasswordRules('Abcdefg1!'))?.level).toBe(3);
  });
});
