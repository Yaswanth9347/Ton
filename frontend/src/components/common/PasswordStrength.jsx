import { useMemo } from 'react';
import { Check, X } from 'lucide-react';

const RULES = [
    { key: 'length', label: '8+ chars', test: (v) => v.length >= 8 },
    { key: 'upper', label: 'Uppercase', test: (v) => /[A-Z]/.test(v) },
    { key: 'lower', label: 'Lowercase', test: (v) => /[a-z]/.test(v) },
    { key: 'digit', label: 'Number', test: (v) => /\d/.test(v) },
    { key: 'special', label: 'Special char', test: (v) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(v) },
];

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

/**
 * Visual password strength meter with requirement checklist.
 * Shows nothing when password is empty.
 */
export function PasswordStrength({ password = '' }) {
    const { score, results } = useMemo(() => {
        if (!password) return { score: 0, results: RULES.map((r) => ({ ...r, met: false })) };
        const results = RULES.map((r) => ({ ...r, met: r.test(password) }));
        const score = results.filter((r) => r.met).length;
        return { score, results };
    }, [password]);

    if (!password) return null;

    // Map 5-point score to 4-level display (combine length+lower into level 1)
    const level = score <= 1 ? 1 : score <= 2 ? 2 : score <= 3 ? 3 : score >= 4 ? 4 : 3;

    return (
        <div className="password-strength">
            <div className="password-strength-bar">
                <div className={`password-strength-fill strength-${level}`} />
            </div>
            <span className={`password-strength-label strength-${level}`}>
                {STRENGTH_LABELS[level]}
            </span>
            <ul className="password-rules">
                {results.map((r) => (
                    <li key={r.key} className={r.met ? 'met' : ''}>
                        <span className="rule-icon">
                            {r.met ? <Check size={12} /> : <X size={12} />}
                        </span>
                        {r.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}
