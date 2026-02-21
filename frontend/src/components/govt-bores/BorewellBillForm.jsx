import { useState, useEffect } from 'react';
import { X, Receipt, CreditCard, Calculator } from 'lucide-react';

const initialBillData = {
    total_bill_amount: '',
    first_part_amount: '',
    second_part_amount: '',
    it_amount: '',
    vat_amount: '',
    total_recoveries: '',
    net_amount: '',
    voucher_no: '',
    cheque_no: '',
    cheque_date: '',
};

export default function BorewellBillForm({ record, onClose, onSave, saving }) {
    const [formData, setFormData] = useState(initialBillData);

    useEffect(() => {
        if (record) {
            // Populate from flattened BorewellWork record
            setFormData({
                total_bill_amount: record.total_bill_amount || '',
                first_part_amount: record.first_part_amount || '',
                second_part_amount: record.second_part_amount || '',
                it_amount: record.it_amount || '',
                vat_amount: record.vat_amount || '',
                total_recoveries: record.total_recoveries || '',
                net_amount: record.net_amount || '',
                voucher_no: record.voucher_no || '',
                cheque_no: record.cheque_no || '',
                cheque_date: record.cheque_date
                    ? new Date(record.cheque_date).toISOString().split('T')[0]
                    : '',
            });
        }
    }, [record]);

    // Auto-calculate recoveries and net amount
    useEffect(() => {
        const it = parseFloat(formData.it_amount) || 0;
        const vat = parseFloat(formData.vat_amount) || 0;
        const totalRecoveries = it + vat;
        const billAmount = parseFloat(formData.total_bill_amount) || 0;
        const netAmount = billAmount - totalRecoveries;

        setFormData(prev => ({
            ...prev,
            total_recoveries: totalRecoveries || '',
            net_amount: netAmount || '',
        }));
    }, [formData.it_amount, formData.vat_amount, formData.total_bill_amount]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    const InputField = ({ label, name, type = 'text', readOnly = false }) => (
        <div className="form-field">
            <label className="form-field__label">{label}</label>
            <input
                type={type}
                name={name}
                value={formData[name]}
                onChange={handleChange}
                readOnly={readOnly}
                className={`form-field__input ${readOnly ? 'form-field__input--readonly' : ''}`}
            />
        </div>
    );

    return (
        <div className="govt-bore-modal-overlay">
            <div className="govt-bore-modal">
                <div className="govt-bore-modal__header">
                    <h2 className="govt-bore-modal__title">
                        <Receipt size={20} style={{ marginRight: '8px' }} />
                        Bill Details - {record?.village?.name || 'Record'}
                    </h2>
                    <button onClick={onClose} className="govt-bore-modal__close">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="govt-bore-modal__form">
                    {/* Bill Amounts */}
                    <div className="govt-bore-modal__section">
                        <h3 className="govt-bore-modal__section-title">
                            <Calculator size={18} /> Bill Amount Breakdown
                        </h3>
                        <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                            <InputField label="Total Bill Amount (TVW)" name="total_bill_amount" type="number" />
                            <InputField label="First Part" name="first_part_amount" type="number" />
                            <InputField label="Second Part" name="second_part_amount" type="number" />
                        </div>
                    </div>

                    {/* Recoveries */}
                    <div className="govt-bore-modal__section">
                        <div className="govt-bore-modal__subsection">
                            <h4>STATUTORY RECOVERIES</h4>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                                <InputField label="IT (2.3%)" name="it_amount" type="number" />
                                <InputField label="VAT (5%)" name="vat_amount" type="number" />
                                <InputField label="Total Recoveries" name="total_recoveries" type="number" readOnly />
                            </div>
                        </div>
                    </div>

                    {/* Net & Payment */}
                    <div className="govt-bore-modal__section">
                        <h3 className="govt-bore-modal__section-title">
                            <CreditCard size={18} /> Payment Information
                        </h3>
                        <div className="govt-bore-modal__grid govt-bore-modal__grid--2">
                            <div className="form-field">
                                <label className="form-field__label">Net Amount</label>
                                <input
                                    type="number"
                                    name="net_amount"
                                    value={formData.net_amount}
                                    readOnly
                                    className="form-field__input form-field__input--readonly"
                                    style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-success)' }}
                                />
                            </div>
                            <InputField label="Voucher No" name="voucher_no" />
                            <InputField label="Cheque No" name="cheque_no" />
                            <InputField label="Cheque Date" name="cheque_date" type="date" />
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="govt-bore-modal__total-row">
                        <span>NET PAYABLE</span>
                        <span className="govt-bore-modal__total-value">
                            ₹{parseFloat(formData.net_amount || 0).toLocaleString('en-IN')}
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="govt-bore-modal__actions">
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving} className="btn btn-primary">
                            {saving ? 'Saving...' : 'Update Bill'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
