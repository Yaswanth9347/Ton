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
    const [allocations, setAllocations] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [selPipe, setSelPipe] = useState(null);
    const [selAllocation, setSelAllocation] = useState(null);
    const [toast, setToast] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [page, setPage] = useState(1);
    const [formData, setFormData] = useState({
        quantity: '', unit: 'pipes',
        bore_type: '', bore_id: '',
        vehicle_name: '', supervisor_name: '', remarks: '',
        size: '', company: '',
        material_type: '', quality_grade: '', length_feet: '20', cost_per_unit: '',
        supplier_name: '', purchase_mode: 'offline', allocation_id: ''
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

    const fetchAllocations = useCallback(async () => {
        try {
            const r = await axios.get(`${API_URL}/inventory/pipes/allocations`, { headers: authHeaders() });
            setAllocations(r.data.data || []);
        } catch { /* silent */ }
    }, []);

    const fetchCompanies = useCallback(async () => {
        try {
            const r = await axios.get(`${API_URL}/inventory/pipes/companies`, { headers: authHeaders() });
            setCompanies(r.data.data || []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        Promise.all([fetchPipes(), fetchTxns(), fetchCompanies(), fetchAllocations()]).finally(() => setLoading(false));
    }, [fetchPipes, fetchTxns, fetchCompanies, fetchAllocations]);

    const openModal = (type, pipe = null, allocation = null) => {
        setModalType(type);
        setSelPipe(pipe);
        setSelAllocation(allocation);
        setFormData({
            quantity: '', unit: 'pipes', bore_type: allocation?.bore_type?.toUpperCase() || '', bore_id: allocation?.bore_id || '',
            vehicle_name: allocation?.vehicle_name || '', supervisor_name: allocation?.supervisor_name || '', remarks: '',
            size: '', company: '', material_type: '', quality_grade: '', length_feet: '20', cost_per_unit: '',
            supplier_name: '', purchase_mode: 'offline', allocation_id: allocation?.id || ''
        });
        setShowModal(true);
    };
    const closeModal = () => { setShowModal(false); setSelPipe(null); setSelAllocation(null); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const headers = authHeaders();
            if (modalType === 'add') {
                await axios.post(`${API_URL}/inventory/pipes/add-stock`, {
                    pipe_id: selPipe.id,
                    quantity: parseFloat(formData.quantity),
                    unit: formData.unit,
                    supplier_name: formData.supplier_name || null,
                    purchase_mode: formData.purchase_mode || null,
                    remarks: formData.remarks || null
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
                    allocation_id: formData.allocation_id ? parseInt(formData.allocation_id) : null,
                    quantity: parseFloat(formData.quantity),
                    unit: formData.unit,
                    remarks: formData.remarks
                }, { headers });
                showToast('success', 'Pipes returned successfully');
            } else if (modalType === 'new-pipe') {
                const payload = {
                    size: formData.size, company: formData.company,
                    quantity: formData.quantity ? parseInt(formData.quantity) : 0,
                    unit: formData.unit,
                    material_type: formData.material_type || null,
                    quality_grade: formData.quality_grade || null,
                    length_feet: formData.length_feet ? parseFloat(formData.length_feet) : 20,
                    cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : 0
                };
                console.log(`[Inventory - Pipes] Creating new pipe record...\nPayload:`, JSON.stringify(payload, null, 2));

                const res = await axios.post(`${API_URL}/inventory/pipes`, payload, { headers });
                console.log(`[Inventory - Pipes] Pipe created successfully. ID: ${res.data?.data?.id || 'Unknown'}`);
                showToast('success', 'New pipe type created');
            }
            await Promise.all([fetchPipes(), fetchTxns(), fetchAllocations()]);
            closeModal();
        } catch (err) {
            const backendMsg = err.response?.data?.message || err.message;
            console.error(`[Inventory - Pipes] Creation/Modification failed.\nStatus: ${err.response?.status || 'Unknown'}\nError: ${backendMsg}`);
            showToast('error', `Pipe creation failed: ${backendMsg}`);
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
    const pipesBySize = [...new Set(pipes.map(p => p.size || 'Unknown'))]
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .reduce((acc, size) => {
            acc[size] = pipes.filter(p => p.size === size);
            return acc;
        }, {});

    let totalFullPipes = 0, totalPieceFt = 0, totalInUseFeet = 0;
    pipes.forEach(pipe => {
        const q = parseFloat((pipe.store_quantity ?? pipe.quantity) || 0);
        totalFullPipes += Math.floor(q / (parseFloat(pipe.length_feet || FEET_PER_PIPE) || FEET_PER_PIPE));
        totalPieceFt += q % (parseFloat(pipe.length_feet || FEET_PER_PIPE) || FEET_PER_PIPE);
        totalInUseFeet += parseFloat(pipe.in_use_quantity || 0);
    });
    const lowStock = pipes.filter(p => {
        const pipes_ = parseFloat((p.store_quantity ?? p.quantity) || 0) / FEET_PER_PIPE;
        return pipes_ > 0 && pipes_ < 10;
    }).length;
    const criticalStock = pipes.filter(p => parseFloat((p.store_quantity ?? p.quantity) || 0) === 0).length;

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
                    <div className="inv-stat__label">Store Pipes</div>
                    <div className="inv-stat__sub">+{totalPieceFt.toFixed(1)} ft in pieces</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row">
                        <div className="inv-stat__icon inv-stat__icon--amber"><AlertTriangle size={18} /></div>
                    </div>
                    <div className="inv-stat__value">{fmtQty(totalInUseFeet)}</div>
                    <div className="inv-stat__label">In Use</div>
                    <div className="inv-stat__sub">{allocations.length} active bore allocation(s)</div>
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
                                <th style={{ textAlign: 'center' }}>Size</th>
                                <th style={{ textAlign: 'center' }}>Company</th>
                                <th style={{ textAlign: 'center' }}>Material</th>
                                <th style={{ textAlign: 'center' }}>Quality</th>
                                <th style={{ textAlign: 'center' }}>Store Stock</th>
                                <th style={{ textAlign: 'center' }}>Cost/Unit</th>
                                <th style={{ textAlign: 'center' }}>Value</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pipes.length === 0 ? (
                                <tr><td colSpan="9" className="inv-table__empty" style={{ textAlign: 'center' }}>No pipe types found. Add one to get started.</td></tr>
                            ) : (
                                Object.entries(pipesBySize).flatMap(([size, sizePipes]) =>
                                    sizePipes.map((pipe, idx) => {
                                        const stockFeet = parseFloat((pipe.store_quantity ?? pipe.quantity) || 0);
                                        const st = stockStatus(stockFeet);
                                        const costPerUnit = parseFloat(pipe.cost_per_unit || 0);
                                        const totalValue = stockFeet * costPerUnit;
                                        return (
                                            <tr key={pipe.id} style={st === 'critical' ? { background: 'rgba(239,68,68,0.04)' } : st === 'low' ? { background: 'rgba(245,158,11,0.04)' } : {}}>
                                                <td style={{ textAlign: 'center' }}>
                                                    {idx === 0 ? (
                                                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{size}</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>↳</span>
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 500, textAlign: 'center' }}>{pipe.company}</td>
                                                <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>{pipe.material_type || '—'}</td>
                                                <td style={{ fontSize: '0.8rem', textAlign: 'center' }}>
                                                    {pipe.quality_grade ? (
                                                        <span style={{
                                                            background: pipe.quality_grade === 'Premium' ? 'rgba(16,185,129,0.1)' : pipe.quality_grade === 'Standard' ? 'rgba(37,99,235,0.1)' : 'rgba(156,163,175,0.1)',
                                                            color: pipe.quality_grade === 'Premium' ? 'var(--color-success)' : pipe.quality_grade === 'Standard' ? 'var(--color-primary)' : 'var(--text-muted)',
                                                            padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: '0.7rem'
                                                        }}>{pipe.quality_grade}</span>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{fmtQty(stockFeet)}</td>
                                                <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', textAlign: 'center' }}>
                                                    {costPerUnit > 0 ? `₹${costPerUnit.toLocaleString('en-IN')}` : '—'}
                                                </td>
                                                <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: totalValue > 0 ? 'var(--color-success)' : 'var(--text-muted)', textAlign: 'center' }}>
                                                    {totalValue > 0 ? `₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className={`status-badge status-badge--${st}`}>
                                                        <span className="status-badge__dot" />
                                                        {st === 'good' ? 'Good' : st === 'low' ? 'Low' : 'Critical'}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div className="inv-actions" style={{ justifyContent: 'center' }}>
                                                        <button className="inv-action-btn inv-action-btn--add" title="Add Stock" onClick={() => openModal('add', pipe)}><Plus size={14} /></button>
                                                        <button className="inv-action-btn inv-action-btn--issue" title="Issue to Bore" onClick={() => openModal('issue', pipe)} disabled={parseFloat(pipe.quantity) === 0}><Minus size={14} /></button>
                                                        <button className="inv-action-btn inv-action-btn--return" title="Return from Bore" onClick={() => openModal('return', pipe)} disabled={!allocations.some(a => a.pipe_inventory_id === pipe.id)}><RotateCcw size={14} /></button>
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

            {/* Active Allocations */}
            <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="inv-section-header">
                    <span className="inv-section-title">Active Bore Allocations</span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{allocations.length} active</span>
                </div>
                <div className="inv-table-wrap">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th>Bore</th>
                                <th>Type</th>
                                <th>Vehicle</th>
                                <th>Pipe</th>
                                <th>Issued</th>
                                <th>Returned</th>
                                <th>Open</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allocations.length === 0 ? (
                                <tr><td colSpan="8" className="inv-table__empty">No active bore allocations. Store stock is fully available.</td></tr>
                            ) : allocations.map((allocation) => (
                                <tr key={allocation.id}>
                                    <td style={{ fontWeight: 600 }}>{allocation.bore_reference}</td>
                                    <td style={{ textTransform: 'capitalize' }}>{allocation.bore_type}</td>
                                    <td>{allocation.vehicle_name || '—'}</td>
                                    <td>{allocation.pipe_company} · {allocation.pipe_size}</td>
                                    <td>{fmtQty(allocation.issued_quantity)}</td>
                                    <td>{allocation.returned_quantity > 0 ? fmtQty(allocation.returned_quantity) : '—'}</td>
                                    <td style={{ fontWeight: 700, color: 'var(--color-warning)' }}>{fmtQty(allocation.open_quantity)}</td>
                                    <td>
                                        <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={() => openModal('return', pipes.find(p => p.id === allocation.pipe_inventory_id) || null, allocation)}>
                                            <RotateCcw size={13} /> Return
                                        </button>
                                    </td>
                                </tr>
                            ))}
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
                            {[...new Set(pipes.map(p => p.company))].sort().map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
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
                                <th>Flow</th>
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
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{tx.source_location || '—'} → {tx.destination_location || '—'}</td>
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
                                        <div className="inv-form-row">
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
                                                <input type="text" value={formData.company} onChange={e => setFormData(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Sudar, Nandi…" required list="pipe-companies" />
                                                <datalist id="pipe-companies">
                                                    {companies.map(c => <option key={c.id} value={c.company_name} />)}
                                                </datalist>
                                            </div>
                                        </div>
                                        <div className="inv-form-row">
                                            <div className="inv-form-group">
                                                <label>Material Type</label>
                                                <select value={formData.material_type} onChange={e => setFormData(f => ({ ...f, material_type: e.target.value }))}>
                                                    <option value="">Select material</option>
                                                    <option value="PVC">PVC</option>
                                                    <option value="HDPE">HDPE</option>
                                                    <option value="GI">GI (Galvanised Iron)</option>
                                                    <option value="MS">MS (Mild Steel)</option>
                                                    <option value="UPVC">UPVC</option>
                                                    <option value="CI">CI (Cast Iron)</option>
                                                </select>
                                            </div>
                                            <div className="inv-form-group">
                                                <label>Quality Grade</label>
                                                <select value={formData.quality_grade} onChange={e => setFormData(f => ({ ...f, quality_grade: e.target.value }))}>
                                                    <option value="">Select quality</option>
                                                    <option value="Premium">Premium</option>
                                                    <option value="Standard">Standard</option>
                                                    <option value="Economy">Economy</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="inv-form-row">
                                            <div className="inv-form-group">
                                                <label>Length per pipe (feet)</label>
                                                <input type="number" step="0.5" min="1" value={formData.length_feet} onChange={e => setFormData(f => ({ ...f, length_feet: e.target.value }))} placeholder="20" />
                                            </div>
                                            <div className="inv-form-group">
                                                <label>Cost per Unit (₹)</label>
                                                <input type="number" step="0.01" min="0" value={formData.cost_per_unit} onChange={e => setFormData(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0.00" />
                                            </div>
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
                                        {modalType === 'add' && (
                                            <>
                                                <div className="inv-form-row">
                                                    <div className="inv-form-group">
                                                        <label>Supplier / Dealer</label>
                                                        <input type="text" value={formData.supplier_name} onChange={e => setFormData(f => ({ ...f, supplier_name: e.target.value }))} placeholder="Dealer or source" />
                                                    </div>
                                                    <div className="inv-form-group">
                                                        <label>Purchase Mode</label>
                                                        <select value={formData.purchase_mode} onChange={e => setFormData(f => ({ ...f, purchase_mode: e.target.value }))}>
                                                            <option value="offline">Offline</option>
                                                            <option value="online">Online</option>
                                                            <option value="local">Local Market</option>
                                                            <option value="unknown">Unknown</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="inv-form-group">
                                                    <label>Remarks</label>
                                                    <textarea value={formData.remarks} onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Optional receiving note…" />
                                                </div>
                                            </>
                                        )}
                                        {(modalType === 'issue' || modalType === 'return') && (
                                            <>
                                                {modalType === 'return' && (
                                                    <div className="inv-form-group">
                                                        <label>Active Allocation *</label>
                                                        <select value={formData.allocation_id} onChange={e => {
                                                            const allocation = allocations.find(a => String(a.id) === String(e.target.value));
                                                            setSelAllocation(allocation || null);
                                                            setFormData(f => ({
                                                                ...f,
                                                                allocation_id: e.target.value,
                                                                bore_type: allocation?.bore_type?.toUpperCase() || '',
                                                                bore_id: allocation?.bore_id || '',
                                                                vehicle_name: allocation?.vehicle_name || '',
                                                                supervisor_name: allocation?.supervisor_name || ''
                                                            }));
                                                        }} required>
                                                            <option value="">Select active bore allocation</option>
                                                            {allocations
                                                                .filter(a => !selPipe || a.pipe_inventory_id === selPipe.id)
                                                                .map(a => (
                                                                    <option key={a.id} value={a.id}>
                                                                        {a.bore_reference} · {a.vehicle_name || 'No vehicle'} · Open {fmtQty(a.open_quantity)}
                                                                    </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                )}
                                                <div className="inv-form-row">
                                                    <div className="inv-form-group">
                                                        <label>Vehicle Name</label>
                                                        <input type="text" value={formData.vehicle_name} onChange={e => setFormData(f => ({ ...f, vehicle_name: e.target.value }))} placeholder="e.g. TN 01 AB 1234" disabled={modalType === 'return' && !!formData.allocation_id} />
                                                    </div>
                                                    <div className="inv-form-group">
                                                        <label>Supervisor</label>
                                                        <input type="text" value={formData.supervisor_name} onChange={e => setFormData(f => ({ ...f, supervisor_name: e.target.value }))} placeholder="Name" disabled={modalType === 'return' && !!formData.allocation_id} />
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
