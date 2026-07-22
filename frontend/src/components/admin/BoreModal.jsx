import { useState, useEffect } from 'react';
import { X, Save, Plus, Calendar, Trash2 } from 'lucide-react';
import { inventoryApi } from '../../services/api';
import { getCurrentISTDate, toISTDate } from '../../utils/dateTime';

const IST_TZ = 'Asia/Kolkata';

const toISTDateString = (value) => {
    if (!value) return '';
    const d = toISTDate(value);
    if (!d || isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: IST_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const get = (type) => parts.find(p => p.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
};

// --- Reusable Components ---

const InputField = ({ label, name, type = 'text', value, onChange, required, readOnly, viewMode, placeholder }) => (
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
        <input type="number" value={data[`${prefix}_amt`] === 0 ? '' : (data[`${prefix}_amt`] ?? 0)} readOnly min="0" className="qty-rate-row__input qty-rate-row__input--readonly" placeholder="0" style={{ textAlign: 'center' }} />
    </div>
);

// --- Main Component ---

export default function BoreModal({ isOpen, onClose, record, onSave, saving, viewMode = false }) {
    const [formData, setFormData] = useState({});
    const [pipeOptions, setPipeOptions] = useState([]);

    // Dynamic drilling rows (replaces hardcoded jump_300 / jump_400)
    const [customDrilling, setCustomDrilling] = useState([]);
    
    // Dynamic pipes tracking rows
    const [pipesList, setPipesList] = useState([]);
    const [pipeAllocations, setPipeAllocations] = useState([]);

    // ---------- Load record into form state ----------
    useEffect(() => {
        if (record) {
            const data = { ...record };
            if (data.date) data.date = toISTDateString(data.date);
            if (typeof data.pipe_details === 'string') {
                try { data.pipe_details = JSON.parse(data.pipe_details); } catch { data.pipe_details = {}; }
            }
            setFormData(data);

            // Restore custom drilling rows from custom_data
            let cData = data.custom_data;
            if (typeof cData === 'string') {
                try { cData = JSON.parse(cData); } catch { cData = {}; }
            }
            setCustomDrilling((cData && Array.isArray(cData.drilling)) ? cData.drilling : []);
            
            // Map pipes tracking
            if (cData && Array.isArray(cData.pipes_tracking)) {
                setPipesList(cData.pipes_tracking);
            } else if (data.pipe_inventory_id || data.pipes_used_qty > 0 || data.pipes_on_vehicle_before > 0) {
                // Legacy migration for UI display
                setPipesList([{
                    id: Date.now(),
                    source: 'Home Stock',
                    pipe_inventory_id: data.pipe_inventory_id || '',
                    company_name: data.pipe_details?.company || '',
                    pipe_size: '',
                    material_type: '',
                    quality_grade: '',
                    length_feet: 20,
                    cost_per_unit: 0,
                    on_vehicle: data.pipes_on_vehicle_before || 0,
                    used_nos: data.pipes_used_qty || 0,
                    used_ft: data.pipes_used_pieces_ft || 0,
                    left_auto: data.pipes_left_on_vehicle || 0,
                    borrowed_from: '',
                    remarks: ''
                }]);
            } else {
                setPipesList([]);
            }
        } else {
            setFormData({
                date: getCurrentISTDate(),
                bore_type: '6 1/2"',
                pipe_details: {},
                pipe_inventory_id: '',
                drill_upto_casing_feet: 0, drill_upto_casing_rate: 0, drill_upto_casing_amt: 0,
                empty_drilling_feet: 0, empty_drilling_rate: 0, empty_drilling_amt: 0,
                total_drilling_feet: 0, total_drilling_amt: 0,
                cas140_feet: 0, cas140_rate: 0, cas140_amt: 0,
                cas180_4g_feet: 0, cas180_4g_rate: 0, cas180_4g_amt: 0,
                cas180_6g_feet: 0, cas180_6g_rate: 0, cas180_6g_amt: 0,
                cas250_4g_feet: 0, cas250_4g_rate: 0, cas250_4g_amt: 0,
                cas250_6g_feet: 0, cas250_6g_rate: 0, cas250_6g_amt: 0,
                slotting_pipes: 0, slotting_rate: 0, slotting_amt: 0,
                pipes_on_vehicle_before: 0, pipes_used_qty: 0, pipes_used_pieces_ft: 0, pipes_left_on_vehicle: 0,
                labour_charge: 0, rpm: 0,
                phone_pe_received: 0, cash_paid: 0, total_amount: 0, amount_paid: 0, balance: 0, discount: 0
            });
            setCustomDrilling([]);
            setPipesList([]);
        }
    }, [record, isOpen]);

    // Load pipe options and allocations
    useEffect(() => {
        if (!isOpen) return;
        inventoryApi.getPipes()
            .then((res) => setPipeOptions(res.data?.data || []))
            .catch(() => setPipeOptions([]));
            
        inventoryApi.getPipeAllocations()
            .then((res) => setPipeAllocations(res.data?.data || []))
            .catch(() => setPipeAllocations([]));
    }, [isOpen]);

    // ---------- Custom Drilling Row Handlers ----------
    const addCustomDrilling = () => {
        setCustomDrilling(prev => [...prev, { id: Date.now(), label: '', feet: '', rate: '', amt: 0 }]);
    };

    const removeCustomDrilling = (id) => {
        setCustomDrilling(prev => prev.filter(row => row.id !== id));
    };

    const handleCustomDrillingChange = (id, field, value) => {
        setCustomDrilling(prev => prev.map(row => {
            if (row.id !== id) return row;
            const updated = { ...row, [field]: value };
            if (field === 'feet' || field === 'rate') {
                const feet = parseFloat(field === 'feet' ? value : row.feet) || 0;
                const rate = parseFloat(field === 'rate' ? value : row.rate) || 0;
                updated.amt = feet * rate;
            }
            return updated;
        }));
    };

    // ---------- Pipes Tracking Handlers ----------
    const addPipeTracker = () => {
        setPipesList(prev => [...prev, {
            id: Date.now(),
            source: 'Home Stock', // Default
            pipe_inventory_id: '',
            company_name: '',
            pipe_size: '',
            material_type: '',
            quality_grade: '',
            length_feet: 20,
            cost_per_unit: 0,
            on_vehicle: 0,
            used_nos: 0,
            used_ft: 0,
            left_auto: 0,
            borrowed_from: '',
            remarks: ''
        }]);
    };

    const removePipeTracker = (id) => {
        setPipesList(prev => prev.filter(p => p.id !== id));
    };

    const handlePipeTrackerChange = (id, field, value) => {
        setPipesList(prev => prev.map(p => {
            if (p.id !== id) return p;
            const updated = { ...p, [field]: value };
            
            if (field === 'source' && value !== 'Home Stock') {
                updated.pipe_inventory_id = '';
            }

            // Auto-fill company/size if Home Stock and inventory item selected
            if (field === 'pipe_inventory_id') {
                const selectedPipe = pipeOptions.find(opt => String(opt.id) === String(value));
                if (selectedPipe) {
                    updated.company_name = selectedPipe.company || '';
                    updated.pipe_size = selectedPipe.size || '';
                    updated.material_type = selectedPipe.material_type || '';
                    updated.quality_grade = selectedPipe.quality_grade || '';
                    updated.length_feet = selectedPipe.length_feet || 20;
                    updated.cost_per_unit = selectedPipe.cost_per_unit || 0;
                }
                if (updated.source === 'Home Stock' && formData.vehicle_name) {
                    const targetLoc = `VEHICLE:${formData.vehicle_name}`;
                    const matches = pipeAllocations.filter(a => String(a.pipe_inventory_id) === String(value) && a.destination_location === targetLoc);
                    let totalFeet = 0;
                    let lengthFeet = 20;
                    matches.forEach(m => {
                        totalFeet += parseFloat(m.open_quantity) || 0;
                        if (m.length_feet) lengthFeet = parseFloat(m.length_feet);
                    });
                    updated.on_vehicle = Math.floor(totalFeet / lengthFeet);
                }
            }

            // Recalculate left_auto and used_ft
            if (['on_vehicle', 'used_nos', 'pipe_inventory_id', 'length_feet'].includes(field)) {
                const onV = parseFloat(field === 'on_vehicle' ? value : updated.on_vehicle) || 0;
                const used = parseFloat(field === 'used_nos' ? value : updated.used_nos) || 0;
                updated.left_auto = onV - used;

                // Auto-calculate used_ft based on used_nos (using length_feet of the pipe option, defaulting to 20)
                let len = 20;
                if (updated.source === 'Home Stock' && updated.pipe_inventory_id) {
                    const selectedPipe = pipeOptions.find(opt => String(opt.id) === String(updated.pipe_inventory_id));
                    if (selectedPipe && selectedPipe.length_feet) {
                        len = parseFloat(selectedPipe.length_feet) || 20;
                    }
                } else if (updated.length_feet) {
                    len = parseFloat(updated.length_feet) || 20;
                }
                updated.used_ft = used * len;
            }

            return updated;
        }));
    };

    // ---------- Totals via useEffect (includes custom drilling) ----------
    useEffect(() => {
        const getNum = (key) => parseFloat(formData[key]) || 0;
        const customFeet = customDrilling.reduce((s, r) => s + (parseFloat(r.feet) || 0), 0);
        const customAmt  = customDrilling.reduce((s, r) => s + (parseFloat(r.amt)  || 0), 0);

        const total_drilling_feet = getNum('drill_upto_casing_feet') + getNum('empty_drilling_feet') + customFeet;
        const total_drilling_amt  = getNum('drill_upto_casing_amt')  + getNum('empty_drilling_amt')  + customAmt;
        const total_casing_amt    = getNum('cas140_amt') + getNum('cas180_4g_amt') + getNum('cas180_6g_amt') + getNum('cas250_4g_amt') + getNum('cas250_6g_amt');
        const total_amount        = total_drilling_amt + total_casing_amt + getNum('slotting_amt') + getNum('labour_charge');
        const amount_paid         = getNum('phone_pe_received') + getNum('cash_paid');
        const balance             = total_amount - getNum('discount') - amount_paid;

        setFormData(prev => ({ ...prev, total_drilling_feet, total_drilling_amt, total_amount, amount_paid, balance }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        customDrilling,
        formData.drill_upto_casing_feet, formData.drill_upto_casing_amt,
        formData.empty_drilling_feet,    formData.empty_drilling_amt,
        formData.cas140_amt, formData.cas180_4g_amt, formData.cas180_6g_amt, formData.cas250_4g_amt, formData.cas250_6g_amt,
        formData.slotting_amt, formData.labour_charge,
        formData.phone_pe_received, formData.cash_paid, formData.discount,
    ]);

    // ---------- Standard field change handler ----------
    const handleChange = (e) => {
        const { name, value, type } = e.target;
        const val = type === 'number' ? Math.max(0, parseFloat(value) || 0) : value;

        setFormData(prev => {
            const updated = { ...prev, [name]: val };

            // Row-level auto-calc (feet * rate → amt) for standard rows
            let prefix = '';
            if      (name.startsWith('drill_upto_casing')) prefix = 'drill_upto_casing';
            else if (name.startsWith('empty_drilling'))    prefix = 'empty_drilling';
            else if (name.startsWith('cas140'))            prefix = 'cas140';
            else if (name.startsWith('cas180_4g'))         prefix = 'cas180_4g';
            else if (name.startsWith('cas180_6g'))         prefix = 'cas180_6g';
            else if (name.startsWith('cas250_4g'))         prefix = 'cas250_4g';
            else if (name.startsWith('cas250_6g'))         prefix = 'cas250_6g';
            else if (name.startsWith('slotting'))          prefix = 'slotting';

            if (prefix && (name.endsWith('_feet') || name.endsWith('_rate') || name === 'slotting_pipes')) {
                const qty  = parseFloat(updated[`${prefix}_${prefix === 'slotting' ? 'pipes' : 'feet'}`]) || 0;
                const rate = parseFloat(updated[`${prefix}_rate`]) || 0;
                updated[`${prefix}_amt`] = qty * rate;
            }

            // Casing display totals (inline for display only)
            updated.total_casing_feet = (parseFloat(updated.cas140_feet) || 0) + (parseFloat(updated.cas180_4g_feet) || 0) + (parseFloat(updated.cas180_6g_feet) || 0) + (parseFloat(updated.cas250_4g_feet) || 0) + (parseFloat(updated.cas250_6g_feet) || 0);
            updated.total_casing_amt  = (parseFloat(updated.cas140_amt)  || 0) + (parseFloat(updated.cas180_4g_amt)  || 0) + (parseFloat(updated.cas180_6g_amt)  || 0) + (parseFloat(updated.cas250_4g_amt)  || 0) + (parseFloat(updated.cas250_6g_amt)  || 0);

            // Time log
            if (name === 'start_time' || name === 'end_time') {
                const diff = (parseFloat(updated.end_time) || 0) - (parseFloat(updated.start_time) || 0);
                updated.total_hrs = diff > 0 ? diff : 0;
            }
            
            // If vehicle changes, recalculate Home Stock pipes
            if (name === 'vehicle_name') {
                setPipesList(prevList => prevList.map(p => {
                    if (p.source === 'Home Stock' && p.pipe_inventory_id) {
                        const targetLoc = `VEHICLE:${val}`;
                        const matches = pipeAllocations.filter(a => String(a.pipe_inventory_id) === String(p.pipe_inventory_id) && a.destination_location === targetLoc);
                        let totalFeet = 0;
                        let lengthFeet = 20;
                        matches.forEach(m => {
                            totalFeet += parseFloat(m.open_quantity) || 0;
                            if (m.length_feet) lengthFeet = parseFloat(m.length_feet);
                        });
                        const newOnV = Math.floor(totalFeet / lengthFeet);
                        return { ...p, on_vehicle: newOnV, left_auto: newOnV - (parseFloat(p.used_nos) || 0) };
                    }
                    return p;
                }));
            }

            return updated;
        });
    };

    const handlePipeDetailChange = (key, val) => {
        setFormData(prev => ({ ...prev, pipe_details: { ...prev.pipe_details, [key]: val } }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Validate pipes
        for (const p of pipesList) {
            const onV = parseFloat(p.on_vehicle) || 0;
            const used = parseFloat(p.used_nos) || 0;
            if (used > onV) {
                alert(`Error: Used pipes (${used}) cannot exceed On Vehicle pipes (${onV}) for Pipe. Please fix to save.`);
                return;
            }
        }
        
        onSave({ ...formData, custom_data: { drilling: customDrilling, pipes_tracking: pipesList } });
    };

    return (
        <div className="govt-bore-editor">
            <div className="govt-bore-editor__header">
                <h2 className="govt-bore-editor__title">
                    {viewMode ? 'View Private Bore Details' : (record ? 'Edit Private Bore Entry' : 'Add New Private Bore Entry')}
                </h2>
            </div>

            <form onSubmit={handleSubmit} className="govt-bore-editor__form">

                        {/* ── 1. Project Information ─────────────────────── */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">Project Information</h3>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                                <InputField label="Village"       name="village"       value={formData.village}       onChange={handleChange} viewMode={viewMode} placeholder="Enter Village" />
                                <InputField label="Location"      name="supervisor_name" value={formData.supervisor_name} onChange={handleChange} viewMode={viewMode} placeholder="Enter location" />
                                <InputField label="Customer Name" name="customer_name" value={formData.customer_name} onChange={handleChange} required viewMode={viewMode} placeholder="Enter Customer Name" />

                                <div className="form-field">
                                    <label className="form-field__label">Vehicle</label>
                                    <select name="vehicle_name" value={formData.vehicle_name || ''} onChange={handleChange} disabled={viewMode} className="form-field__input">
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
                                    <select name="bore_type" value={formData.bore_type || ''} onChange={handleChange} disabled={viewMode} className="form-field__input">
                                        <option value='4 1/2"'>4 1/2" Bore</option>
                                        <option value='6 1/2"'>6 1/2" Bore</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* ── 2. Drilling ────────────────────────────────── */}
                        <div className="govt-bore-modal__section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 className="govt-bore-modal__section-title" style={{ marginBottom: 0 }}>Drilling</h3>
                                {!viewMode && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={addCustomDrilling}
                                        style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                    >
                                        <Plus size={12} /> Add Jump Rate
                                    </button>
                                )}
                            </div>

                            <div className="qty-rate-table">
                                <div className="qty-rate-table__header">
                                    <span>TYPE</span>
                                    <span style={{ textAlign: 'center' }}>FEET</span>
                                    <span style={{ textAlign: 'center' }}>RATE</span>
                                    <span style={{ textAlign: 'center' }}>AMOUNT</span>
                                </div>

                                {/* Fixed standard rows */}
                                <QtyRateAmountRow label="Drilling upto Casing" prefix="drill_upto_casing" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="Empty Drilling"        prefix="empty_drilling"    data={formData} onChange={handleChange} viewMode={viewMode} />

                                {/* Dynamic custom jump-rate rows */}
                                {customDrilling.map(row => (
                                    <div key={row.id} className="qty-rate-row qty-rate-row--no-border qty-rate-row--compact">
                                        {/* Label (editable text) */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <input
                                                type="text"
                                                value={row.label}
                                                onChange={(e) => handleCustomDrillingChange(row.id, 'label', e.target.value)}
                                                placeholder="e.g. Jump after 300ft"
                                                className="qty-rate-row__input"
                                                disabled={viewMode}
                                                style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: '600', textAlign: 'left' }}
                                            />
                                        </div>
                                        {/* Feet */}
                                        <input
                                            type="number"
                                            value={row.feet === '' ? '' : (row.feet || '')}
                                            onChange={(e) => handleCustomDrillingChange(row.id, 'feet', e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="0"
                                            min="0"
                                            className={`qty-rate-row__input ${viewMode ? 'qty-rate-row__input--readonly' : ''}`}
                                            disabled={viewMode}
                                            style={{ textAlign: 'center' }}
                                        />
                                        {/* Rate */}
                                        <input
                                            type="number"
                                            value={row.rate === '' ? '' : (row.rate || '')}
                                            onChange={(e) => handleCustomDrillingChange(row.id, 'rate', e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            placeholder="0"
                                            min="0"
                                            className={`qty-rate-row__input ${viewMode ? 'qty-rate-row__input--readonly' : ''}`}
                                            disabled={viewMode}
                                            style={{ textAlign: 'center' }}
                                        />
                                        {/* Amount (auto-calc) */}
                                        <input
                                            type="number"
                                            value={row.amt === 0 ? '' : (row.amt || '')}
                                            readOnly
                                            placeholder="0"
                                            className="qty-rate-row__input qty-rate-row__input--readonly"
                                            style={{ textAlign: 'center' }}
                                        />
                                        {/* Remove button (absolutely positioned, appears on row hover) */}
                                        {!viewMode && (
                                            <button
                                                type="button"
                                                className="delete-btn"
                                                onClick={() => removeCustomDrilling(row.id)}
                                                title="Remove Row"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}

                                {/* Total Drilling summary row */}
                                <div className="qty-rate-row" style={{ background: 'var(--bg-tertiary)', borderTop: 'none', borderRadius: '4px', marginTop: '4px' }}>
                                    <span style={{ fontWeight: '700', paddingLeft: '8px' }}>Total Drilling</span>
                                    <input type="number" readOnly value={formData.total_drilling_feet || 0} className="qty-rate-row__input qty-rate-row__input--readonly" style={{ textAlign: 'center' }} />
                                    <span></span>
                                    <input type="number" readOnly value={formData.total_drilling_amt || 0}  className="qty-rate-row__input qty-rate-row__input--readonly" style={{ textAlign: 'center', color: 'var(--color-primary)', fontWeight: '700' }} />
                                </div>
                            </div>
                        </div>

                        {/* ── 3. Casing Details ──────────────────────────── */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">Casing Details</h3>
                            <div className="qty-rate-table">
                                <div className="qty-rate-table__header">
                                    <span>TYPE</span>
                                    <span style={{ textAlign: 'center' }}>PER FEET</span>
                                    <span style={{ textAlign: 'center' }}>RATE</span>
                                    <span style={{ textAlign: 'center' }}>AMOUNT</span>
                                </div>
                                <QtyRateAmountRow label="140mm/5 inches 6kg"  prefix="cas140"    data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="180mm/7 inches 4kg"  prefix="cas180_4g" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="180mm/7 inches 6kg"  prefix="cas180_6g" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="250mm/10 inches 4kg" prefix="cas250_4g" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <QtyRateAmountRow label="250mm/10 inches 6kg" prefix="cas250_6g" data={formData} onChange={handleChange} viewMode={viewMode} />
                                <div className="qty-rate-row" style={{ background: 'var(--bg-tertiary)', borderTop: 'none', borderRadius: '4px', marginTop: '4px' }}>
                                    <span style={{ fontWeight: '700', paddingLeft: '8px' }}>Total Casing</span>
                                    <input type="number" readOnly value={formData.total_casing_feet || 0} className="qty-rate-row__input qty-rate-row__input--readonly" style={{ textAlign: 'center' }} />
                                    <span></span>
                                    <input type="number" readOnly value={formData.total_casing_amt  || 0} className="qty-rate-row__input qty-rate-row__input--readonly" style={{ textAlign: 'center', color: 'var(--color-primary)', fontWeight: '700' }} />
                                </div>
                            </div>
                        </div>

                        {/* ── 4. Slotting & Additional Charges ──────────── */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">Slotting &amp; Additional Charges</h3>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                                <InputField label="No. of Pipes (Slotting)" name="slotting_pipes" type="number" value={formData.slotting_pipes} onChange={handleChange} viewMode={viewMode} />
                                <InputField label="Slotting Rate"           name="slotting_rate"  type="number" value={formData.slotting_rate}  onChange={handleChange} viewMode={viewMode} />
                                <InputField label="Slotting Total"          name="slotting_amt"   type="number" value={formData.slotting_amt}   readOnly viewMode={viewMode} />
                                <InputField label="Labour Charge"           name="labour_charge"  type="number" value={formData.labour_charge}  onChange={handleChange} viewMode={viewMode} />
                                <InputField label="RPM Hrs Reading"             name="rpm"            type="number" value={formData.rpm}            onChange={handleChange} viewMode={viewMode} />
                            </div>
                        </div>

                        {/* ── 5. Pipes Tracking ─────────────────────────── */}
                        <div className="govt-bore-modal__section">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 className="govt-bore-modal__section-title" style={{ marginBottom: 0 }}>Pipes Tracking</h3>
                                {!viewMode && (
                                    <button 
                                        type="button" 
                                        onClick={addPipeTracker} 
                                        className="btn btn-secondary btn-sm" 
                                        style={{ fontSize: '11px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                                    >
                                        <Plus size={12} /> Add Pipe
                                    </button>
                                )}
                            </div>
                            
                            {pipesList.map((pipe, index) => (
                                <div key={pipe.id} className="govt-bore-modal__subsection" style={{ 
                                    position: 'relative',
                                    marginTop: index === 0 ? 0 : '16px',
                                    marginBottom: '16px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Pipe #{index + 1}</h4>
                                        {!viewMode && (
                                            <button type="button" onClick={() => removePipeTracker(pipe.id)} style={{ color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                    
                                    <div className="govt-bore-modal__grid govt-bore-modal__grid--3" style={{ marginBottom: '16px' }}>
                                        <div className="form-field">
                                            <label className="form-field__label">Source</label>
                                            <select 
                                                value={pipe.source} 
                                                onChange={(e) => handlePipeTrackerChange(pipe.id, 'source', e.target.value)} 
                                                disabled={viewMode} 
                                                className="form-field__input"
                                            >
                                                <option value="Home Stock">Home Stock</option>
                                                <option value="Direct Purchase">Direct Purchase</option>
                                                <option value="Borrowed">Borrowed</option>
                                            </select>
                                        </div>

                                        {pipe.source === 'Home Stock' ? (
                                            <div className="form-field" style={{ gridColumn: 'span 2' }}>
                                                <label className="form-field__label">Inventory Pipe</label>
                                                <select 
                                                    value={pipe.pipe_inventory_id || ''} 
                                                    onChange={(e) => handlePipeTrackerChange(pipe.id, 'pipe_inventory_id', e.target.value)} 
                                                    disabled={viewMode} 
                                                    className="form-field__input"
                                                >
                                                    <option value="">Select pipe from store</option>
                                                    {pipeOptions.map((opt) => (
                                                        <option key={opt.id} value={opt.id}>
                                                            {opt.company} · {opt.size}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <>
                                                {pipe.source === 'Borrowed' ? (
                                                    <InputField label="Borrowed From" value={pipe.borrowed_from} onChange={(e) => handlePipeTrackerChange(pipe.id, 'borrowed_from', e.target.value)} viewMode={viewMode} placeholder="Name of person" />
                                                ) : (
                                                    <InputField label="Company Name" value={pipe.company_name} onChange={(e) => handlePipeTrackerChange(pipe.id, 'company_name', e.target.value)} viewMode={viewMode} />
                                                )}
                                                <InputField label="Pipe Size" value={pipe.pipe_size} onChange={(e) => handlePipeTrackerChange(pipe.id, 'pipe_size', e.target.value)} viewMode={viewMode} placeholder="e.g. 5&#34;, 7&#34;, 10&#34;" />
                                            </>
                                        )}
                                    </div>

                                    {pipe.source !== 'Home Stock' && (
                                        <div className="govt-bore-modal__grid govt-bore-modal__grid--4" style={{ marginBottom: '16px' }}>
                                            <InputField label="Material" value={pipe.material_type} onChange={(e) => handlePipeTrackerChange(pipe.id, 'material_type', e.target.value)} viewMode={viewMode} placeholder="e.g. PVC" />
                                            <div className="form-field">
                                                <label className="form-field__label">Quality Grade</label>
                                                <select
                                                    value={pipe.quality_grade || ''}
                                                    onChange={(e) => handlePipeTrackerChange(pipe.id, 'quality_grade', e.target.value)}
                                                    disabled={viewMode}
                                                    className="form-field__input"
                                                >
                                                    <option value="">Select quality</option>
                                                    <option value="Gold">Gold</option>
                                                    <option value="Special">Special</option>
                                                    <option value="Standard">Standard</option>
                                                </select>
                                            </div>
                                            <InputField label="Length / Pipe (Ft)" type="number" value={pipe.length_feet} onChange={(e) => handlePipeTrackerChange(pipe.id, 'length_feet', e.target.value)} viewMode={viewMode} />
                                            <InputField label="Cost / Unit" type="number" value={pipe.cost_per_unit} onChange={(e) => handlePipeTrackerChange(pipe.id, 'cost_per_unit', e.target.value)} viewMode={viewMode} />
                                        </div>
                                    )}

                                    <div className="govt-bore-modal__grid govt-bore-modal__grid--4" style={{ marginBottom: pipe.source !== 'Home Stock' ? '16px' : '0' }}>
                                        <InputField label="On Vehicle (Nos)" type="number" value={pipe.on_vehicle} onChange={(e) => handlePipeTrackerChange(pipe.id, 'on_vehicle', e.target.value)} viewMode={viewMode || pipe.source === 'Home Stock'} />
                                        <InputField label="Used (Nos)" type="number" value={pipe.used_nos} onChange={(e) => handlePipeTrackerChange(pipe.id, 'used_nos', e.target.value)} viewMode={viewMode} />
                                        <InputField label="Used (Ft)" type="number" value={pipe.used_ft} onChange={(e) => handlePipeTrackerChange(pipe.id, 'used_ft', e.target.value)} viewMode={viewMode} />
                                        <div className="form-field">
                                            <label className="form-field__label">Left (Auto)</label>
                                            <input type="number" value={pipe.left_auto} readOnly className="form-field__input qty-rate-row__input--readonly" style={{ color: pipe.left_auto < 0 ? 'var(--color-danger)' : 'inherit' }} />
                                        </div>
                                    </div>

                                    {pipe.source !== 'Home Stock' && (
                                        <InputField label="Remarks" value={pipe.remarks} onChange={(e) => handlePipeTrackerChange(pipe.id, 'remarks', e.target.value)} viewMode={viewMode} placeholder="Enter remarks" />
                                    )}
                                    
                                    {(parseFloat(pipe.used_nos) > parseFloat(pipe.on_vehicle)) && (
                                        <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '8px', fontWeight: 'bold' }}>
                                            Error: Used amount cannot exceed On Vehicle amount.
                                        </div>
                                    )}
                                </div>
                            ))}
                            
                            {pipesList.length === 0 && (
                                <div className="govt-bore-modal__subsection" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', marginTop: 0 }}>
                                    No pipes tracked. Click "Add Pipe" to begin.
                                </div>
                            )}
                        </div>

                        {/* ── 6. Time Log ───────────────────────────────── */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">Time Log</h3>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                                <InputField label="Start Time" name="start_time" type="number" value={formData.start_time} onChange={handleChange} viewMode={viewMode} />
                                <InputField label="End Time"   name="end_time"   type="number" value={formData.end_time}   onChange={handleChange} viewMode={viewMode} />
                                <InputField label="Total Hours" name="total_hrs" type="number" value={formData.total_hrs} readOnly viewMode={viewMode} />
                            </div>
                        </div>

                        {/* ── 7. Payment Summary ────────────────────────── */}
                        <div className="govt-bore-modal__section">
                            <h3 className="govt-bore-modal__section-title">Payment Summary</h3>
                            <div className="govt-bore-modal__grid govt-bore-modal__grid--3">
                                <div style={{ gridColumn: 'span 2' }}>
                                    <div className="govt-bore-modal__grid govt-bore-modal__grid--fixed-2">
                                        <InputField label="PhonePe Received"       name="phone_pe_received"      type="number" value={formData.phone_pe_received}      onChange={handleChange} viewMode={viewMode} />
                                        <InputField label="Transferred To (Name)"  name="phone_pe_receiver_name" value={formData.phone_pe_receiver_name}               onChange={handleChange} viewMode={viewMode} />
                                        <InputField label="Cash Paid"              name="cash_paid"              type="number" value={formData.cash_paid}              onChange={handleChange} viewMode={viewMode} />
                                        <InputField label="Discount"               name="discount"               type="number" value={formData.discount}               onChange={handleChange} viewMode={viewMode} />
                                    </div>
                                </div>
                                <div style={{ background: 'transparent', border: '2px solid #e0b100', borderRadius: '14px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#6b5a00' }}>
                                        <span>Net Amount</span>
                                        <strong style={{ fontSize: '16px', color: '#3d3400' }}>₹{(formData.total_amount || 0).toLocaleString()}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#6b5a00' }}>
                                        <span>Amount Paid</span>
                                        <strong style={{ fontSize: '16px', color: '#1a7a1a' }}>₹{(formData.amount_paid || 0).toLocaleString()}</strong>
                                    </div>
                                    <div style={{ borderTop: '1px dashed #e0b100', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#6b5a00' }}>
                                        <span style={{ fontWeight: '600' }}>Balance</span>
                                        <strong style={{ fontSize: '18px', color: (formData.balance || 0) > 0 ? '#c0392b' : '#1a7a1a' }}>₹{(formData.balance || 0).toLocaleString()}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                <div className="govt-bore-editor__actions">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    {!viewMode && (
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {saving ? 'Saving...' : <><Save size={18} /> {record ? 'Update Record' : 'Save Record'}</>}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}
