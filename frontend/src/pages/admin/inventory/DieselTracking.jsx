import { useState, useEffect, useCallback } from 'react';
import {
    Plus, Fuel, TrendingUp, FileText, Edit, Trash2,
    X, CheckCircle, AlertCircle, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';
import axios from 'axios';
import './InventoryPage.css';
import './DieselTracking.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const PAGE_SIZE = 15;

/* ── Toast ── */
function Toast({ type, message, onClose }) {
    useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [onClose]);
    return (
        <div className={`inv-toast inv-toast--${type}`}>
            {type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {message}
            <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={16} /></button>
        </div>
    );
}

/* ── Confirm ── */
function ConfirmDialog({ message, onConfirm, onCancel }) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="inv-confirm" onClick={e => e.stopPropagation()}>
                <div className="inv-confirm__title">Confirm Delete</div>
                <p className="inv-confirm__msg">{message}</p>
                <div className="inv-confirm__actions">
                    <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={onCancel}>Cancel</button>
                    <button className="inv-btn inv-btn--danger inv-btn--sm" onClick={onConfirm}>Delete</button>
                </div>
            </div>
        </div>
    );
}

const today = () => new Date().toISOString().split('T')[0];
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

export function DieselTracking() {
    const [records, setRecords] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditing] = useState(null);
    const [toast, setToast] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [page, setPage] = useState(1);
    const [dateRange, setDateRange] = useState({ start: monthStart(), end: today() });
    const [vehicleSearch, setVehicleSearch] = useState('');
    const [formData, setFormData] = useState({
        vehicle_name: '', purchase_date: today(),
        supervisor_name: '', amount: '', liters: '', bill_url: '', remarks: ''
    });

    const showToast = (type, msg) => setToast({ type, message: msg });
    const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

    const fetchRecords = useCallback(async () => {
        try {
            const r = await axios.get(`${API_URL}/inventory/diesel`, {
                params: { start_date: dateRange.start, end_date: dateRange.end },
                headers: authH()
            });
            setRecords(r.data.data);
        } catch { /* silent */ }
    }, [dateRange]);

    const fetchSummary = useCallback(async () => {
        try {
            const r = await axios.get(`${API_URL}/inventory/diesel/summary`, {
                params: { start_date: dateRange.start, end_date: dateRange.end },
                headers: authH()
            });
            setSummary(r.data.data);
        } catch { /* silent */ }
    }, [dateRange]);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchRecords(), fetchSummary()]).finally(() => setLoading(false));
    }, [fetchRecords, fetchSummary]);

    const openModal = (record = null) => {
        setEditing(record);
        setFormData(record ? {
            vehicle_name: record.vehicle_name,
            purchase_date: record.purchase_date?.split('T')[0] || record.purchase_date,
            supervisor_name: record.supervisor_name || '',
            amount: record.amount,
            liters: record.liters || '',
            bill_url: record.bill_url || '',
            remarks: record.remarks || ''
        } : { vehicle_name: '', purchase_date: today(), supervisor_name: '', amount: '', liters: '', bill_url: '', remarks: '' });
        setShowModal(true);
    };
    const closeModal = () => { setShowModal(false); setEditing(null); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = { ...formData, amount: parseFloat(formData.amount), liters: formData.liters ? parseFloat(formData.liters) : null };
            if (editingRecord) {
                await axios.put(`${API_URL}/inventory/diesel/${editingRecord.id}`, payload, { headers: authH() });
                showToast('success', 'Diesel record updated');
            } else {
                await axios.post(`${API_URL}/inventory/diesel`, payload, { headers: authH() });
                showToast('success', 'Diesel record added');
            }
            await Promise.all([fetchRecords(), fetchSummary()]);
            closeModal();
        } catch (err) {
            showToast('error', err.response?.data?.message || 'An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (record) => {
        setConfirm({
            message: `Delete diesel record for ${record.vehicle_name} on ${new Date(record.purchase_date).toLocaleDateString()}?`,
            onConfirm: async () => {
                setConfirm(null);
                try {
                    await axios.delete(`${API_URL}/inventory/diesel/${record.id}`, { headers: authH() });
                    showToast('success', 'Record deleted');
                    await Promise.all([fetchRecords(), fetchSummary()]);
                } catch (err) {
                    showToast('error', err.response?.data?.message || 'Error deleting record');
                }
            }
        });
    };

    if (loading) return <div className="inv-spinner"><div className="inv-spinner__ring" />Loading diesel records…</div>;

    /* Derived */
    const totalAmt = summary?.summary?.total_amount ? parseFloat(summary.summary.total_amount) : 0;
    const totalLiters = summary?.summary?.total_liters ? parseFloat(summary.summary.total_liters) : 0;
    const totalRecs = summary?.summary?.total_records ? parseInt(summary.summary.total_records) : 0;
    const avgPriceL = totalLiters > 0 ? (totalAmt / totalLiters).toFixed(2) : '—';

    const maxVehicleAmt = summary?.byVehicle?.length > 0
        ? Math.max(...summary.byVehicle.map(v => parseFloat(v.total_amount || 0)))
        : 1;

    const filteredRecords = records.filter(r => {
        if (!vehicleSearch) return true;
        return r.vehicle_name?.toLowerCase().includes(vehicleSearch.toLowerCase());
    });

    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
    const pageRecs = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return (
        <div>
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

            {/* Stats */}
            <div className="inv-stats">
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className="inv-stat__icon inv-stat__icon--amber"><Fuel size={18} /></div></div>
                    <div className="inv-stat__value">₹{totalAmt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
                    <div className="inv-stat__label">Total Spend</div>
                    <div className="inv-stat__sub">Selected period</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className="inv-stat__icon inv-stat__icon--blue"><TrendingUp size={18} /></div></div>
                    <div className="inv-stat__value">{totalLiters > 0 ? totalLiters.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : '—'} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>L</span></div>
                    <div className="inv-stat__label">Total Liters</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className="inv-stat__icon inv-stat__icon--green"><TrendingUp size={18} /></div></div>
                    <div className="inv-stat__value">₹{avgPriceL}</div>
                    <div className="inv-stat__label">Avg Price/Liter</div>
                    <div className="inv-stat__sub">Period average</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className="inv-stat__icon inv-stat__icon--blue"><FileText size={18} /></div></div>
                    <div className="inv-stat__value">{totalRecs}</div>
                    <div className="inv-stat__label">Total Records</div>
                </div>
            </div>

            {/* Controls */}
            <div className="inv-controls">
                <div className="inv-filters">
                    <Calendar size={15} style={{ color: 'var(--text-muted)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>From</label>
                        <input type="date" className="inv-filter-input" value={dateRange.start}
                            onChange={e => { setDateRange(d => ({ ...d, start: e.target.value })); setPage(1); }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>To</label>
                        <input type="date" className="inv-filter-input" value={dateRange.end}
                            onChange={e => { setDateRange(d => ({ ...d, end: e.target.value })); setPage(1); }} />
                    </div>
                    <input type="text" className="inv-filter-input" placeholder="Filter by vehicle…" value={vehicleSearch}
                        onChange={e => { setVehicleSearch(e.target.value); setPage(1); }} style={{ minWidth: 180 }} />
                </div>
                <button className="inv-btn inv-btn--primary inv-btn--sm" onClick={() => openModal()}>
                    <Plus size={15} /> Add Diesel Record
                </button>
            </div>

            {/* Records Table */}
            <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="inv-section-header">
                    <span className="inv-section-title">Diesel Records</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{filteredRecords.length} records</span>
                </div>
                <div className="inv-table-wrap">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Vehicle</th>
                                <th>Supervisor</th>
                                <th>Amount (₹)</th>
                                <th>Liters</th>
                                <th>Price/L</th>
                                <th>Bill</th>
                                <th>Remarks</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageRecs.length === 0 ? (
                                <tr><td colSpan="9" className="inv-table__empty">No diesel records for this period.</td></tr>
                            ) : (
                                pageRecs.map(rec => {
                                    const pricePerL = rec.liters && parseFloat(rec.liters) > 0
                                        ? (parseFloat(rec.amount) / parseFloat(rec.liters)).toFixed(2)
                                        : null;
                                    return (
                                        <tr key={rec.id}>
                                            <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                                {new Date(rec.purchase_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{rec.vehicle_name}</td>
                                            <td style={{ color: 'var(--text-muted)' }}>{rec.supervisor_name || '—'}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>
                                                ₹{parseFloat(rec.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ fontVariantNumeric: 'tabular-nums' }}>{rec.liters ? `${parseFloat(rec.liters).toFixed(2)} L` : '—'}</td>
                                            <td style={{ color: pricePerL ? 'var(--text-secondary)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                                {pricePerL ? `₹${pricePerL}` : '—'}
                                            </td>
                                            <td>
                                                {rec.bill_url ? (
                                                    <a href={rec.bill_url} target="_blank" rel="noopener noreferrer"
                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-primary)', fontSize: '0.78rem' }}>
                                                        <FileText size={13} /> View
                                                    </a>
                                                ) : '—'}
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rec.remarks || '—'}</td>
                                            <td>
                                                <div className="inv-actions">
                                                    <button className="inv-action-btn inv-action-btn--edit" title="Edit" onClick={() => openModal(rec)}><Edit size={13} /></button>
                                                    <button className="inv-action-btn inv-action-btn--delete" title="Delete" onClick={() => handleDelete(rec)}><Trash2 size={13} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    {totalPages > 1 && (
                        <div className="inv-pagination">
                            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredRecords.length)} of {filteredRecords.length}</span>
                            <div className="inv-pagination__btns">
                                <button className="inv-pagination__btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft size={13} /></button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                                    return <button key={pg} className={`inv-pagination__btn ${page === pg ? 'inv-pagination__btn--active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>;
                                })}
                                <button className="inv-pagination__btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}><ChevronRight size={13} /></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Consuming Vehicles */}
            {summary?.byVehicle?.length > 0 && (
                <div>
                    <div className="inv-section-header">
                        <span className="inv-section-title">Top Consuming Vehicles</span>
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>By spend — selected period</span>
                    </div>
                    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                        {summary.byVehicle.slice(0, 5).map((v, idx) => {
                            const amt = parseFloat(v.total_amount || 0);
                            const lit = parseFloat(v.total_liters || 0);
                            const pct = maxVehicleAmt > 0 ? (amt / maxVehicleAmt) * 100 : 0;
                            return (
                                <div key={idx} style={{
                                    display: 'grid', gridTemplateColumns: '28px 1fr auto',
                                    alignItems: 'center', gap: 'var(--spacing-4)',
                                    padding: 'var(--spacing-3) var(--spacing-5)',
                                    borderBottom: idx < Math.min(4, summary.byVehicle.length - 1) ? '1px solid var(--border-color)' : 'none'
                                }}>
                                    <span style={{ fontWeight: 800, fontSize: '1rem', color: idx === 0 ? 'var(--color-warning)' : 'var(--text-muted)', textAlign: 'center' }}>
                                        #{idx + 1}
                                    </span>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', marginBottom: 4 }}>{v.vehicle_name}</div>
                                        <div style={{ background: 'var(--border-color)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: idx === 0 ? 'var(--color-warning)' : 'var(--color-primary)', borderRadius: 4, transition: 'width 0.4s ease' }} />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontWeight: 700, color: 'var(--color-warning)', fontSize: 'var(--font-size-sm)' }}>
                                            ₹{amt.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                            {lit > 0 ? `${lit.toFixed(1)} L · ${v.vehicle_count} fills` : `${v.vehicle_count} record${v.vehicle_count > 1 ? 's' : ''}`}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="inv-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                        <div className="inv-modal__header">
                            <span className="inv-modal__title">
                                {editingRecord ? <><Edit size={16} /> Edit Diesel Record</> : <><Plus size={16} /> Add Diesel Record</>}
                            </span>
                            <button className="inv-modal__close" onClick={closeModal}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="inv-modal__body">
                                <div className="inv-form-row">
                                    <div className="inv-form-group">
                                        <label>Vehicle Name *</label>
                                        <input type="text" value={formData.vehicle_name} onChange={e => setFormData(f => ({ ...f, vehicle_name: e.target.value }))} placeholder="e.g. TN 01 AB 1234" required />
                                    </div>
                                    <div className="inv-form-group">
                                        <label>Purchase Date *</label>
                                        <input type="date" value={formData.purchase_date} max={today()} onChange={e => setFormData(f => ({ ...f, purchase_date: e.target.value }))} required />
                                    </div>
                                </div>
                                <div className="inv-form-group">
                                    <label>Supervisor Name</label>
                                    <input type="text" value={formData.supervisor_name} onChange={e => setFormData(f => ({ ...f, supervisor_name: e.target.value }))} placeholder="Optional" />
                                </div>
                                <div className="inv-form-row">
                                    <div className="inv-form-group">
                                        <label>Amount (₹) *</label>
                                        <input type="number" step="0.01" min="0" value={formData.amount} onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
                                    </div>
                                    <div className="inv-form-group">
                                        <label>Liters</label>
                                        <input type="number" step="0.01" min="0" value={formData.liters} onChange={e => setFormData(f => ({ ...f, liters: e.target.value }))} placeholder="0.00" />
                                    </div>
                                </div>
                                {formData.amount && formData.liters && parseFloat(formData.liters) > 0 && (
                                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', fontWeight: 600 }}>
                                        <Fuel size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Price per liter: ₹{(parseFloat(formData.amount) / parseFloat(formData.liters)).toFixed(2)}
                                    </div>
                                )}
                                <div className="inv-form-group">
                                    <label>Bill URL</label>
                                    <input type="url" value={formData.bill_url} onChange={e => setFormData(f => ({ ...f, bill_url: e.target.value }))} placeholder="https://…" />
                                    <div className="inv-form-hint">Paste a link to the uploaded bill document</div>
                                </div>
                                <div className="inv-form-group">
                                    <label>Remarks</label>
                                    <textarea value={formData.remarks} onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Optional notes…" />
                                </div>
                            </div>
                            <div className="inv-modal__footer">
                                <button type="button" className="inv-btn inv-btn--ghost" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="inv-btn inv-btn--primary" disabled={submitting}>
                                    {submitting ? 'Saving…' : (editingRecord ? 'Update Record' : 'Add Record')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
