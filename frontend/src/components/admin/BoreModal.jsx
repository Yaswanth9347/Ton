import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save } from 'lucide-react';

const FIELD_GROUPS = {
    'Job Details': [
        { name: 'date', label: 'Date', type: 'date', required: true },
        { name: 'client_name', label: 'Client Name', type: 'text', required: true },
        { name: 'village', label: 'Village', type: 'text' },
        { name: 'point_name', label: 'Point / Supervisor', type: 'text' },
    ],
    'Drilling Details': [
        { name: 'total_feet', label: 'Total Feet', type: 'number', step: '0.01' },
        { name: 'fell_feet', label: 'Fell Feet', type: 'number', step: '0.01' },
        { name: 'pipes', label: 'No. of Pipes', type: 'number', step: '1' },
    ],
    'Payment Details': [
        { name: 'amount', label: 'Total Amount (₹)', type: 'number', step: '0.01' },
        { name: 'cash', label: 'Cash Received (₹)', type: 'number', step: '0.01' },
        { name: 'phone_pe', label: 'PhonePe Received (₹)', type: 'number', step: '0.01' },
        { name: 'pending', label: 'Pending (₹)', type: 'number', step: '0.01', readOnly: true },
    ],
    'Expenses & Profit': [
        { name: 'diesel', label: 'Diesel (Litres)', type: 'number', step: '0.01' },
        { name: 'diesel_amount', label: 'Diesel Amount (₹)', type: 'number', step: '0.01' },
        { name: 'commission', label: 'Commission (₹)', type: 'number', step: '0.01' },
        { name: 'profit', label: 'Profit (₹)', type: 'number', step: '0.01' },
    ],
};


export default function BoreModal({ isOpen, onClose, record, onSave, saving, viewMode = false }) {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (record) {
            const data = { ...record };
            if (data.date) {
                data.date = new Date(data.date).toISOString().split('T')[0];
            }
            setFormData(data);
        } else {
            setFormData({
                date: new Date().toISOString().split('T')[0],
            });
        }
    }, [record, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const updated = { ...formData, [name]: value };

        // Auto-calculate pending = amount - cash - phone_pe
        if (name === 'amount' || name === 'cash' || name === 'phone_pe') {
            const amount = parseFloat(updated.amount) || 0;
            const cash = parseFloat(updated.cash) || 0;
            const phonePe = parseFloat(updated.phone_pe) || 0;
            updated.pending = (amount - cash - phonePe).toFixed(2);
        }

        setFormData(updated);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="bore-modal-overlay" onClick={onClose}>
            <div className="bore-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bore-modal__header">
                    <h2 className="bore-modal__title">
                        {viewMode ? 'View' : (record ? 'Edit' : 'Add New')} Private Bore Entry
                    </h2>
                    <button className="bore-modal__close" onClick={onClose} title="Close">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bore-modal__form">
                    {Object.entries(FIELD_GROUPS).map(([groupName, fields]) => (
                        <div key={groupName} className="bore-modal__group">
                            <h3 className="bore-modal__group-title">{groupName}</h3>
                            <div className="bore-modal__fields">
                                {fields.map((field) => (
                                    <div key={field.name} className="bore-modal__field">
                                        <label className="bore-modal__label">
                                            {field.label}
                                            {field.required && <span className="bore-modal__required">*</span>}
                                        </label>
                                        <input
                                            type={field.type}
                                            name={field.name}
                                            value={formData[field.name] ?? ''}
                                            onChange={handleChange}
                                            step={field.step}
                                            required={field.required}
                                            readOnly={field.readOnly || viewMode}
                                            disabled={viewMode}
                                            className={`bore-modal__input ${(field.readOnly || viewMode) ? 'bore-modal__input--readonly' : ''}`}
                                            placeholder={field.readOnly ? 'Auto-calculated' : `Enter ${field.label.toLowerCase()}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Footer Actions */}
                    {!viewMode && (
                        <div className="bore-modal__actions">
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Saving...' : (
                                    <><Save size={18} /> {record ? 'Update Record' : 'Save Record'}</>
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>,
        document.body
    );
}
