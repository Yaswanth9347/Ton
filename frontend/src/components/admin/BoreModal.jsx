import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Calculator, Clock, CreditCard, Droplets, Layers, TrendingUp, Zap, CirclePlus, Calendar } from 'lucide-react';

// Helper Components
const InputField = ({ label, name, type = 'text', value, onChange, onBlur, required, readOnly, viewMode, placeholder }) => (
    <div className="form-field">
        <label className="form-field__label">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
            <input
                type={type}
                name={name}
                value={(type === 'number' && value === 0) ? '' : (value ?? '')}
                onChange={onChange}
                onBlur={onBlur}
                onFocus={(e) => type === 'number' && e.target.select()}
                placeholder={placeholder}
                required={required}
                readOnly={readOnly || viewMode}
                disabled={viewMode}
                min={type === 'number' ? "0" : undefined}
                className={`form-field__input ${(readOnly || viewMode) ? 'form-field__input--readonly' : ''} ${type === 'date' ? 'date-input-field' : ''}`}
            />
            {type === 'date' && <Calendar size={16} className="date-icon" />}
        </div>
    </div>
);

const QtyRateAmountRow = ({ label, prefix, data, onChange, viewMode }) => (
    <div className="qty-rate-row">
        <span className="qty-rate-row__label" style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.9rem' }}>{label}</span>
        <input type="number" name={`${prefix}_feet`} value={data[`${prefix}_feet`] === 0 ? '' : (data[`${prefix}_feet`] ?? 0)} onChange={onChange} onFocus={(e) => e.target.select()} disabled={viewMode} min="0" className="qty-rate-row__input" placeholder="0" style={{ textAlign: 'center' }} />
        <input type="number" name={`${prefix}_rate`} value={data[`${prefix}_rate`] === 0 ? '' : (data[`${prefix}_rate`] ?? 0)} onChange={onChange} onFocus={(e) => e.target.select()} disabled={viewMode} min="0" className="qty-rate-row__input" placeholder="0" style={{ textAlign: 'center' }} />
        <input type="number" value={data[`${prefix}_amt`] === 0 ? '' : (data[`${prefix}_amt`] ?? 0)} readOnly min="0" className={`qty-rate-row__input qty-rate-row__input--readonly`} placeholder="0" style={{ textAlign: 'center' }} />
    </div>
);

