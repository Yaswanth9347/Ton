import React from 'react';

export function ConfirmDialog({ title = "Confirm Action", message, onConfirm, onCancel }) {
    return (
        <div className="inv-modal-overlay">
            <div className="inv-confirm" onClick={e => e.stopPropagation()}>
                <div className="inv-confirm__title">{title}</div>
                <p className="inv-confirm__msg">{message}</p>
                <div className="inv-confirm__actions">
                    <button className="inv-btn inv-btn--secondary" onClick={onCancel}>Cancel</button>
                    <button className="inv-btn inv-btn--danger" onClick={onConfirm}>Confirm</button>
                </div>
            </div>
        </div>
    );
}
