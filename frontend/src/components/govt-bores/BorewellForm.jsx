import { useState, useEffect, useRef } from 'react';
import { X, Plus, Calculator, AlertCircle, Calendar, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { govtBoreApi } from '../../services/api';
import MiniCalendar from '../common/MiniCalendar';

// --- Constants & Rates ---
// ... (Rates remain same)
// ...

const DateField = ({ label, name, formData, handleChange, viewMode = false, required = false }) => {
    // Helper: YYYY-MM-DD -> DD/MM/YYYY
    const toDisplay = (val) => {
        if (!val) return '';
        const parts = val.split('-');
        if (parts.length !== 3) return '';
        const [y, m, d] = parts;
        if (!y || !m || !d) return '';
        return `${d}/${m}/${y}`;
    };

    // Helper: DD/MM/YYYY -> YYYY-MM-DD
    const toModel = (val) => {
        if (!val || val.length !== 10) return null;
        const parts = val.split('/');
        if (parts.length !== 3) return null;
        const [d, m, y] = parts;
        if (!d || !m || !y) return null;
        return `${y}-${m}-${d}`;
    };

    const [inputValue, setInputValue] = useState(() => toDisplay(formData[name]));
    const [showPicker, setShowPicker] = useState(false);
    const lastPushedValue = useRef(formData[name]);

    // Sync from parent
    useEffect(() => {
        if (formData[name] !== lastPushedValue.current) {
            setInputValue(toDisplay(formData[name]));
            lastPushedValue.current = formData[name];
        }
    }, [formData[name]]);

    const onInputChange = (e) => {
        let val = e.target.value;
        const isDeleting = e.nativeEvent?.inputType === 'deleteContentBackward';

        let digits = val.replace(/\D/g, '');
        if (digits.length > 8) digits = digits.slice(0, 8);

        // Smart Masking
        let formatted = digits;
        if (!isDeleting) {
            if (digits.length >= 2) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
            if (digits.length >= 4) formatted = formatted.slice(0, 5) + '/' + digits.slice(4);
        } else {
            formatted = digits;
            if (digits.length > 2) formatted = formatted.slice(0, 2) + '/' + formatted.slice(2);
            if (digits.length > 4) formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
            if (!isDeleting) {
                if (digits.length === 2) formatted += '/';
                if (digits.length === 4) formatted += '/';
            }
        }

        setInputValue(formatted);

        const modelVal = toModel(formatted);
        if (modelVal) {
            lastPushedValue.current = modelVal;
            handleChange({ target: { name, value: modelVal } });
        } else if (formatted === '') {
            lastPushedValue.current = '';
            handleChange({ target: { name, value: '' } });
        }
    };

    const handleDateSelect = (dateStr) => {
        lastPushedValue.current = dateStr;
        handleChange({ target: { name, value: dateStr } });
        setInputValue(toDisplay(dateStr));
    };

    return (
        <div className="form-field">
            <label className="form-field__label">{label} {required && <span style={{ color: 'red' }}>*</span>}</label>
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    name={name}
                    placeholder="DD/MM/YYYY"
                    value={inputValue}
                    onChange={onInputChange}
                    readOnly={viewMode}
                    maxLength={10}
                    className={`form-field__input ${viewMode ? 'form-field__input--readonly' : ''} date-input-field`}
                    style={{ paddingRight: '2.5rem' }}
                    autoComplete="off"
                />
                <button
                    type="button"
                    onClick={() => !viewMode && setShowPicker(!showPicker)}
                    disabled={viewMode}
                    style={{
                        position: 'absolute',
                        right: '0',
                        top: '0',
                        height: '100%',
                        width: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: viewMode ? 'default' : 'pointer',
                        color: 'var(--text-muted)'
                    }}
                >
                    <Calendar size={16} />
                </button>

                {showPicker && !viewMode && (
                    <MiniCalendar
                        value={formData[name]}
                        onChange={handleDateSelect}
                        onClose={() => setShowPicker(false)}
                    />
                )}
            </div>
        </div>
    );
};

// --- Constants & Rates ---
// Constants removed to support manual entry


const initialFormData = {
    // Administrative
    mandal: '',
    village: '',
    vehicle: '',
    location: '',
    grant: '',
    estCost: '',
    mBookNo: '',
    status: '',
    remarks: '',

    // Dates
    date: '',           // Work Date
    received_date: '',
    platform_date: '',
    material_date: '',

    // Setup
    casing_type: 'Government',

    // Drilling
    drilling_depth_mtrs: '',
    drilling_rate: '',
    drilling_amount: '',

    // Casing
    casing180_qty: '',
    casing180_rate: '',
    casing180_amount: '',

    casing140_qty: '',
    casing140_rate: '',
    casing140_amount: '',

    casing250_qty: '',
    casing250_rate: '',
    casing250_amount: '',

    // Materials (Manual Rates)
    borecap_qty: '',
    borecap_rate: '',
    borecap_amount: '',

    cylinders_qty: '',
    cylinders_rate: '',
    cylinders_amount: '',

    erection_qty: '',
    erection_rate: '',
    erection_amount: '',

    head_handle_qty: '',
    head_handle_rate: '',
    head_handle_amount: '',

    plotfarm_qty: '',
    plotfarm_rate: '',
    plotfarm_amount: '',

    pumpset_qty: '',
    pumpset_rate: '',
    pumpset_amount: '',

    slotting_qty: '',
    slotting_rate: '',
    slotting_amount: '',

    stand_qty: '',
    stand_rate: '',
    stand_amount: '',

    // GI Pipes
    pipe_company: '',
    gi_pipes_qty: '',
    gi_pipes_rate: '',
    gi_pipes_amount: '',
    geologist: '',

    // Labour
    labour_amount: '',

    // Other
    pcs: '',

    // Financials
    gross_amount: '',

    // Billing
    total_bill_amount: '',
    first_part_amount: '',
    second_part_amount: '',

    // Taxes
    it_percent: '',
    it_amount: '',
    vat_percent: '',
    vat_amount: '',

    cgst_percent: '',
    cgst_amt: '',
    sgst_percent: '',
    sgst_amt: '',
    igst_percent: '',
    igst_amt: '',
    gst_percent: '',
    gst_amt: '',
    sas_percent: '',
    sas_amt: '',

    total_recoveries: '',

    // Payment
    net_amount: '',
    voucher_no: '',
    cheque_no: '',
    cheque_date: '',
    bank_name: '',

    // Custom
    custom_data: []
};

// Reusable Components
const InputField = ({ label, name, type = 'text', readOnly = false, className = '', formData, handleChange, viewMode = false, required = false, inputStyle = {} }) => (
    <div className={`form-field ${className}`}>
        <label className="form-field__label">{label} {required && <span style={{ color: 'red' }}>*</span>}</label>
        <input
            type={type}
            name={name}
            value={formData[name] || ''}
            onChange={handleChange}
            readOnly={readOnly || viewMode}
            className={`form-field__input ${(readOnly || viewMode) ? 'form-field__input--readonly' : ''}`}
            required={required}
            min={type === 'number' ? "0" : undefined}
            style={inputStyle}
        />
    </div>
);


const SelectField = ({ label, name, options, formData, handleChange, viewMode = false, required = false }) => (
    <div className="form-field">
        <label className="form-field__label">{label} {required && <span style={{ color: 'red' }}>*</span>}</label>
        <select
            name={name}
            value={formData[name] || ''}
            onChange={handleChange}
            disabled={viewMode}
            className={`form-field__input ${viewMode ? 'form-field__input--readonly' : ''}`}
            required={required}
        >
            <option value="">Select {label}</option>
            {options.map((opt, i) => (
                <option key={i} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    </div>
);

const QtyRateAmountRow = ({ label, prefix, formData, handleChange, viewMode = false, className = '' }) => (
    <div className={`qty-rate-row ${className}`}>
        <span className="qty-rate-row__label">{label}</span>
        <input
            type="number"
            name={`${prefix}_qty`}
            value={formData[`${prefix}_qty`] || ''}
            onChange={handleChange}
            placeholder="Qty"
            className="qty-rate-row__input"
            readOnly={viewMode}
            style={{ textAlign: 'center' }}
            min="0"
        />
        <input
            type="number"
            name={`${prefix}_rate`}
            value={formData[`${prefix}_rate`] || ''}
            onChange={handleChange}
            placeholder="Rate"
            className="qty-rate-row__input"
            readOnly={viewMode}
            style={{ textAlign: 'center' }}
            min="0"
        />
        <input
            type="number"
            name={`${prefix}_amount`}
            value={formData[`${prefix}_amount`] || ''}
            onChange={handleChange}
            placeholder="Amount"
            readOnly={viewMode}
            className={`qty-rate-row__input ${viewMode ? 'qty-rate-row__input--readonly' : 'qty-rate-row__input--editable'}`}
            style={{ textAlign: 'center' }}
            min="0"
        />
    </div>
);

const TaxRow = ({ label, prefix, formData, handleChange, viewMode = false }) => {
    const amountKey = (prefix === 'it' || prefix === 'vat') ? `${prefix}_amount` : `${prefix}_amt`;
    return (
        <div className="qty-rate-row" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr', alignItems: 'center', gap: '12px' }}>
            <span className="qty-rate-row__label" style={{ padding: 0 }}>{label}</span>
            <input
                type="number"
                name={`${prefix}_percent`}
                value={formData[`${prefix}_percent`] || ''}
                onChange={handleChange}
                placeholder="%"
                className="qty-rate-row__input"
                style={{ textAlign: 'center' }}
                readOnly={viewMode}
                min="0"
                step="0.01"
            />
            <input
                type="number"
                name={amountKey}
                value={formData[amountKey] || ''}
                onChange={handleChange}
                placeholder="Amount"
                readOnly={viewMode}
                className={`qty-rate-row__input ${viewMode ? 'qty-rate-row__input--readonly' : 'qty-rate-row__input--editable'}`}
                style={{ textAlign: 'right' }}
                min="0"
            />
        </div>
    );
};


export default function BorewellForm({ record, onClose, onSave, saving, viewMode = false }) {

    // Helper to map record to form data
    const mapRecordToFormData = (rec) => {
        if (!rec) return { ...initialFormData };

        const mapped = { ...initialFormData };

        // Map matching keys
        Object.keys(initialFormData).forEach(key => {
            if (rec[key] !== undefined && rec[key] !== null) {
                mapped[key] = rec[key];
            }
        });

        // Handle Dates - Extract YYYY-MM-DD from ISO string if present
        ['date', 'received_date', 'platform_date', 'material_date', 'cheque_date'].forEach(dateField => {
            if (rec[dateField]) {
                // If it's an ISO string (2026-02-14T00:00:00.000Z), take the first 10 chars
                // If it's already YYYY-MM-DD, taking first 10 chars is safe too
                mapped[dateField] = typeof rec[dateField] === 'string' ? rec[dateField].substring(0, 10) : rec[dateField];
            }
        });

        // Handle relational fields
        if (rec.mandal?.name) mapped.mandal = rec.mandal.name;
        if (rec.village?.name) mapped.village = rec.village.name;

        // Handle custom_data
        // Initialize custom data based on new structure or legacy
        if (rec.custom_data) {
            let cData = rec.custom_data;
            if (typeof cData === 'string') {
                try { cData = JSON.parse(cData); } catch (e) { cData = {}; }
            }

            // If new structure exists, use it
            if (cData.materials || cData.taxes || cData.payments) {
                // It's the new format, states will be init in useEffect
            } else if (Array.isArray(cData)) {
                // Legacy array format - map to custom_payments or keep as generic
                // For this transition, we'll let useEffect handle it
            } else if (typeof cData === 'object') {
                // Key-value object - legacy map
            }
        }

        return mapped;
    };

    const [formData, setFormData] = useState(() => mapRecordToFormData(record));
    const [mandals, setMandals] = useState([]);

    // Custom Row States
    const [customMaterials, setCustomMaterials] = useState([]);
    const [customTaxes, setCustomTaxes] = useState([]);
    const [customPayments, setCustomPayments] = useState([]);
    const [editingLabelId, setEditingLabelId] = useState(null);
    const [tempLabelValue, setTempLabelValue] = useState('');

    // Initialize custom rows from record
    useEffect(() => {
        if (record && record.custom_data) {
            let cData = record.custom_data;
            if (typeof cData === 'string') {
                try { cData = JSON.parse(cData); } catch (e) { console.error("Error parsing custom_data", e); cData = {}; }
            }

            // Check for new structure
            if (cData.materials || cData.taxes || cData.payments) {
                setCustomMaterials(cData.materials || []);
                setCustomTaxes(cData.taxes || []);
                setCustomPayments(cData.payments || []);
            } else if (Array.isArray(cData)) {
                // Legacy array - treat as generic custom payments/fields
                // Map [{id, label, value}] to customPayments
                setCustomPayments(cData);
            } else if (typeof cData === 'object') {
                // Legacy object {Key: Value} - map to customPayments
                const mapped = Object.entries(cData).map(([k, v], i) => ({ id: Date.now() + i, label: k, value: v }));
                setCustomPayments(mapped);
            }
        }
    }, [record]);

    useEffect(() => {
        fetchMandals();
    }, [record]);

    const fetchMandals = async () => {
        try {
            const res = await govtBoreApi.getMandals();
            setMandals(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch mandals:', err);
        }
    };

    // Calculations removed to support manual entry


    // --- Custom Row Handlers ---

    // Materials
    const addCustomMaterial = () => {
        setCustomMaterials([...customMaterials, { id: Date.now(), item: '', qty: '', rate: '', amount: '' }]);
    };

    const removeCustomMaterial = (id) => {
        setCustomMaterials(customMaterials.filter(item => item.id !== id));
    };

    const handleCustomMaterialChange = (id, field, value) => {
        const updated = customMaterials.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: value };
                // Auto-calculate amount if qty or rate changes
                if (field === 'qty' || field === 'rate') {
                    const q = parseFloat(field === 'qty' ? value : item.qty) || 0;
                    const r = parseFloat(field === 'rate' ? value : item.rate) || 0;
                    newItem.amount = (q * r).toFixed(2);
                }
                return newItem;
            }
            return item;
        });
        setCustomMaterials(updated);
    };

    // Taxes
    const addCustomTax = () => {
        setCustomTaxes([...customTaxes, { id: Date.now(), label: '', type: 'percent', value: '', amount: '' }]);
    };

    const removeCustomTax = (id) => {
        setCustomTaxes(customTaxes.filter(item => item.id !== id));
    };

    const handleCustomTaxChange = (id, field, value) => {
        const updated = customTaxes.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: value };
                // Calculate amount based on type
                if (field === 'value' || field === 'type') {
                    const val = parseFloat(field === 'value' ? value : item.value) || 0;
                    if (newItem.type === 'percent') {
                        const billAmt = parseFloat(formData.total_bill_amount) || 0;
                        newItem.amount = ((billAmt * val) / 100).toFixed(2);
                    } else {
                        newItem.amount = val.toFixed(2); // Fixed amount
                    }
                }
                return newItem;
            }
            return item;
        });
        setCustomTaxes(updated);
    };

    // Payments
    const addCustomPayment = () => {
        setCustomPayments([...customPayments, { id: Date.now(), label: 'New Field', value: '' }]);
    };

    const removeCustomPayment = (id) => {
        setCustomPayments(customPayments.filter(item => item.id !== id));
    };

    const handleCustomPaymentChange = (id, field, value) => {
        const updated = customPayments.map(item => {
            if (item.id === id) return { ...item, [field]: value };
            return item;
        });
        setCustomPayments(updated);
    };

    const handleLabelDoubleClick = (item) => {
        if (viewMode || formData.status === 'Completed') return;
        setEditingLabelId(item.id);
        setTempLabelValue(item.label);
    };

    const handleLabelSubmit = (id) => {
        const updated = customPayments.map(item => {
            if (item.id === id) return { ...item, label: tempLabelValue || 'New Field' };
            return item;
        });
        setCustomPayments(updated);
        setEditingLabelId(null);
    };

    // --- Totals Calculation ---

    // TBA (Total Bill Amount) = Sum of all standard material amounts + custom material amounts
    // This is the auto-calculated field (previously was Gross).
    useEffect(() => {
        const stdMaterials = [
            'drilling', 'casing180', 'casing140', 'casing250',
            'slotting', 'pumpset', 'gi_pipes', 'plotfarm',
            'erection', 'borecap', 'labour', 'cylinders', 'stand', 'head_handle'
        ];

        let stdTotal = 0;
        stdMaterials.forEach(key => {
            stdTotal += parseFloat(formData[`${key}_amount`]) || 0;
        });

        const customMatTotal = customMaterials.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const newTBA = (stdTotal + customMatTotal).toFixed(2);

        if (formData.total_bill_amount !== newTBA) {
            setFormData(prev => ({ ...prev, total_bill_amount: newTBA }));
        }
    }, [
        formData.drilling_amount, formData.casing180_amount, formData.casing140_amount, formData.casing250_amount,
        formData.slotting_amount, formData.pumpset_amount, formData.gi_pipes_amount, formData.plotfarm_amount,
        formData.erection_amount, formData.borecap_amount, formData.labour_amount,
        formData.cylinders_amount, formData.stand_amount, formData.head_handle_amount,
        customMaterials
    ]);



    // Net Amount: remains manually entered by admin.

    // Re-calculate custom tax amounts if Gross changes (for % based taxes)
    // Gross is now the manual base value entered by admin.
    useEffect(() => {
        const grossAmt = parseFloat(formData.gross_amount) || 0;
        const updatedTaxes = customTaxes.map(item => {
            if (item.type === 'percent') {
                const val = parseFloat(item.value) || 0;
                return { ...item, amount: ((grossAmt * val) / 100).toFixed(2) };
            }
            return item;
        });

        if (JSON.stringify(updatedTaxes) !== JSON.stringify(customTaxes)) {
            setCustomTaxes(updatedTaxes);
        }
    }, [formData.gross_amount]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        // Auto-calculation logic for standard rows
        // Pattern: prefix_qty (or special cases) + prefix_rate -> prefix_amount
        let updates = { [name]: value };

        const calculateAmount = (qty, rate) => {
            const q = parseFloat(qty) || 0;
            const r = parseFloat(rate) || 0;
            return (q * r).toFixed(2);
        };

        // Special Case: Drilling
        if (name === 'drilling_depth_mtrs' || name === 'drilling_rate') {
            const qty = name === 'drilling_depth_mtrs' ? value : formData.drilling_depth_mtrs;
            const rate = name === 'drilling_rate' ? value : formData.drilling_rate;
            updates.drilling_amount = calculateAmount(qty, rate);
        }

        // Standard Qty/Rate pairs
        else if (name.endsWith('_qty') || name.endsWith('_rate')) {
            const parts = name.split('_');
            const type = parts.pop(); // 'qty' or 'rate'
            const prefix = parts.join('_'); // e.g., 'casing180', 'borecap' or 'gi_pipes'

            // Check if this prefix has a corresponding amount field in our data structure
            // We can check if prefix_amount exists in initialFormData or just assume it does for relevant fields
            const amountKey = `${prefix}_amount`;

            // We need to look up current values from formData, overriding the one being changed
            const qtyKey = `${prefix}_qty`;
            const rateKey = `${prefix}_rate`;

            const qty = name === qtyKey ? value : formData[qtyKey];
            const rate = name === rateKey ? value : formData[rateKey];

            updates[amountKey] = calculateAmount(qty, rate);
        }

        setFormData(prev => ({ ...prev, ...updates }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        // Validation: Mandatory Fields
        if (!formData.mandal || !formData.village || !formData.location || !formData.vehicle) {
            toast.error('Please fill in all mandatory fields: Mandal, Village, Location, Vehicle');
            return;
        }

        // Pack custom rows into custom_data
        const packedData = {
            materials: customMaterials,
            taxes: customTaxes,
            payments: customPayments
        };
        // Also include any legacy data? No, we replace structure.

        onSave({ ...formData, custom_data: packedData });
    };



    return (
        <div className="govt-bore-modal-overlay">
            <div className="govt-bore-modal govt-bore-modal--wide">
                <div className="govt-bore-modal__header">
                    <h2 className="govt-bore-modal__title">
                        {viewMode ? 'View Borewell Details' : (record ? 'Edit Borewell Work' : 'New Borewell Work')}
                    </h2>
                    <button onClick={onClose} className="govt-bore-modal__close">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="govt-bore-modal__form">

                    {/* Section 1: Project Information */}
                    <div className="govt-bore-modal__section">
                        <h3 className="govt-bore-modal__section-title">Project Information</h3>
                        <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                            <div className="form-field">
                                <label className="form-field__label">Mandal</label>
                                <input type="text" name="mandal" list="mandal-list" value={formData.mandal} onChange={handleChange} className="form-field__input" />
                                <datalist id="mandal-list">{mandals.map((m, i) => <option key={i} value={m.name} />)}</datalist>
                            </div>
                            <InputField label="Village" name="village" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            <InputField label="Point / Supervisor" name="location" formData={formData} handleChange={handleChange} viewMode={viewMode} />

                            <SelectField
                                label="Vehicle"
                                name="vehicle"
                                formData={formData}
                                handleChange={handleChange}
                                viewMode={viewMode}
                                options={[
                                    { label: '4 ½ Tyre', value: '4 ½ Tyre' },
                                    { label: '6 ½ Tyre', value: '6 ½ Tyre' },
                                    { label: '10 Tyre', value: '10 Tyre' }
                                ]}
                            />
                            <InputField label="Grant" name="grant" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            <DateField label="Date" name="date" formData={formData} handleChange={handleChange} viewMode={viewMode} />

                            <InputField label="Est. Cost" name="estCost" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            <InputField label="M Book No" name="mBookNo" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            <SelectField
                                label="Status"
                                name="status"
                                formData={formData}
                                handleChange={handleChange}
                                viewMode={viewMode}
                                options={[
                                    { label: 'Pending', value: 'Pending' },
                                    { label: 'To be recording', value: 'To be recording' },
                                    { label: 'Done', value: 'Done' },
                                    { label: 'Completed', value: 'Completed' }
                                ]}
                            />
                        </div>
                    </div>

                    {/* Section 2: Drilling & Casing */}
                    <div className="govt-bore-modal__section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h3 className="govt-bore-modal__section-title" style={{ marginBottom: 0 }}>Drilling & Casing</h3>
                            <div style={{ width: '200px' }}>
                                <DateField label="Platform Date" name="platform_date" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            </div>
                        </div>

                        {/* Drilling Details */}
                        <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: 'var(--text-secondary)' }}>Drilling Details</h4>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                                <InputField label="Total Feet" name="drilling_depth_mtrs" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                <InputField label="Rate" name="drilling_rate" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                <InputField label="Amount" name="drilling_amount" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            </div>
                        </div>

                        {/* Casing Details */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>Casing Details</h4>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '600', opacity: 0.8 }}>Rate Type:</label>
                                    <select name="casing_type" value={formData.casing_type} onChange={handleChange} className="form-field__input" style={{ width: 'auto', padding: '2px 8px', fontSize: '12px' }} disabled={viewMode}>
                                        <option value="Government">Government</option>
                                        <option value="Private">Private</option>
                                    </select>
                                </div>
                            </div>

                            <div className="qty-rate-table">
                                <div className="qty-rate-table__header">
                                    <span>Type</span>
                                    <span style={{ textAlign: 'center' }}>per feet</span>
                                    <span style={{ textAlign: 'center' }}>Rate</span>
                                    <span style={{ textAlign: 'center' }}>Amount</span>
                                </div>
                                <QtyRateAmountRow label="140mm (5 inches)" prefix="casing140" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="180mm (7 inches)" prefix="casing180" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="250mm (10 inches)" prefix="casing250" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Materials & Equipment */}
                    <div className="govt-bore-modal__section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <h3 className="govt-bore-modal__section-title" style={{ marginBottom: 0 }}>Materials & Equipment</h3>
                                {!viewMode && formData.status !== 'Completed' && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={addCustomMaterial}
                                        style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                    >
                                        <Plus size={12} /> Add Material
                                    </button>
                                )}
                            </div>
                            <div style={{ width: '200px' }}>
                                <DateField label="Material Date" name="material_date" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            </div>
                        </div>

                        <div className="qty-rate-table">
                            <div className="qty-rate-table__header">
                                <span>Item</span>
                                <span style={{ textAlign: 'center' }}>Qty</span>
                                <span style={{ textAlign: 'center' }}>Rate</span>
                                <span style={{ textAlign: 'center' }}>Amount</span>
                            </div>

                            <QtyRateAmountRow label="Bore Cap" prefix="borecap" formData={formData} handleChange={handleChange} viewMode={viewMode} className="qty-rate-row--no-border qty-rate-row--compact" />
                            <QtyRateAmountRow label="Cylinders" prefix="cylinders" formData={formData} handleChange={handleChange} viewMode={viewMode} className="qty-rate-row--no-border qty-rate-row--compact" />
                            <QtyRateAmountRow label="Erection" prefix="erection" formData={formData} handleChange={handleChange} viewMode={viewMode} className="qty-rate-row--no-border qty-rate-row--compact" />
                            <QtyRateAmountRow label="Head & Handle" prefix="head_handle" formData={formData} handleChange={handleChange} viewMode={viewMode} className="qty-rate-row--no-border qty-rate-row--compact" />
                            <QtyRateAmountRow label="Plot/Farm" prefix="plotfarm" formData={formData} handleChange={handleChange} viewMode={viewMode} className="qty-rate-row--no-border qty-rate-row--compact" />
                            <QtyRateAmountRow label="Pump Set" prefix="pumpset" formData={formData} handleChange={handleChange} viewMode={viewMode} className="qty-rate-row--no-border qty-rate-row--compact" />
                            <QtyRateAmountRow label="Slotting" prefix="slotting" formData={formData} handleChange={handleChange} viewMode={viewMode} className="qty-rate-row--no-border qty-rate-row--compact" />
                            <QtyRateAmountRow label="Stand" prefix="stand" formData={formData} handleChange={handleChange} viewMode={viewMode} className="qty-rate-row--no-border qty-rate-row--compact" />

                            {/* Custom Materials inserted at the bottom */}
                            {customMaterials.map((item) => (
                                <div key={item.id} className="qty-rate-row qty-rate-row--no-border qty-rate-row--compact">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1 }}>
                                        <input
                                            type="text"
                                            value={item.item}
                                            onChange={(e) => handleCustomMaterialChange(item.id, 'item', e.target.value)}
                                            placeholder="Item Name"
                                            className="qty-rate-row__input"
                                            disabled={viewMode || formData.status === 'Completed'}
                                            style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: '500', textAlign: 'left' }}
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        value={item.qty}
                                        onChange={(e) => handleCustomMaterialChange(item.id, 'qty', e.target.value)}
                                        placeholder="Qty"
                                        className={`qty-rate-row__input ${viewMode ? 'qty-rate-row__input--readonly' : 'qty-rate-row__input--editable'}`}
                                        disabled={viewMode || formData.status === 'Completed'}
                                        style={{ textAlign: 'center' }}
                                    />
                                    <input
                                        type="number"
                                        value={item.rate}
                                        onChange={(e) => handleCustomMaterialChange(item.id, 'rate', e.target.value)}
                                        placeholder="Rate"
                                        className={`qty-rate-row__input ${viewMode ? 'qty-rate-row__input--readonly' : 'qty-rate-row__input--editable'}`}
                                        disabled={viewMode || formData.status === 'Completed'}
                                        style={{ textAlign: 'center' }}
                                    />
                                    <input
                                        type="number"
                                        value={item.amount}
                                        readOnly
                                        placeholder="Amount"
                                        className={`qty-rate-row__input ${viewMode ? 'qty-rate-row__input--readonly' : 'qty-rate-row__input--editable'}`}
                                        style={{ textAlign: 'center' }}
                                    />
                                    {!viewMode && formData.status !== 'Completed' && (
                                        <button
                                            type="button"
                                            className="delete-btn"
                                            onClick={() => removeCustomMaterial(item.id)}
                                            title="Remove Item"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Merged Pipes & Labour Section */}
                        <div className="govt-bore-modal__subsection" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>GI Pipes & Labour</h4>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--4">
                                <div className="form-field">
                                    <label className="form-field__label">Company</label>
                                    <select name="pipe_company" value={formData.pipe_company} onChange={handleChange} className="form-field__input" disabled={viewMode}>
                                        <option value="">Select Company</option>
                                        <option value="Nandi">Nandi</option>
                                        <option value="Sudhakar (G1)">Sudhakar (G1)</option>
                                        <option value="Sudhakar (G2)">Sudhakar (G2)</option>
                                    </select>
                                </div>
                                <InputField label="Qty" name="gi_pipes_qty" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} inputStyle={{ textAlign: 'center' }} />
                                <InputField label="Rate" name="gi_pipes_rate" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} inputStyle={{ textAlign: 'center' }} />
                                <InputField label="Amount" name="gi_pipes_amount" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} inputStyle={{ textAlign: 'center' }} />
                            </div>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--fixed-2" style={{ marginTop: '10px' }}>
                                <InputField label="Geologist" name="geologist" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                <InputField label="Labour Charges" name="labour_amount" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            </div>
                        </div>


                    </div>


                    <div className="govt-bore-modal__section" style={{ marginTop: '2rem' }}>
                        {/* Row 1: NET AMOUNT (manual) | TBA - auto-calculated */}
                        <div className="govt-bore-modal__grid govt-bore-modal__grid--fixed-2">
                            <InputField
                                label="NET AMOUNT"
                                name="net_amount"
                                type="number"
                                formData={formData}
                                handleChange={handleChange}
                                viewMode={viewMode}
                                className="form-field--highlight"
                            />
                            <InputField
                                label="TBA (Total Bill Amount)"
                                name="total_bill_amount"
                                type="number"
                                formData={formData}
                                handleChange={handleChange}
                                viewMode={true} // Auto-calculated — always read-only
                                className="form-field--highlight"
                                inputStyle={{ fontWeight: 'bold' }}
                            />
                        </div>
                        {/* Row 2: Total Recoveries (auto-calc) | Gross (manual) */}
                        <div className="govt-bore-modal__grid govt-bore-modal__grid--fixed-2" style={{ marginTop: '1rem' }}>
                            <InputField
                                label="Total Recoveries"
                                name="total_recoveries"
                                type="number"
                                formData={formData}
                                handleChange={handleChange}
                                viewMode={viewMode} // Manually editable by admin
                            />
                            <InputField
                                label="Gross"
                                name="gross_amount"
                                type="number"
                                formData={formData}
                                handleChange={handleChange}
                                viewMode={viewMode} // Manually editable by admin
                                className="form-field--highlight"
                            />
                        </div>
                    </div>

                    {/* Section 6: Billing & Taxes */}
                    <div className="govt-bore-modal__section" style={{ marginTop: '2rem' }}>
                        <h3 className="govt-bore-modal__section-title">Billing & Taxes</h3>

                        <div className="govt-bore-modal__grid govt-bore-modal__grid--2">
                            <div>
                                <div className="qty-rate-table">
                                    <div className="qty-rate-table__header" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr', background: 'var(--bg-tertiary)' }}>
                                        <span>Full Tax Table</span>
                                        <span style={{ textAlign: 'center' }}>%</span>
                                        <span style={{ textAlign: 'center' }}>Amount</span>
                                    </div>
                                    <TaxRow label="CGST" prefix="cgst" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                    <TaxRow label="SGST" prefix="sgst" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                    <TaxRow label="IGST" prefix="igst" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                    <TaxRow label="GST" prefix="gst" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                    <TaxRow label="SAS" prefix="sas" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                    <TaxRow label="IT" prefix="it" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                    <TaxRow label="VAT" prefix="vat" formData={formData} handleChange={handleChange} viewMode={viewMode} />

                                    {/* Custom Taxes */}
                                    {customTaxes.map((item) => (
                                        <div key={item.id} className="qty-rate-row" style={{ gridTemplateColumns: '1.5fr 1fr 1.5fr', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <input
                                                    type="text"
                                                    value={item.label}
                                                    onChange={(e) => handleCustomTaxChange(item.id, 'label', e.target.value)}
                                                    placeholder="Tax/Charge"
                                                    className="qty-rate-row__input"
                                                    disabled={viewMode || formData.status === 'Completed'}
                                                    style={{ flex: 1, border: 'none', background: 'transparent', textAlign: 'left', padding: 0 }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '2px', alignItems: 'center', justifyContent: 'center' }}>
                                                <select
                                                    value={item.type}
                                                    onChange={(e) => handleCustomTaxChange(item.id, 'type', e.target.value)}
                                                    className="qty-rate-row__input"
                                                    style={{ width: '30px', padding: '0', fontSize: '10px', border: 'none', background: 'transparent', textAlign: 'center' }}
                                                    disabled={viewMode || formData.status === 'Completed'}
                                                >
                                                    <option value="percent">%</option>
                                                    <option value="fixed">₹</option>
                                                </select>
                                                <input
                                                    type="number"
                                                    value={item.value}
                                                    onChange={(e) => handleCustomTaxChange(item.id, 'value', e.target.value)}
                                                    placeholder={item.type === 'percent' ? '%' : 'Amt'}
                                                    className="qty-rate-row__input"
                                                    style={{ textAlign: 'center', flex: 1, border: 'none', background: 'transparent', padding: 0 }}
                                                    disabled={viewMode || formData.status === 'Completed'}
                                                />
                                            </div>
                                            <input
                                                type="number"
                                                value={item.amount}
                                                readOnly
                                                placeholder="Amount"
                                                className="qty-rate-row__input"
                                                style={{ textAlign: 'center', border: 'none', background: 'transparent', padding: 0 }}
                                            />
                                            {!viewMode && formData.status !== 'Completed' && (
                                                <button
                                                    type="button"
                                                    className="delete-btn"
                                                    onClick={() => removeCustomTax(item.id)}
                                                    title="Remove Tax"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}

                                    {!viewMode && formData.status !== 'Completed' && (
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={addCustomTax}
                                            style={{ fontSize: '11px', padding: '2px 5px', marginTop: '5px', width: '100%', borderStyle: 'dashed' }}
                                        >
                                            <Plus size={10} /> Add Tax/Charge
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div className="govt-bore-modal__grid govt-bore-modal__grid--fixed-2">
                                    <InputField label="First Part" name="first_part_amount" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                    <InputField label="Second Part" name="second_part_amount" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 7: Payment Details */}
                    <div className="govt-bore-modal__section">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                            <h3 className="govt-bore-modal__section-title" style={{ marginBottom: 0 }}>Payment Details</h3>
                            {!viewMode && formData.status !== 'Completed' && (
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={addCustomPayment}
                                    style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <Plus size={12} /> Add Payment
                                </button>
                            )}
                        </div>
                        <div className="govt-bore-modal__grid govt-bore-modal__grid--4">
                            <InputField label="Bank Name" name="bank_name" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            <InputField label="Cheque No" name="cheque_no" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            <DateField label="Cheque Date" name="cheque_date" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            <DateField label="Received Date" name="received_date" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                        </div>
                        <div className="govt-bore-modal__grid govt-bore-modal__grid--3" style={{ marginTop: '1rem' }}>
                            <InputField label="PCs" name="pcs" type="number" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            <InputField label="Voucher" name="voucher_no" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                            <InputField label="Remarks" name="remarks" formData={formData} handleChange={handleChange} viewMode={viewMode} />
                        </div>

                        {/* Custom Payment Payloads */}
                        {(!viewMode || customPayments.length > 0) && (
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--4" style={{ marginTop: '1rem' }}>
                                {customPayments.map((item) => (
                                    <div key={item.id} className="form-field">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            {editingLabelId === item.id ? (
                                                <input
                                                    type="text"
                                                    value={tempLabelValue}
                                                    onChange={(e) => setTempLabelValue(e.target.value)}
                                                    onBlur={() => handleLabelSubmit(item.id)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleLabelSubmit(item.id)}
                                                    className="form-field__label"
                                                    style={{ border: 'none', background: 'var(--bg-tertiary)', width: '80%', padding: '0 4px', marginBottom: '4px' }}
                                                    autoFocus
                                                />
                                            ) : (
                                                <label
                                                    className="form-field__label"
                                                    onDoubleClick={() => handleLabelDoubleClick(item)}
                                                    style={{ cursor: (!viewMode && formData.status !== 'Completed') ? 'text' : 'default', marginBottom: '4px' }}
                                                    title={(!viewMode && formData.status !== 'Completed') ? "Double click to rename" : ""}
                                                >
                                                    {item.label}
                                                </label>
                                            )}

                                            {!viewMode && formData.status !== 'Completed' && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeCustomPayment(item.id)}
                                                    style={{ color: '#ef4444', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: '4px' }}
                                                    title="Remove Field"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={item.value}
                                            onChange={(e) => handleCustomPaymentChange(item.id, 'value', e.target.value)}
                                            placeholder="Value"
                                            className={`form-field__input ${(viewMode || formData.status === 'Completed') ? 'form-field__input--readonly' : ''}`}
                                            disabled={viewMode || formData.status === 'Completed'}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="govt-bore-modal__actions">
                        <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
                        {!viewMode && (
                            <button type="submit" disabled={saving} className="btn btn-primary">
                                {saving ? 'Saving...' : 'Save Record'}
                            </button>
                        )}
                    </div>
                </form>
            </div >
        </div >
    );
}
