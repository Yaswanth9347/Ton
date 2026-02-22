import { useState, useEffect, useCallback } from 'react';
import {
    Plus, Send, RotateCcw, Wrench, CheckCircle, AlertCircle,
    Settings, Trash2, X, Filter, ChevronLeft, ChevronRight
} from 'lucide-react';
import axios from 'axios';
import './InventoryPage.css';
import './SparesInventory.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const PAGE_SIZE = 12;

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

const STATUS_LABEL = { AVAILABLE: 'Available', IN_USE: 'In Use', MAINTENANCE: 'Maintenance' };
const STATUS_KEY = { AVAILABLE: 'available', IN_USE: 'in_use', MAINTENANCE: 'maintenance' };

export function SparesInventory() {
    const [spares, setSpares] = useState([]);
    const [transactions, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [selSpare, setSelSpare] = useState(null);
    const [toast, setToast] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [txPage, setTxPage] = useState(1);
    const [txFilters, setTxFilters] = useState({ type: 'ALL', action: 'ALL', search: '' });
    const [filterType, setFilterType] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [formData, setFormData] = useState({ spare_type: 'OB', spare_number: '', vehicle_name: '', supervisor_name: '', remarks: '' });

    const showToast = (type, msg) => setToast({ type, message: msg });
    const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

    const fetchSpares = useCallback(async () => {
        try {
            const params = {};
            if (filterType !== 'ALL') params.spare_type = filterType;
            if (filterStatus !== 'ALL') params.status = filterStatus;
            const r = await axios.get(`${API_URL}/inventory/spares`, { params, headers: authH() });
            setSpares(r.data.data);
        } catch { /* silent */ }
    }, [filterType, filterStatus]);

    const fetchTxns = useCallback(async () => {
        try {
            const r = await axios.get(`${API_URL}/inventory/spares/transactions`, { headers: authH() });
            setTxns(r.data.data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { Promise.all([fetchSpares(), fetchTxns()]).finally(() => setLoading(false)); }, [fetchSpares, fetchTxns]);
    useEffect(() => { fetchSpares(); }, [filterType, filterStatus]);

    const openModal = (type, spare = null) => {
        setModalType(type);
        setSelSpare(spare);
        setFormData({ spare_type: 'OB', spare_number: '', vehicle_name: spare?.vehicle_name || '', supervisor_name: spare?.supervisor_name || '', remarks: '' });
        setShowModal(true);
    };
    const closeModal = () => { setShowModal(false); setSelSpare(null); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const headers = authH();
            if (modalType === 'add') {
                await axios.post(`${API_URL}/inventory/spares`, { spare_type: formData.spare_type, spare_number: formData.spare_number }, { headers });
                showToast('success', `${formData.spare_type} #${formData.spare_number} added`);
            } else if (modalType === 'issue') {
                await axios.post(`${API_URL}/inventory/spares/${selSpare.id}/issue`,
                    { vehicle_name: formData.vehicle_name, supervisor_name: formData.supervisor_name, remarks: formData.remarks }, { headers });
                showToast('success', `${selSpare.spare_number} issued to ${formData.vehicle_name}`);
            } else if (modalType === 'return') {
                await axios.post(`${API_URL}/inventory/spares/${selSpare.id}/return`, { remarks: formData.remarks }, { headers });
                showToast('success', `${selSpare.spare_number} returned to home`);
            } else if (modalType === 'maintenance') {
                await axios.patch(`${API_URL}/inventory/spares/${selSpare.id}/status`, { status: 'MAINTENANCE' }, { headers });
                showToast('warning', `${selSpare.spare_number} marked for maintenance`);
            }
            await Promise.all([fetchSpares(), fetchTxns()]);
            closeModal();
        } catch (err) {
            showToast('error', err.response?.data?.message || 'An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (spare) => {
        setConfirm({
            message: `Delete spare "${spare.spare_type} - ${spare.spare_number}"? This cannot be undone.`,
            onConfirm: async () => {
                setConfirm(null);
                try {
                    await axios.delete(`${API_URL}/inventory/spares/${spare.id}`, { headers: authH() });
                    showToast('success', 'Spare deleted');
                    fetchSpares();
                } catch (err) {
                    showToast('error', err.response?.data?.message || 'Error deleting spare');
                }
            }
        });
    };

    if (loading) return <div className="inv-spinner"><div className="inv-spinner__ring" />Loading spares…</div>;

    /* Stats */
    const stats = {
        totalOB: spares.filter(s => s.spare_type === 'OB').length,
        availOB: spares.filter(s => s.spare_type === 'OB' && s.status === 'AVAILABLE').length,
        inUseOB: spares.filter(s => s.spare_type === 'OB' && s.status === 'IN_USE').length,
        maintOB: spares.filter(s => s.spare_type === 'OB' && s.status === 'MAINTENANCE').length,
        totalBIT: spares.filter(s => s.spare_type === 'BIT').length,
        availBIT: spares.filter(s => s.spare_type === 'BIT' && s.status === 'AVAILABLE').length,
        inUseBIT: spares.filter(s => s.spare_type === 'BIT' && s.status === 'IN_USE').length,
        maintBIT: spares.filter(s => s.spare_type === 'BIT' && s.status === 'MAINTENANCE').length,
    };

    /* Filtered transactions */
    const filtTxns = transactions.filter(tx => {
        if (txFilters.type !== 'ALL' && tx.spare_type !== txFilters.type) return false;
        if (txFilters.action !== 'ALL' && tx.transaction_type !== txFilters.action) return false;
        if (txFilters.search) {
            const q = txFilters.search.toLowerCase();
            if (!tx.spare_number?.toLowerCase().includes(q) && !tx.vehicle_name?.toLowerCase().includes(q)) return false;
        }
        return true;
    });

    const totalTxPages = Math.max(1, Math.ceil(filtTxns.length / PAGE_SIZE));
    const pageTxns = filtTxns.slice((txPage - 1) * PAGE_SIZE, txPage * PAGE_SIZE);

    return (
        <div>
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

            {/* Stats */}
            <div className="inv-stats">
                {/* OB Cards */}
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className="inv-stat__icon inv-stat__icon--blue"><Wrench size={18} /></div></div>
                    <div className="inv-stat__value">{stats.availOB} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {stats.totalOB}</span></div>
                    <div className="inv-stat__label">OBs Available</div>
                    <div className="inv-stat__sub">{stats.inUseOB} in use · {stats.maintOB} maintenance</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className="inv-stat__icon inv-stat__icon--green"><Settings size={18} /></div></div>
                    <div className="inv-stat__value">{stats.availBIT} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {stats.totalBIT}</span></div>
                    <div className="inv-stat__label">Bits Available</div>
                    <div className="inv-stat__sub">{stats.inUseBIT} in use · {stats.maintBIT} maintenance</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className={`inv-stat__icon inv-stat__icon--${stats.inUseOB + stats.inUseBIT > 0 ? 'amber' : 'green'}`}><Send size={18} /></div></div>
                    <div className="inv-stat__value">{stats.inUseOB + stats.inUseBIT}</div>
                    <div className="inv-stat__label">Total In Use</div>
                    <div className="inv-stat__sub">Deployed to vehicles</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className={`inv-stat__icon inv-stat__icon--${stats.maintOB + stats.maintBIT > 0 ? 'red' : 'green'}`}><AlertCircle size={18} /></div></div>
                    <div className="inv-stat__value">{stats.maintOB + stats.maintBIT}</div>
                    <div className="inv-stat__label">Maintenance</div>
                </div>
            </div>

            {/* Controls + Spares Table */}
            <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="inv-section-header">
                    <span className="inv-section-title">Spares Register</span>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                        <select className="inv-filter-input inv-filter-input--sm" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ minWidth: 110 }}>
                            <option value="ALL">All Types</option>
                            <option value="OB">OB Only</option>
                            <option value="BIT">Bit Only</option>
                        </select>
                        <select className="inv-filter-input inv-filter-input--sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth: 130 }}>
                            <option value="ALL">All Status</option>
                            <option value="AVAILABLE">Available</option>
                            <option value="IN_USE">In Use</option>
                            <option value="MAINTENANCE">Maintenance</option>
                        </select>
                        <button className="inv-btn inv-btn--primary inv-btn--sm" onClick={() => openModal('add')}>
                            <Plus size={15} /> Add Spare
                        </button>
                    </div>
                </div>

                <div className="inv-table-wrap">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Spare #</th>
                                <th>Status</th>
                                <th>Location</th>
                                <th>Vehicle</th>
                                <th>Supervisor</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {spares.length === 0 ? (
                                <tr><td colSpan="7" className="inv-table__empty">No spares found. Add one to get started.</td></tr>
                            ) : (
                                spares.map(spare => (
                                    <tr key={spare.id}>
                                        <td>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.8rem',
                                                color: spare.spare_type === 'OB' ? 'var(--color-primary)' : 'var(--color-warning)',
                                                background: spare.spare_type === 'OB' ? 'rgba(37,99,235,0.1)' : 'rgba(245,158,11,0.1)',
                                                padding: '3px 10px', borderRadius: 'var(--radius-full)'
                                            }}>
                                                {spare.spare_type === 'OB' ? <Wrench size={12} /> : <Settings size={12} />}
                                                {spare.spare_type}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{spare.spare_number}</td>
                                        <td><span className={`status-badge status-badge--${STATUS_KEY[spare.status]}`}><span className="status-badge__dot" />{STATUS_LABEL[spare.status]}</span></td>
                                        <td style={{ color: 'var(--text-muted)' }}>{spare.current_location || 'HOME'}</td>
                                        <td>{spare.vehicle_name || '—'}</td>
                                        <td>{spare.supervisor_name || '—'}</td>
                                        <td>
                                            <div className="inv-actions">
                                                {spare.status === 'AVAILABLE' && (
                                                    <button className="inv-action-btn inv-action-btn--issue" title="Issue to Vehicle" onClick={() => openModal('issue', spare)}><Send size={13} /></button>
                                                )}
                                                {spare.status === 'IN_USE' && (
                                                    <button className="inv-action-btn inv-action-btn--return" title="Return to Home" onClick={() => openModal('return', spare)}><RotateCcw size={13} /></button>
                                                )}
                                                {spare.status !== 'MAINTENANCE' && (
                                                    <button className="inv-action-btn inv-action-btn--maint" title="Set Maintenance" onClick={() => openModal('maintenance', spare)}><Settings size={13} /></button>
                                                )}
                                                {spare.status === 'MAINTENANCE' && (
                                                    <button className="inv-action-btn inv-action-btn--return" title="Mark as Available" onClick={async () => {
                                                        try {
                                                            await axios.patch(`${API_URL}/inventory/spares/${spare.id}/status`, { status: 'AVAILABLE' }, { headers: authH() });
                                                            showToast('success', `${spare.spare_number} marked as available`);
                                                            fetchSpares();
                                                        } catch (err) { showToast('error', err.response?.data?.message || 'Error'); }
                                                    }}><CheckCircle size={13} /></button>
                                                )}
                                                <button className="inv-action-btn inv-action-btn--delete" title="Delete Spare" onClick={() => handleDelete(spare)}><Trash2 size={13} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transaction History */}
            <div>
                <div className="inv-section-header">
                    <span className="inv-section-title">Transaction History</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{filtTxns.length} records</span>
                </div>
                <div className="inv-controls" style={{ marginBottom: 'var(--spacing-3)' }}>
                    <div className="inv-filters">
                        <Filter size={15} style={{ color: 'var(--text-muted)' }} />
                        <input type="text" className="inv-filter-input" placeholder="Search spare # or vehicle…" value={txFilters.search}
                            onChange={e => { setTxFilters(f => ({ ...f, search: e.target.value })); setTxPage(1); }} style={{ minWidth: 200 }} />
                        <select className="inv-filter-input" value={txFilters.type} onChange={e => { setTxFilters(f => ({ ...f, type: e.target.value })); setTxPage(1); }}>
                            <option value="ALL">All Types</option>
                            <option value="OB">OB</option>
                            <option value="BIT">Bit</option>
                        </select>
                        <select className="inv-filter-input" value={txFilters.action} onChange={e => { setTxFilters(f => ({ ...f, action: e.target.value })); setTxPage(1); }}>
                            <option value="ALL">All Actions</option>
                            <option value="ISSUE">Issue</option>
                            <option value="RETURN">Return</option>
                        </select>
                    </div>
                </div>

                <div className="inv-table-wrap">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Spare #</th>
                                <th>Action</th>
                                <th>Vehicle</th>
                                <th>Supervisor</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageTxns.length === 0 ? (
                                <tr><td colSpan="7" className="inv-table__empty">No transactions found.</td></tr>
                            ) : (
                                pageTxns.map(tx => (
                                    <tr key={tx.id}>
                                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                            {new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td>{tx.spare_type}</td>
                                        <td style={{ fontWeight: 600 }}>{tx.spare_number}</td>
                                        <td><span className={`status-badge status-badge--${tx.transaction_type.toLowerCase()}`}>{tx.transaction_type}</span></td>
                                        <td>{tx.vehicle_name || '—'}</td>
                                        <td>{tx.supervisor_name || '—'}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>{tx.remarks || '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {totalTxPages > 1 && (
                        <div className="inv-pagination">
                            <span>Showing {(txPage - 1) * PAGE_SIZE + 1}–{Math.min(txPage * PAGE_SIZE, filtTxns.length)} of {filtTxns.length}</span>
                            <div className="inv-pagination__btns">
                                <button className="inv-pagination__btn" onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1}><ChevronLeft size={13} /></button>
                                {Array.from({ length: Math.min(5, totalTxPages) }, (_, i) => {
                                    const pg = Math.max(1, Math.min(txPage - 2, totalTxPages - 4)) + i;
                                    return <button key={pg} className={`inv-pagination__btn ${txPage === pg ? 'inv-pagination__btn--active' : ''}`} onClick={() => setTxPage(pg)}>{pg}</button>;
                                })}
                                <button className="inv-pagination__btn" onClick={() => setTxPage(p => Math.min(totalTxPages, p + 1))} disabled={txPage === totalTxPages}><ChevronRight size={13} /></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="inv-modal" onClick={e => e.stopPropagation()}>
                        <div className="inv-modal__header">
                            <span className="inv-modal__title">
                                {modalType === 'add' && <><Plus size={16} /> Add New Spare</>}
                                {modalType === 'issue' && <><Send size={16} /> Issue Spare to Vehicle</>}
                                {modalType === 'return' && <><RotateCcw size={16} /> Return Spare to Home</>}
                                {modalType === 'maintenance' && <><Settings size={16} /> Set to Maintenance</>}
                            </span>
                            <button className="inv-modal__close" onClick={closeModal}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="inv-modal__body">
                                {modalType === 'add' && (
                                    <>
                                        <div className="inv-form-group">
                                            <label>Spare Type *</label>
                                            <select value={formData.spare_type} onChange={e => setFormData(f => ({ ...f, spare_type: e.target.value }))} required>
                                                <option value="OB">OB (Outer Barrel)</option>
                                                <option value="BIT">Bit</option>
                                            </select>
                                        </div>
                                        <div className="inv-form-group">
                                            <label>Spare Number *</label>
                                            <input type="text" value={formData.spare_number} onChange={e => setFormData(f => ({ ...f, spare_number: e.target.value }))} placeholder="e.g. OB-001" required />
                                        </div>
                                    </>
                                )}
                                {(modalType === 'issue' || modalType === 'return' || modalType === 'maintenance') && (
                                    <div className="inv-form-group">
                                        <label>Spare</label>
                                        <input type="text" value={`${selSpare?.spare_type} — ${selSpare?.spare_number}`} disabled />
                                    </div>
                                )}
                                {modalType === 'issue' && (
                                    <>
                                        <div className="inv-form-row">
                                            <div className="inv-form-group">
                                                <label>Vehicle Name *</label>
                                                <input type="text" value={formData.vehicle_name} onChange={e => setFormData(f => ({ ...f, vehicle_name: e.target.value }))} placeholder="e.g. TN 01 AB 1234" required />
                                            </div>
                                            <div className="inv-form-group">
                                                <label>Supervisor</label>
                                                <input type="text" value={formData.supervisor_name} onChange={e => setFormData(f => ({ ...f, supervisor_name: e.target.value }))} placeholder="Name" />
                                            </div>
                                        </div>
                                        <div className="inv-form-group">
                                            <label>Remarks</label>
                                            <textarea value={formData.remarks} onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Optional notes…" />
                                        </div>
                                    </>
                                )}
                                {(modalType === 'return' || modalType === 'maintenance') && (
                                    <>
                                        {selSpare?.vehicle_name && (
                                            <div className="inv-form-group">
                                                <label>Current Vehicle</label>
                                                <input type="text" value={selSpare.vehicle_name} disabled />
                                            </div>
                                        )}
                                        <div className="inv-form-group">
                                            <label>Remarks{modalType === 'maintenance' ? ' / Reason' : ''}</label>
                                            <textarea value={formData.remarks} onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Optional notes…" />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="inv-modal__footer">
                                <button type="button" className="inv-btn inv-btn--ghost" onClick={closeModal}>Cancel</button>
                                <button type="submit" className={`inv-btn ${modalType === 'maintenance' || modalType === 'return' ? 'inv-btn--primary' : 'inv-btn--primary'}`} disabled={submitting}>
                                    {submitting ? 'Saving…' : (
                                        <>
                                            {modalType === 'add' && 'Add Spare'}
                                            {modalType === 'issue' && 'Issue Spare'}
                                            {modalType === 'return' && 'Return Spare'}
                                            {modalType === 'maintenance' && 'Confirm Maintenance'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