export default function BoreModal({ isOpen, onClose, record, onSave, saving, viewMode = false }) {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (record) {
            const data = { ...record };
            if (data.date) {
                data.date = new Date(data.date).toISOString().split('T')[0];
            }
            // Parse pipe_details if it's a string
            if (typeof data.pipe_details === 'string') {
                try { data.pipe_details = JSON.parse(data.pipe_details); } catch (e) { data.pipe_details = {}; }
            }
            setFormData(data);
        } else {
            setFormData({
                date: new Date().toISOString().split('T')[0],
                bore_type: '6 1/2"',
                pipe_details: {},
                drill_upto_casing_feet: 0, drill_upto_casing_rate: 0, drill_upto_casing_amt: 0,
                empty_drilling_feet: 0, empty_drilling_rate: 0, empty_drilling_amt: 0,
                jump_300_feet: 0, jump_300_rate: 0, jump_300_amt: 0,
                jump_400_feet: 0, jump_400_rate: 0, jump_400_amt: 0,
                cas140_feet: 0, cas140_rate: 0, cas140_amt: 0,
                cas180_4g_feet: 0, cas180_4g_rate: 0, cas180_4g_amt: 0,
                cas180_6g_feet: 0, cas180_6g_rate: 0, cas180_6g_amt: 0,
                cas250_4g_feet: 0, cas250_4g_rate: 0, cas250_4g_amt: 0,
                slotting_pipes: 0, slotting_rate: 0, slotting_amt: 0,
                pipes_on_vehicle_before: 0, pipes_used_qty: 0, pipes_used_pieces_ft: 0, pipes_left_on_vehicle: 0,
                labour_charge: 0, rpm: 0,
                phone_pe_received: 0, cash_paid: 0, total_amount: 0, amount_paid: 0, balance: 0, discount: 0
            });
        }
    }, [record, isOpen]);

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        let val = type === 'number' ? Math.max(0, parseFloat(value) || 0) : value;

        setFormData(prev => {
            const updated = { ...prev, [name]: val };

            // Auto-calculate sub-amounts (Rate * Qty/Feet)
            // Auto-calculate sub-amounts (Rate * Qty/Feet)
            if (name.endsWith('_feet') || name.endsWith('_rate') || name === 'slotting_pipes') {
                const base = name.split('_')[0];
                if (base === 'drill' || base === 'empty' || base === 'jump' || base === 'cas140' || base === 'cas180' || base === 'cas250' || base === 'slotting') {
                    let prefix = '';
                    if (name.startsWith('drill_upto_casing')) prefix = 'drill_upto_casing';
                    else if (name.startsWith('empty_drilling')) prefix = 'empty_drilling';
                    else if (name.startsWith('jump_300')) prefix = 'jump_300';
                    else if (name.startsWith('jump_400')) prefix = 'jump_400';
                    else if (name.startsWith('cas140')) prefix = 'cas140';
                    else if (name.startsWith('cas180_4g')) prefix = 'cas180_4g';
                    else if (name.startsWith('cas180_6g')) prefix = 'cas180_6g';
                    else if (name.startsWith('cas250_4g')) prefix = 'cas250_4g';
                    else if (name.startsWith('slotting')) prefix = 'slotting';

                    if (prefix) {
                        const qty = parseFloat(updated[`${prefix}_${prefix === 'slotting' ? 'pipes' : 'feet'}`]) || 0;
                        const rate = parseFloat(updated[`${prefix}_rate`]) || 0;
                        updated[`${prefix}_amt`] = (qty * rate);
                    }
                }
            }

            // Numeric Calculations - Force parseFloat to prevent string concatenation bug
            const getNum = (key) => parseFloat(updated[key]) || 0;

            updated.total_drilling_feet = getNum('drill_upto_casing_feet') + getNum('empty_drilling_feet') + getNum('jump_300_feet') + getNum('jump_400_feet');
            updated.total_drilling_amt = getNum('drill_upto_casing_amt') + getNum('empty_drilling_amt') + getNum('jump_300_amt') + getNum('jump_400_amt');

            updated.total_casing_feet = getNum('cas140_feet') + getNum('cas180_4g_feet') + getNum('cas180_6g_feet') + getNum('cas250_4g_feet');
            updated.total_casing_amt = getNum('cas140_amt') + getNum('cas180_4g_amt') + getNum('cas180_6g_amt') + getNum('cas250_4g_amt');

            // Pipes Left
            updated.pipes_left_on_vehicle = getNum('pipes_on_vehicle_before') - getNum('pipes_used_qty');

            // Total Global Amount
            updated.total_amount = getNum('total_drilling_amt') + getNum('total_casing_amt') + getNum('slotting_amt') + getNum('labour_charge');

            // Amount Paid & Balance
            updated.amount_paid = getNum('phone_pe_received') + getNum('cash_paid');
            updated.balance = getNum('total_amount') - getNum('discount') - getNum('amount_paid');

            // Time Log
            if (name === 'start_time' || name === 'end_time') {
                const diff = getNum('end_time') - getNum('start_time');
                updated.total_hrs = diff > 0 ? diff : 0;
            }

            return updated;
        });
    };

    const handlePipeDetailChange = (key, val) => {
        setFormData(prev => ({
            ...prev,
            pipe_details: { ...prev.pipe_details, [key]: val }
        }));
    };


    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="govt-bore-modal-overlay" onClick={onClose}>
            <div className={`govt-bore-modal govt-bore-modal--wide`} onClick={(e) => e.stopPropagation()}>
                <div className="govt-bore-modal__header">
                    <h2 className="govt-bore-modal__title">
                        {viewMode ? 'View Private Bore Details' : (record ? 'Edit Private Bore Entry' : 'Add New Private Bore Entry')}
                    </h2>
                    <button onClick={onClose} className="govt-bore-modal__close">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="govt-bore-modal__form">
                    <div className="govt-bore-modal__scroll">
                        {/* Project Information */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">
                                Project Information
                            </h3>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                                <InputField label="Village" name="village" value={formData.village} onChange={handleChange} viewMode={viewMode} placeholder="Enter Village" />
                                <InputField label="Point / Supervisor" name="supervisor_name" value={formData.supervisor_name} onChange={handleChange} viewMode={viewMode} placeholder="Enter Point / Supervisor" />
                                <InputField label="Customer Name" name="customer_name" value={formData.customer_name} onChange={handleChange} required viewMode={viewMode} placeholder="Enter Customer Name" />

                                <div className="form-field">
                                    <label className="form-field__label">Vehicle</label>
                                    <select name="vehicle_name" value={formData.vehicle_name} onChange={handleChange} disabled={viewMode} className="form-field__input">
                                        <option value="">Select Vehicle</option>
                                        <option value='4 1/2" Tyre'>4 ½" Tyre</option>
                                        <option value='6 1/2" Tyre'>6 ½" Tyre</option>
                                        <option value='10 Tyre'>10 Tyre</option>
                                    </select>
                                </div>
                                <InputField label="Phone Number" name="phone_number" value={formData.phone_number} onChange={handleChange} viewMode={viewMode} placeholder="Enter Phone Number" />
                                <InputField label="Date" name="date" type="date" value={formData.date} onChange={handleChange} required viewMode={viewMode} />

                                <div className="form-field">
                                    <label className="form-field__label">Bore Type</label>
                                    <select name="bore_type" value={formData.bore_type} onChange={handleChange} disabled={viewMode} className="form-field__input">
                                        <option value='4 1/2"'>4 1/2" Bore</option>
                                        <option value='6 1/2"'>6 1/2" Bore</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Drilling & Casing */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">
                                Drilling
                            </h3>

                            <div className="qty-rate-table">
                                <div className="qty-rate-table__header">
                                    <span>TYPE</span>
                                    <span style={{ textAlign: 'center' }}>FEET</span>
                                    <span style={{ textAlign: 'center' }}>RATE</span>
                                    <span style={{ textAlign: 'center' }}>AMOUNT</span>
                                </div>
                                <QtyRateAmountRow label="Drilling upto Casing" prefix="drill_upto_casing" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="Empty Drilling" prefix="empty_drilling" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="Jump after 300ft" prefix="jump_300" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="Jump after 400ft" prefix="jump_400" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <div className="qty-rate-row" style={{ background: 'var(--bg-tertiary)', borderTop: 'none', borderRadius: '4px', marginTop: '4px' }}>
                                    <span style={{ fontWeight: '700', paddingLeft: '8px' }}>Total Drilling</span>
                                    <input type="number" readOnly value={formData.total_drilling_feet || 0} className="qty-rate-row__input qty-rate-row__input--readonly" style={{ textAlign: 'center' }} />
                                    <span></span>
                                    <input type="number" readOnly value={formData.total_drilling_amt || 0} className="qty-rate-row__input qty-rate-row__input--readonly" style={{ textAlign: 'center', color: 'var(--color-primary)', fontWeight: '700' }} />
                                </div>
                            </div>
                        </div>

                        {/* Casing Details */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">
                                Casing Details
                            </h3>

                            <div className="qty-rate-table">
                                <div className="qty-rate-table__header">
                                    <span>TYPE</span>
                                    <span style={{ textAlign: 'center' }}>PER FEET</span>
                                    <span style={{ textAlign: 'center' }}>RATE</span>
                                    <span style={{ textAlign: 'center' }}>AMOUNT</span>
                                </div>
                                <QtyRateAmountRow label="140mm (5 inches)" prefix="cas140" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="180mm (7 inches)" prefix="cas180_4g" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="180mm 6G" prefix="cas180_6g" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="250mm (10 inches)" prefix="cas250_4g" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <div className="qty-rate-row" style={{ background: 'var(--bg-tertiary)', borderTop: 'none', borderRadius: '4px', marginTop: '4px' }}>
                                    <span style={{ fontWeight: '700', paddingLeft: '8px' }}>Total Casing</span>
                                    <input type="number" readOnly value={formData.total_casing_feet || 0} className="qty-rate-row__input qty-rate-row__input--readonly" style={{ textAlign: 'center' }} />
                                    <span></span>
                                    <input type="number" readOnly value={formData.total_casing_amt || 0} className="qty-rate-row__input qty-rate-row__input--readonly" style={{ textAlign: 'center', color: 'var(--color-primary)', fontWeight: '700' }} />
                                </div>
                            </div>
                        </div>

                        {/* 4. Slotting & Additional Charges */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">
                                Slotting & Additional Charges
                            </h3>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                                <InputField label="No. of Pipes (Slotting)" name="slotting_pipes" type="number" value={formData.slotting_pipes} onChange={handleChange} viewMode={viewMode} />
                                <InputField label="Slotting Rate" name="slotting_rate" type="number" value={formData.slotting_rate} onChange={handleChange} viewMode={viewMode} />
                                <InputField label="Slotting Total (₹)" name="slotting_amt" type="number" value={formData.slotting_amt} readOnly viewMode={viewMode} />
                                <InputField label="Labour Charge (₹)" name="labour_charge" type="number" value={formData.labour_charge} onChange={handleChange} viewMode={viewMode} />
                                <InputField label="RPM / Other" name="rpm" type="number" value={formData.rpm} onChange={handleChange} viewMode={viewMode} />
                            </div>
                        </div>

                        {/* 5. Pipes Inventory */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">
                                Pipes Tracking
                            </h3>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--4">
                                <InputField label="Pipes on Vehicle (Before)" name="pipes_on_vehicle_before" type="number" value={formData.pipes_on_vehicle_before} onChange={handleChange} viewMode={viewMode} />
                                <InputField label="Pipes Used (Nos)" name="pipes_used_qty" type="number" value={formData.pipes_used_qty} onChange={handleChange} viewMode={viewMode} />
                                <InputField label="Pipes Used (Piece ft)" name="pipes_used_pieces_ft" type="number" value={formData.pipes_used_pieces_ft} onChange={handleChange} viewMode={viewMode} />
                                <InputField label="Pipes Left (Auto)" name="pipes_left_on_vehicle" type="number" value={formData.pipes_left_on_vehicle} readOnly viewMode={viewMode} />
                            </div>
                            <div style={{ marginTop: '20px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: 'var(--text-secondary)' }}>Additional Info (7", 10", 5", etc.)</h4>
                                <div className="govt-bore-modal__grid govt-bore-modal__grid--4">
                                    <InputField label="Company Name" value={formData.pipe_details?.company || ''} onChange={(e) => handlePipeDetailChange('company', e.target.value)} viewMode={viewMode} />
                                    {['7"', '10"', '5"'].map(size => (
                                        <InputField key={size} label={`${size} Pipes`} value={formData.pipe_details?.[size] || ''} onChange={(e) => handlePipeDetailChange(size, e.target.value)} viewMode={viewMode} placeholder="e.g. 5+ (in inches)" />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 6. Time Tracking */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">
                                Time Log
                            </h3>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                                <InputField label="Start Time" name="start_time" type="number" value={formData.start_time} onChange={handleChange} viewMode={viewMode} />
                                <InputField label="End Time" name="end_time" type="number" value={formData.end_time} onChange={handleChange} viewMode={viewMode} />
                                <InputField label="Total Hours" name="total_hrs" type="number" value={formData.total_hrs} readOnly viewMode={viewMode} />
                            </div>
                        </div>

                        {/* 7. Payment Summary */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">
                                Payment Summary
                            </h3>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div className="govt-bore-modal__grid govt-bore-modal__grid--fixed-2">
                                        <InputField label="PhonePe Received" name="phone_pe_received" type="number" value={formData.phone_pe_received} onChange={handleChange} viewMode={viewMode} />
                                        <InputField label="Transferred To (Name)" name="phone_pe_receiver_name" value={formData.phone_pe_receiver_name} onChange={handleChange} viewMode={viewMode} />
                                        <InputField label="Cash Paid" name="cash_paid" type="number" value={formData.cash_paid} onChange={handleChange} viewMode={viewMode} />
                                        <InputField label="Discount" name="discount" type="number" value={formData.discount} onChange={handleChange} viewMode={viewMode} />
                                    </div>
                                </div>
                                <div className="bore-modal__payment-card">
                                    <div className="payment-item"><span>Net Amount:</span> <strong>₹{(formData.total_amount || 0).toLocaleString()}</strong></div>
                                    <div className="payment-item"><span>Amount Paid:</span> <strong>₹{(formData.amount_paid || 0).toLocaleString()}</strong></div>
                                    <div className="payment-item payment-item--balance"><span>Balance:</span> <strong>₹{(formData.balance || 0).toLocaleString()}</strong></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="govt-bore-modal__actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        {!viewMode && (
                            <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {saving ? 'Saving...' : <><Save size={18} /> {record ? 'Update Record' : 'Save Record'}</>}
                            </button>
                        )}
                    </div>
                </form>
            </div >
        </div >,
        document.body
    );
};
