import { useLocale } from '@/context/LocaleContext';
import { evaluatePasswordRules, computePasswordStrength, type PasswordRuleKey } from './passwordPolicy';

interface PasswordRequirementsProps {
  password: string;
}

const STRENGTH_COLORS = ['var(--danger)', '#f97316', '#eab308', 'var(--s-accent)'];

export default function PasswordRequirements({ password }: PasswordRequirementsProps) {
  const { t } = useLocale();

  // Emptiness check on the in-progress form value, not a secret comparison — not a
  // timing-attack surface.
  // eslint-disable-next-line security/detect-possible-timing-attacks
  if (password === '') return null;

  const rules = evaluatePasswordRules(password);
  // rules always has 5 entries here (password is non-empty, guarded above), so
  // computePasswordStrength — which only returns null for an empty rule set — always
  // resolves to a real level.
  const level = computePasswordStrength(rules)!.level;

  const ruleLabels: Record<PasswordRuleKey, string> = {
    length: t.auth_password_rule_length,
    uppercase: t.auth_password_rule_uppercase,
    lowercase: t.auth_password_rule_lowercase,
    number: t.auth_password_rule_number,
    special: t.auth_password_rule_special,
  };

  const strengthLabels = [
    t.auth_password_strength_weak,
    t.auth_password_strength_fair,
    t.auth_password_strength_good,
    t.auth_password_strength_strong,
  ];

  return (
    <div className="auth-password-requirements">
      <div className="auth-strength-bars">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="auth-strength-bar"
            style={{ background: i <= level ? STRENGTH_COLORS[level] : undefined }}
          />
        ))}
      </div>
      <div className="auth-strength-label" style={{ color: STRENGTH_COLORS[level] }}>
        {strengthLabels[level]}
      </div>
      <div className="auth-password-rules" role="status" aria-live="polite">
        {rules.map(rule => (
          <div key={rule.key} className={rule.met ? 'auth-rule auth-rule-met' : 'auth-rule'}>
            <span className="auth-rule-icon">{rule.met ? '✓' : '○'}</span>
            {ruleLabels[rule.key]}
          </div>
        ))}
      </div>
    </div>
  );
}
