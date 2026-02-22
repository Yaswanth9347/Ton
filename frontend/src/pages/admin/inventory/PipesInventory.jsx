import { useState, useEffect, useCallback } from 'react';
import {
    Plus, Minus, RotateCcw, TrendingUp, TrendingDown,
    Package, AlertTriangle, Filter, Trash2, X, CheckCircle, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../../context/AuthContext';
import './InventoryPage.css';
import './PipesInventory.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const FEET_PER_PIPE = 20;
const PAGE_SIZE = 15;

/* ── Conversion helpers ── */
const toFeet = (qty, unit) => unit === 'feet' ? parseFloat(qty) : parseFloat(qty) * FEET_PER_PIPE;

const fmtQty = (feet) => {
    if (!feet || feet === 0) return '0 ft';
    const pipes = Math.floor(feet / FEET_PER_PIPE);
    const rem = feet % FEET_PER_PIPE;
    if (rem === 0) return `${pipes} pipe${pipes !== 1 ? 's' : ''}`;
    if (pipes === 0) return `${rem} ft`;
    return `${pipes} pipe${pipes !== 1 ? 's' : ''} ${rem} ft`;
};

const stockStatus = (qty) => {
    const pipes = parseFloat(qty) / FEET_PER_PIPE;
    if (pipes === 0) return 'critical';
    if (pipes < 10) return 'low';
    return 'good';
};

/* ── Toast ── */
function Toast({ type, message, onClose }) {
    useEffect(() => {
        const t = setTimeout(onClose, 4000);
        return () => clearTimeout(t);
    }, [onClose]);
    return (
        <div className={`inv-toast inv-toast--${type}`}>
            {type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            {message}
            <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                <X size={16} />
            </button>
        </div>
    );
}

/* ── Confirm ── */
function ConfirmDialog({ message, onConfirm, onCancel }) {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="inv-confirm" onClick={e => e.stopPropagation()}>
                <div className="inv-confirm__title">Confirm Action</div>
                <p className="inv-confirm__msg">{message}</p>
                <div className="inv-confirm__actions">
                    <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={onCancel}>Cancel</button>
                    <button className="inv-btn inv-btn--danger inv-btn--sm" onClick={onConfirm}>Delete</button>
                </div>
            </div>
        </div>
    );
}

export function PipesInventory() {
    const { user } = useAuth();
    const [pipes, setPipes] = useState([]);
    const [transactions, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [selPipe, setSelPipe] = useState(null);
    const [toast, setToast] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [page, setPage] = useState(1);
    const [formData, setFormData] = useState({
        quantity: '', unit: 'pipes',
        bore_type: '', bore_id: '',
        vehicle_name: '', supervisor_name: '', remarks: '',
        size: '', company: ''
    });
    const [filters, setFilters] = useState({
        dateFrom: '', dateTo: '', search: '', company: '', transactionType: ''
    });

    const showToast = (type, message) => setToast({ type, message });

    const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

    const fetchPipes = useCallback(async () => {
        try {
            const r = await axios.get(`${API_URL}/inventory/pipes`, { headers: authHeaders() });
            setPipes(r.data.data);
        } catch { /* silent */ }
    }, []);

    const fetchTxns = useCallback(async () => {
        try {
            const r = await axios.get(`${API_URL}/inventory/pipes/transactions`, { headers: authHeaders() });
            setTxns(r.data.data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        Promise.all([fetchPipes(), fetchTxns()]).finally(() => setLoading(false));
    }, [fetchPipes, fetchTxns]);

    const openModal = (type, pipe = null) => {
        setModalType(type);
        setSelPipe(pipe);
        setFormData({ quantity: '', unit: 'pipes', bore_type: '', bore_id: '', vehicle_name: '', supervisor_name: '', remarks: '', size: '', company: '' });
        setShowModal(true);
    };
    const closeModal = () => { setShowModal(false); setSelPipe(null); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const headers = authHeaders();
            if (modalType === 'add') {
                await axios.post(`${API_URL}/inventory/pipes/add-stock`, {
                    pipe_id: selPipe.id,
                    quantity: parseFloat(formData.quantity),
                    unit: formData.unit
                }, { headers });
                showToast('success', 'Stock added successfully');
            } else if (modalType === 'issue') {
                await axios.post(`${API_URL}/inventory/pipes/issue`, {
                    pipe_inventory_id: selPipe.id,
                    quantity: parseFloat(formData.quantity),
                    unit: formData.unit,
                    bore_type: formData.bore_type || null,
                    bore_id: formData.bore_id ? parseInt(formData.bore_id) : null,
                    vehicle_name: formData.vehicle_name,
                    supervisor_name: formData.supervisor_name,
                    remarks: formData.remarks
                }, { headers });
                showToast('success', 'Pipes issued successfully');
            } else if (modalType === 'return') {
                await axios.post(`${API_URL}/inventory/pipes/return`, {
                    pipe_inventory_id: selPipe.id,
                    quantity: parseFloat(formData.quantity),
                    unit: formData.unit,
                    bore_type: formData.bore_type || null,
                    bore_id: formData.bore_id ? parseInt(formData.bore_id) : null,
                    vehicle_name: formData.vehicle_name,
                    supervisor_name: formData.supervisor_name,
                    remarks: formData.remarks
                }, { headers });
                showToast('success', 'Pipes returned successfully');
            } else if (modalType === 'new-pipe') {
                await axios.post(`${API_URL}/inventory/pipes`, {
                    size: formData.size, company: formData.company,
                    quantity: formData.quantity ? parseInt(formData.quantity) : 0,
                    unit: formData.unit
                }, { headers });
                showToast('success', 'New pipe type created');
            }
            await Promise.all([fetchPipes(), fetchTxns()]);
            closeModal();
        } catch (err) {
            showToast('error', err.response?.data?.message || 'An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (pipeId) => {
        setConfirm({
            message: 'Delete this pipe type? All associated transactions will also be removed.',
            onConfirm: async () => {
                setConfirm(null);
                try {
                    await axios.delete(`${API_URL}/inventory/pipes/${pipeId}`, { headers: authHeaders() });
                    showToast('success', 'Pipe type deleted');
                    fetchPipes();
                } catch (err) {
                    showToast('error', err.response?.data?.message || 'Error deleting pipe');
                }
            }
        });
    };

    if (loading) {
        return <div className="inv-spinner"><div className="inv-spinner__ring" />Loading pipes inventory…</div>;
    }

    /* Grouped + stats */
    const pipesBySize = {
        '10 inch': pipes.filter(p => p.size === '10 inch'),
        '7 inch': pipes.filter(p => p.size === '7 inch'),
        '5 inch': pipes.filter(p => p.size === '5 inch'),
    };

    let totalFullPipes = 0, totalPieceFt = 0;
    pipes.forEach(pipe => {
        if (pipe.pieces && Object.keys(pipe.pieces).length > 0) {
            Object.entries(pipe.pieces).forEach(([len, cnt]) => {
                if (parseFloat(len) === 20) totalFullPipes += cnt;
                else totalPieceFt += parseFloat(len) * cnt;
            });
        } else {
            const q = parseFloat(pipe.quantity || 0);
            totalFullPipes += Math.floor(q / 20);
            totalPieceFt += q % 20;
        }
    });
    const lowStock = pipes.filter(p => {
        const pipes_ = parseFloat(p.quantity) / FEET_PER_PIPE;
        return pipes_ > 0 && pipes_ < 10;
    }).length;
    const criticalStock = pipes.filter(p => parseFloat(p.quantity) === 0).length;

    /* Filtered transactions — FIX: company filter applied correctly */
    const filtTxns = transactions.filter(tx => {
        if (filters.dateFrom && new Date(tx.created_at) < new Date(filters.dateFrom)) return false;
        if (filters.dateTo) {
            const to = new Date(filters.dateTo); to.setHours(23, 59, 59);
            if (new Date(tx.created_at) > to) return false;
        }
        if (filters.search) {
            const q = filters.search.toLowerCase();
            if (!tx.vehicle_name?.toLowerCase().includes(q) && !tx.size?.toLowerCase().includes(q)) return false;
        }
        if (filters.company && tx.company !== filters.company) return false;
        if (filters.transactionType && tx.transaction_type !== filters.transactionType) return false;
        return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtTxns.length / PAGE_SIZE));
    const pageTxns = filtTxns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    const setFilter = (key, val) => { setFilters(f => ({ ...f, [key]: val })); setPage(1); };
    const clearFilters = () => { setFilters({ dateFrom: '', dateTo: '', search: '', company: '', transactionType: '' }); setPage(1); };

    return (
        <div>
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

            {/* Stats */}
            <div className="inv-stats">
                <div className="inv-stat">
                    <div className="inv-stat__icon-row">
                        <div className="inv-stat__icon inv-stat__icon--blue"><Package size={18} /></div>
                    </div>
                    <div className="inv-stat__value">{pipes.length}</div>
                    <div className="inv-stat__label">Pipe Types</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row">
                        <div className="inv-stat__icon inv-stat__icon--green"><TrendingUp size={18} /></div>
                    </div>
                    <div className="inv-stat__value">{totalFullPipes}</div>
                    <div className="inv-stat__label">Full Pipes</div>
                    <div className="inv-stat__sub">+{totalPieceFt.toFixed(1)} ft in pieces</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row">
                        <div className="inv-stat__icon inv-stat__icon--amber"><AlertTriangle size={18} /></div>
                    </div>
                    <div className="inv-stat__value">{lowStock}</div>
                    <div className="inv-stat__label">Low Stock</div>
                    <div className="inv-stat__sub">&lt; 10 pipes remaining</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row">
                        <div className={`inv-stat__icon inv-stat__icon--${criticalStock > 0 ? 'red' : 'green'}`}>
                            {criticalStock > 0 ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
                        </div>
                    </div>
                    <div className="inv-stat__value">{criticalStock}</div>
                    <div className="inv-stat__label">Out of Stock</div>
                </div>
            </div>

            {/* Stock Table */}
            <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="inv-section-header">
                    <span className="inv-section-title">Stock Levels</span>
                    <button className="inv-btn inv-btn--primary inv-btn--sm" onClick={() => openModal('new-pipe')}>
                        <Plus size={15} /> Add New Pipe Type
                    </button>
                </div>

                <div className="inv-table-wrap">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>Size</th>
                                <th>Brand / Company</th>
                                <th>Stock</th>
                                <th>Pieces Detail</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pipes.length === 0 ? (
                                <tr><td colSpan="6" className="inv-table__empty">No pipe types found. Add one to get started.</td></tr>
                            ) : (
                                Object.entries(pipesBySize).flatMap(([size, sizePipes]) =>
                                    sizePipes.map((pipe, idx) => {
                                        const st = stockStatus(pipe.quantity);
                                        const pieces = pipe.pieces || {};
                                        const fullPipeCnt = pieces['20'] || 0;
                                        const partials = Object.entries(pieces).filter(([k]) => parseFloat(k) !== 20);
                                        return (
                                            <tr key={pipe.id} style={st === 'critical' ? { background: 'rgba(239,68,68,0.04)' } : st === 'low' ? { background: 'rgba(245,158,11,0.04)' } : {}}>
                                                <td>
                                                    {idx === 0 ? (
                                                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{size}</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>↳</span>
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 500 }}>{pipe.company}</td>
                                                <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtQty(pipe.quantity)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {fullPipeCnt > 0 && (
                                                            <span style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--color-primary)', borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600 }}>
                                                                {fullPipeCnt}× 20ft
                                                            </span>
                                                        )}
                                                        {partials.map(([len, cnt]) => (
                                                            <span key={len} style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)', borderRadius: 'var(--radius-full)', padding: '2px 8px', fontSize: '0.7rem', fontWeight: 600 }}>
                                                                {cnt > 1 ? `${cnt}× ` : ''}{len}ft
                                                            </span>
                                                        ))}
                                                        {fullPipeCnt === 0 && partials.length === 0 && (
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`status-badge status-badge--${st}`}>
                                                        <span className="status-badge__dot" />
                                                        {st === 'good' ? 'Good' : st === 'low' ? 'Low' : 'Critical'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="inv-actions">
                                                        <button className="inv-action-btn inv-action-btn--add" title="Add Stock" onClick={() => openModal('add', pipe)}><Plus size={14} /></button>
                                                        <button className="inv-action-btn inv-action-btn--issue" title="Issue to Bore" onClick={() => openModal('issue', pipe)} disabled={parseFloat(pipe.quantity) === 0}><Minus size={14} /></button>
                                                        <button className="inv-action-btn inv-action-btn--return" title="Return from Bore" onClick={() => openModal('return', pipe)}><RotateCcw size={14} /></button>
                                                        {user?.role === 'ADMIN' && (
                                                            <button className="inv-action-btn inv-action-btn--delete" title="Delete Pipe Type" onClick={() => handleDelete(pipe.id)}><Trash2 size={14} /></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Transaction History */}
            <div>
                <div className="inv-section-header">
                    <span className="inv-section-title">Transaction History</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                        {filtTxns.length} record{filtTxns.length !== 1 ? 's' : ''}
                    </span>
                </div>

                {/* Filters */}
                <div className="inv-controls" style={{ marginBottom: 'var(--spacing-3)' }}>
                    <div className="inv-filters">
                        <Filter size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <input type="date" className="inv-filter-input" value={filters.dateFrom}
                            onChange={e => setFilter('dateFrom', e.target.value)} title="From date" />
                        <input type="date" className="inv-filter-input" value={filters.dateTo}
                            onChange={e => setFilter('dateTo', e.target.value)} title="To date" />
                        <input type="text" className="inv-filter-input" placeholder="Search vehicle or size…" value={filters.search}
                            onChange={e => setFilter('search', e.target.value)} style={{ minWidth: 180 }} />
                        <select className="inv-filter-input" value={filters.company}
                            onChange={e => setFilter('company', e.target.value)}>
                            <option value="">All Brands</option>
                            <option value="Nandi">Nandi</option>
                            <option value="Sudakar Special">Sudakar Special</option>
                            <option value="Sudar">Sudar</option>
                        </select>
                        <select className="inv-filter-input" value={filters.transactionType}
                            onChange={e => setFilter('transactionType', e.target.value)}>
                            <option value="">All Types</option>
                            <option value="LOAD">Load</option>
                            <option value="ISSUE">Issue</option>
                            <option value="RETURN">Return</option>
                        </select>
                        {(filters.dateFrom || filters.dateTo || filters.search || filters.company || filters.transactionType) && (
                            <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={clearFilters}>
                                <X size={13} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="inv-table-wrap">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Size</th>
                                <th>Brand</th>
                                <th>Quantity</th>
                                <th>Bore Type</th>
                                <th>Vehicle</th>
                                <th>Supervisor</th>
                                <th>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageTxns.length === 0 ? (
                                <tr><td colSpan="9" className="inv-table__empty">No transactions match current filters.</td></tr>
                            ) : (
                                pageTxns.map(tx => (
                                    <tr key={tx.id}>
                                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                            {new Date(tx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td>
                                            <span className={`status-badge status-badge--${tx.transaction_type.toLowerCase()}`}>
                                                {tx.transaction_type === 'LOAD' && <TrendingUp size={12} />}
                                                {tx.transaction_type === 'ISSUE' && <TrendingDown size={12} />}
                                                {tx.transaction_type === 'RETURN' && <RotateCcw size={12} />}
                                                {tx.transaction_type}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{tx.size}</td>
                                        <td>{tx.company}</td>
                                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtQty(tx.quantity)}</td>
                                        <td style={{ color: 'var(--text-muted)' }}>{tx.bore_type || '—'}</td>
                                        <td>{tx.vehicle_name || '—'}</td>
                                        <td>{tx.supervisor_name || '—'}</td>
                                        <td style={{ color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.remarks || '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="inv-pagination">
                            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtTxns.length)} of {filtTxns.length}</span>
                            <div className="inv-pagination__btns">
                                <button className="inv-pagination__btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                                    return (
                                        <button key={pg} className={`inv-pagination__btn ${page === pg ? 'inv-pagination__btn--active' : ''}`} onClick={() => setPage(pg)}>{pg}</button>
                                    );
                                })}
                                <button className="inv-pagination__btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
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
                                {modalType === 'add' && <><Plus size={16} /> Add Stock to Home</>}
                                {modalType === 'issue' && <><Minus size={16} /> Issue Pipes to Bore Job</>}
                                {modalType === 'return' && <><RotateCcw size={16} /> Return Pipes from Bore</>}
                                {modalType === 'new-pipe' && <><Package size={16} /> Create New Pipe Type</>}
                            </span>
                            <button className="inv-modal__close" onClick={closeModal}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="inv-modal__body">
                                {modalType === 'new-pipe' ? (
                                    <>
                                        <div className="inv-form-group">
                                            <label>Size *</label>
                                            <select value={formData.size} onChange={e => setFormData(f => ({ ...f, size: e.target.value }))} required>
                                                <option value="">Select size</option>
                                                <option value="5 inch">5 inch</option>
                                                <option value="7 inch">7 inch</option>
                                                <option value="10 inch">10 inch</option>
                                            </select>
                                        </div>
                                        <div className="inv-form-group">
                                            <label>Company / Brand *</label>
                                            <input type="text" value={formData.company} onChange={e => setFormData(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Sudar, Nandi…" required />
                                        </div>
                                        <div className="inv-form-group">
                                            <label>Initial Quantity (optional)</label>
                                            <input type="number" min="0" value={formData.quantity} onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="inv-form-group">
                                            <label>Pipe</label>
                                            <input type="text" value={`${selPipe?.size} — ${selPipe?.company}`} disabled />
                                        </div>
                                        <div className="inv-form-group">
                                            <label>Quantity *</label>
                                            <div className="inv-form-group-inline">
                                                <input type="number" step="0.1" min="0.1" value={formData.quantity}
                                                    onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))} placeholder="Enter quantity" required />
                                                <select value={formData.unit} onChange={e => setFormData(f => ({ ...f, unit: e.target.value }))}>
                                                    <option value="pipes">Pipes</option>
                                                    <option value="feet">Feet</option>
                                                </select>
                                            </div>
                                            {formData.quantity && (
                                                <div className="inv-form-hint">
                                                    ≈ {formData.unit === 'pipes'
                                                        ? `${(parseFloat(formData.quantity) * FEET_PER_PIPE).toFixed(1)} feet`
                                                        : `${(parseFloat(formData.quantity) / FEET_PER_PIPE).toFixed(2)} pipes`}
                                                </div>
                                            )}
                                        </div>
                                        {(modalType === 'issue' || modalType === 'return') && (
                                            <>
                                                <div className="inv-form-row">
                                                    <div className="inv-form-group">
                                                        <label>Vehicle Name</label>
                                                        <input type="text" value={formData.vehicle_name} onChange={e => setFormData(f => ({ ...f, vehicle_name: e.target.value }))} placeholder="e.g. TN 01 AB 1234" />
                                                    </div>
                                                    <div className="inv-form-group">
                                                        <label>Supervisor</label>
                                                        <input type="text" value={formData.supervisor_name} onChange={e => setFormData(f => ({ ...f, supervisor_name: e.target.value }))} placeholder="Name" />
                                                    </div>
                                                </div>
                                                <div className="inv-form-row">
                                                    <div className="inv-form-group">
                                                        <label>Bore Type</label>
                                                        <select value={formData.bore_type} onChange={e => setFormData(f => ({ ...f, bore_type: e.target.value }))}>
                                                            <option value="">None</option>
                                                            <option value="PRIVATE">Private Bore</option>
                                                            <option value="GOVT">Government Bore</option>
                                                        </select>
                                                    </div>
                                                    {formData.bore_type && (
                                                        <div className="inv-form-group">
                                                            <label>Bore Job ID</label>
                                                            <input type="number" value={formData.bore_id} onChange={e => setFormData(f => ({ ...f, bore_id: e.target.value }))} placeholder="Job ID" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="inv-form-group">
                                                    <label>Remarks</label>
                                                    <textarea value={formData.remarks} onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Optional notes…" />
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="inv-modal__footer">
                                <button type="button" className="inv-btn inv-btn--ghost" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="inv-btn inv-btn--primary" disabled={submitting}>
                                    {submitting ? 'Saving…' : (
                                        <>
                                            {modalType === 'add' && 'Add Stock'}
                                            {modalType === 'issue' && 'Issue Pipes'}
                                            {modalType === 'return' && 'Return Pipes'}
                                            {modalType === 'new-pipe' && 'Create Pipe Type'}
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
