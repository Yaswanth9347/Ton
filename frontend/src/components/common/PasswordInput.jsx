import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Reusable password input with show/hide toggle.
 * Accepts all standard <input> props via rest spread.
 */
export function PasswordInput({ className = 'form-input', style, ...rest }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="password-input-wrapper" style={{ position: 'relative', ...style }}>
            <input
                {...rest}
                type={visible ? 'text' : 'password'}
                className={className}
                style={{ paddingRight: '2.5rem' }}
            />
            <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setVisible((v) => !v)}
                tabIndex={-1}
                aria-label={visible ? 'Hide password' : 'Show password'}
            >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
        </div>
    );
}
