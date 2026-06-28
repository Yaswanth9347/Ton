import { useState, useEffect, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import {
    Plus, Boxes, PackagePlus, Wrench, CheckCircle, AlertCircle,
    Trash2, X, Filter, ChevronLeft, ChevronRight, PackageSearch, Layers3, SlidersHorizontal, Pencil
} from 'lucide-react';
import './InventoryPage.css';
import './SparesInventory.css';
import { formatDateInIST } from '../../../utils/dateTime';
import { inventoryApi } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

const PAGE_SIZE = 10;
const INVENTORY_SUMMARY_REFRESH_EVENT = 'inventory:summary-refresh';

const STATUS_LABEL = { IN_STOCK: 'In Stock', LOW_STOCK: 'Low Stock', OUT_OF_STOCK: 'Out of Stock' };
const STATUS_KEY = { IN_STOCK: 'good', LOW_STOCK: 'low', OUT_OF_STOCK: 'critical' };

const fmtQty = (value) => {
    const qty = parseFloat(value || 0);
    return Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
};

const fmtCurrency = (value) => {
    const amount = parseFloat(value || 0);
    if (!amount) return '—';
    return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

export function SparesInventory() {
    const { user } = useAuth();
    const [spares, setSpares] = useState([]);
    const [transactions, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [selSpare, setSelSpare] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [reorderModal, setReorderModal] = useState(null);
    const [txPage, setTxPage] = useState(1);
    const [txFilters, setTxFilters] = useState({ spareName: '', transactionType: '', dateFrom: '', dateTo: '' });
    const [txPagination, setTxPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
    const [loadErrors, setLoadErrors] = useState({ spares: '', transactions: '' });
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [formData, setFormData] = useState({
        spare_type: 'MATERIAL',
        spare_number: '',
        brand: '',
        unit_type: 'Piece',
        cost_per_unit: '',
        quantity: '',
        adjustment_type: 'INCREASE',
        remarks: '',
    });

    const refreshSummary = () => window.dispatchEvent(new Event(INVENTORY_SUMMARY_REFRESH_EVENT));

    const fetchSpares = useCallback(async () => {
        try {
            const params = {};
            if (filterType !== 'ALL') params.spare_type = filterType;
            if (filterStatus !== 'ALL') params.status = filterStatus;
            const r = await inventoryApi.getSpares(params);
            setSpares(r.data.data);
            setLoadErrors(prev => ({ ...prev, spares: '' }));
        } catch (err) {
            setLoadErrors(prev => ({ ...prev, spares: err.response?.data?.message || 'Failed to load spares list' }));
        }
    }, [filterType, filterStatus]);

    const fetchTxns = useCallback(async () => {
        try {
            const params = {
                page: txPage,
                limit: PAGE_SIZE,
            };
            if (txFilters.spareName) params.spare_name = txFilters.spareName;
            if (txFilters.transactionType) params.transaction_type = txFilters.transactionType;
            if (txFilters.dateFrom) params.start_date = txFilters.dateFrom;
            if (txFilters.dateTo) params.end_date = txFilters.dateTo;

            const r = await inventoryApi.getSpareTransactions(params);
            setTxns(r.data.data);
            setTxPagination(r.data.pagination || { page: txPage, limit: PAGE_SIZE, total: r.data.data?.length || 0, totalPages: 1 });
            setLoadErrors(prev => ({ ...prev, transactions: '' }));
        } catch (err) {
            setLoadErrors(prev => ({ ...prev, transactions: err.response?.data?.message || 'Failed to load spare transactions' }));
        }
    }, [txPage, txFilters]);

    useEffect(() => {
        Promise.all([fetchSpares(), fetchTxns()]).finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => { fetchSpares(); }, [filterType, filterStatus]);
    useEffect(() => { if (!loading) fetchTxns(); }, [fetchTxns, loading]);

    const openModal = (type, spare = null) => {
        setModalType(type);
        setSelSpare(spare);
        setFormData({
            spare_type: spare?.spare_type || 'MATERIAL',
            spare_number: '',
            brand: '',
            unit_type: spare?.unit_type || 'Piece',
            cost_per_unit: spare?.cost_per_unit ? String(spare.cost_per_unit) : '',
            quantity: '',
            adjustment_type: 'INCREASE',
            remarks: '',
        });
        setShowModal(true);
    };
    const closeModal = () => { setShowModal(false); setSelSpare(null); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (modalType === 'add') {
                const r = await inventoryApi.addSpare({
                    spare_type: formData.spare_type || 'MATERIAL',
                    spare_number: formData.spare_number,
                    unit_type: 'Piece',
                    brand: formData.brand || null,
                    cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : 0
                });
                const newSpare = r.data?.data;
                if (newSpare && formData.quantity && parseFloat(formData.quantity) > 0) {
                    await inventoryApi.addSpareStock(newSpare.id, {
                        quantity: parseFloat(formData.quantity),
                        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : 0,
                    });
                }
                toast.success(`${formData.spare_number} added`);
            } else if (modalType === 'stock') {
                await inventoryApi.addSpareStock(selSpare.id, {
                    quantity: parseFloat(formData.quantity),
                    cost_per_unit: formData.cost_per_unit === '' ? null : parseFloat(formData.cost_per_unit),
                });
                toast.success(`${selSpare.spare_number} stock updated`);
            } else if (modalType === 'adjust') {
                await inventoryApi.adjustSpareStock(selSpare.id, {
                    adjustment_type: formData.adjustment_type,
                    quantity: parseFloat(formData.quantity),
                    remarks: formData.remarks,
                });
                toast.success(`${selSpare.spare_number} stock adjusted`);
            }
            await Promise.all([fetchSpares(), fetchTxns()]);
            refreshSummary();
            closeModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'An error occurred');
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
                    await inventoryApi.deleteSpare(spare.id);
                    toast.success('Spare deleted');
                    await Promise.all([fetchSpares(), fetchTxns()]);
                    refreshSummary();
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Error deleting spare');
                }
            }
        });
    };

    const handleUpdateSpareSettings = (spare) => {
        setReorderModal({
            type: 'spare',
            id: spare.id,
            name: spare.spare_number,
            currentValue: spare.reorder_level || 5
        });
    };

    const submitSpareReorder = async (id, reorderLevel) => {
        try {
            await inventoryApi.updateSpareSettings(id, { reorder_level: reorderLevel });
            toast.success('Spare reorder level updated');
            await Promise.all([fetchSpares(), fetchTxns()]);
            refreshSummary();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update spare settings');
        }
    };

    const stats = useMemo(() => ({
        total: spares.length,
        inStock: spares.filter(s => s.status === 'IN_STOCK').length,
        lowStock: spares.filter(s => s.status === 'LOW_STOCK').length,
        outOfStock: spares.filter(s => s.status === 'OUT_OF_STOCK').length,
        totalUnits: spares.reduce((sum, spare) => sum + parseFloat(spare.available_quantity || 0), 0),
        activeBores: spares.filter(s => s.active_bore_count > 0).length,
    }), [spares]);

    const filteredSpares = useMemo(() => {
        return spares.filter((spare) => {
            if (search) {
                const q = search.toLowerCase();
                const haystacks = [
                    spare.spare_number,
                    spare.spare_type,
                    spare.brand,
                    spare.active_bore_reference,
                    ...(spare.active_bore_references || []),
                ].filter(Boolean).map((value) => value.toLowerCase());

                if (!haystacks.some((value) => value.includes(q))) {
                    return false;
                }
            }

            return true;
        });
    }, [search, spares]);

    if (loading) return <div className="inv-spinner"><div className="inv-spinner__ring" />Loading spares…</div>;

    /* Stats */
    const topErrors = [...new Set(Object.values(loadErrors).filter(Boolean))];

    const totalTxPages = txPagination.totalPages || 0;

    return (
        <div>
            {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
            {reorderModal && (
                <div className="modal-overlay" onClick={() => setReorderModal(null)}>
                    <div className="inv-modal" onClick={e => e.stopPropagation()}>
                        <div className="inv-modal__header">
                            <span className="inv-modal__title"><SlidersHorizontal size={16} /> Set Reorder Level</span>
                            <button className="inv-modal__close" onClick={() => setReorderModal(null)}>×</button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const val = parseInt(e.target.reorderLevel.value, 10);
                            if (isNaN(val) || val < 0) {
                                toast.error('Reorder level must be a non-negative integer');
                                return;
                            }
                            submitSpareReorder(reorderModal.id, val);
                            setReorderModal(null);
                        }}>
                            <div className="inv-modal__body">
                                <div className="inv-form-group">
                                    <label className="inv-form-label">Reorder Level for {reorderModal.name}</label>
                                    <input
                                        type="number"
                                        name="reorderLevel"
                                        className="inv-form-input"
                                        defaultValue={reorderModal.currentValue}
                                        min="0"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="inv-modal__footer">
                                <button type="button" className="inv-btn inv-btn--secondary" onClick={() => setReorderModal(null)}>Cancel</button>
                                <button type="submit" className="inv-btn inv-btn--primary">Save Settings</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {topErrors.length > 0 && (
                <div style={{
                    marginBottom: 'var(--spacing-4)',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.22)',
                    color: 'var(--color-danger)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 500
                }}>
                    {topErrors.join(' • ')}
                </div>
            )}

            {/* Stats */}
            <div className="inv-stats">
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className="inv-stat__icon inv-stat__icon--blue"><Wrench size={18} /></div></div>
                    <div className="inv-stat__value">{stats.total}</div>
                    <div className="inv-stat__label">Spare Materials</div>
                    <div className="inv-stat__sub">{fmtQty(stats.totalUnits)} total units in store</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className="inv-stat__icon inv-stat__icon--green"><Boxes size={18} /></div></div>
                    <div className="inv-stat__value">{stats.inStock}</div>
                    <div className="inv-stat__label">In Stock Items</div>
                    <div className="inv-stat__sub">{stats.activeBores} items currently tied to active bores</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className={`inv-stat__icon inv-stat__icon--${stats.lowStock > 0 ? 'amber' : 'green'}`}><Layers3 size={18} /></div></div>
                    <div className="inv-stat__value">{stats.lowStock}</div>
                    <div className="inv-stat__label">Low Stock</div>
                    <div className="inv-stat__sub">At or below reorder level</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row"><div className={`inv-stat__icon inv-stat__icon--${stats.outOfStock > 0 ? 'red' : 'green'}`}><PackageSearch size={18} /></div></div>
                    <div className="inv-stat__value">{stats.outOfStock}</div>
                    <div className="inv-stat__label">Out of Stock</div>
                    <div className="inv-stat__sub">Need replenishment before bore sync can deduct</div>
                </div>
            </div>

            {/* Controls + Spares Table */}
            <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="inv-section-header">
                    <span className="inv-section-title">Spares Register</span>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="inv-filter-input inv-filter-input--sm"
                            placeholder="Search material or bore…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ minWidth: 220 }}
                        />
                        <select className="inv-filter-input inv-filter-input--sm" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ minWidth: 110 }}>
                            <option value="ALL">All Types</option>
                            <option value="MATERIAL">Material</option>
                        </select>
                        <select className="inv-filter-input inv-filter-input--sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ minWidth: 130 }}>
                            <option value="ALL">All Status</option>
                            <option value="IN_STOCK">In Stock</option>
                            <option value="LOW_STOCK">Low Stock</option>
                            <option value="OUT_OF_STOCK">Out of Stock</option>
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
                                <th style={{ textAlign: 'center' }}>Material</th>
                                <th style={{ textAlign: 'center' }}>Available</th>
                                <th style={{ textAlign: 'center' }}>Value</th>
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSpares.length === 0 ? (
                                <tr><td colSpan="4" className="inv-table__empty" style={{ textAlign: 'center' }}>No spares found. Add one to get started.</td></tr>
                            ) : (
                                filteredSpares.map(spare => (
                                    <tr key={spare.id}>
                                        <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{spare.spare_number}</td>
                                        <td style={{ fontWeight: 700, textAlign: 'center' }}>{fmtQty(spare.available_quantity)}</td>
                                        <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', textAlign: 'center' }}>
                                            {fmtCurrency(spare.total_value)}
                                        </td>
                                        <td>
                                            <div className="inv-actions" style={{ justifyContent: 'center' }}>
                                                <button className="inv-action-btn inv-action-btn--load" title="Add Stock" onClick={() => openModal('stock', spare)}><PackagePlus size={13} /></button>
                                                {user?.role === 'ADMIN' && (
                                                    <>
                                                        <button className="inv-action-btn inv-action-btn--issue" title="Adjust Stock" onClick={() => openModal('adjust', spare)}><SlidersHorizontal size={13} /></button>
                                                        <button className="inv-action-btn inv-action-btn--issue" title="Set Reorder Level" onClick={() => handleUpdateSpareSettings(spare)}><Pencil size={13} /></button>
                                                    </>
                                                )}
                                                {!spare.is_default && (
                                                    <button className="inv-action-btn inv-action-btn--delete" title="Delete Spare" onClick={() => handleDelete(spare)}><Trash2 size={13} /></button>
                                                )}
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
                </div>
                <div className="inv-controls inv-controls--right" style={{ marginBottom: 'var(--spacing-3)' }}>
                    <div className="inv-filters">
                        <Filter size={15} style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            className="inv-filter-input"
                            placeholder="Spare name..."
                            value={txFilters.spareName}
                            onChange={e => { setTxFilters(f => ({ ...f, spareName: e.target.value })); setTxPage(1); }}
                            style={{ minWidth: 200 }}
                        />
                        <select className="inv-filter-input" value={txFilters.transactionType} onChange={e => { setTxFilters(f => ({ ...f, transactionType: e.target.value })); setTxPage(1); }}>
                            <option value="">All Actions</option>
                            <option value="ADD_STOCK">Add Stock</option>
                            <option value="ISSUE">Issue</option>
                            <option value="RETURN">Return</option>
                            <option value="ADJUST_IN">Adjust In</option>
                            <option value="ADJUST_OUT">Adjust Out</option>
                        </select>
                        <input type="date" className="inv-filter-input" value={txFilters.dateFrom} onChange={e => { setTxFilters(f => ({ ...f, dateFrom: e.target.value })); setTxPage(1); }} />
                        <input type="date" className="inv-filter-input" value={txFilters.dateTo} onChange={e => { setTxFilters(f => ({ ...f, dateTo: e.target.value })); setTxPage(1); }} />
                        {(txFilters.spareName || txFilters.transactionType || txFilters.dateFrom || txFilters.dateTo) && (
                            <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={() => { setTxFilters({ spareName: '', transactionType: '', dateFrom: '', dateTo: '' }); setTxPage(1); }}>
                                <X size={13} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                <div className="inv-table-wrap">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center' }}>Date</th>
                                <th style={{ textAlign: 'center' }}>Material</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                                <th style={{ textAlign: 'center' }}>Qty</th>
                                <th style={{ textAlign: 'center' }}>Issue</th>
                                <th style={{ textAlign: 'center' }}>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr><td colSpan="6" className="inv-table__empty" style={{ textAlign: 'center' }}>No transactions found.</td></tr>
                            ) : (
                                transactions.map(tx => (
                                    <tr key={tx.id}>
                                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
                                            {formatDateInIST(tx.created_at)}
                                        </td>
                                        <td style={{ fontWeight: 600, textAlign: 'center' }}>{tx.spare_number}</td>
                                        <td style={{ textAlign: 'center' }}><span className={`status-badge status-badge--${tx.transaction_type.toLowerCase()}`} style={{ justifyContent: 'center' }}>{tx.transaction_type}</span></td>
                                        <td style={{ textAlign: 'center' }}>{fmtQty(tx.quantity)}</td>
                                        <td style={{ textAlign: 'center' }}>{tx.bore_reference || '—'}</td>
                                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>{tx.remarks || '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    {totalTxPages > 1 && (
                        <div className="inv-pagination">
                            <span>Showing {(txPage - 1) * PAGE_SIZE + 1}–{Math.min(txPage * PAGE_SIZE, txPagination.total)} of {txPagination.total}</span>
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
                                {modalType === 'stock' && <><PackagePlus size={16} /> Add Spare Stock</>}
                                {modalType === 'adjust' && <><SlidersHorizontal size={16} /> Adjust Spare Stock</>}
                            </span>
                            <button className="inv-modal__close" onClick={closeModal}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="inv-modal__body">
                                {modalType === 'add' && (
                                    <>
                                        <div className="inv-form-group">
                                            <label>Spare Name *</label>
                                            <input type="text" value={formData.spare_number} onChange={e => setFormData(f => ({ ...f, spare_number: e.target.value }))} placeholder="e.g. Bore Cap" required />
                                        </div>
                                        <div className="inv-form-row">
                                            <div className="inv-form-group">
                                                <label>Cost (₹)</label>
                                                <input type="number" step="0.01" min="0" value={formData.cost_per_unit} onChange={e => setFormData(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0.00" />
                                            </div>
                                            <div className="inv-form-group">
                                                <label>Quantity</label>
                                                <input type="number" step="0.01" min="0" value={formData.quantity} onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))} placeholder="0.00" />
                                            </div>
                                        </div>
                                        <div className="inv-form-group">
                                            <label>From</label>
                                            <input type="text" value={formData.brand} onChange={e => setFormData(f => ({ ...f, brand: e.target.value }))} placeholder="e.g. Supplier name, vendor..." />
                                        </div>
                                    </>
                                )}
                                {(modalType === 'stock' || modalType === 'adjust') && (
                                    <div className="inv-form-group">
                                        <label>Spare</label>
                                        <input type="text" value={`${selSpare?.spare_type} — ${selSpare?.spare_number}`} disabled />
                                    </div>
                                )}
                                {modalType === 'stock' && (
                                    <>
                                        <div className="inv-form-row">
                                            <div className="inv-form-group">
                                                <label>Current Available</label>
                                                <input type="text" value={fmtQty(selSpare?.available_quantity)} disabled />
                                            </div>
                                            <div className="inv-form-group">
                                                <label>Add Quantity *</label>
                                                <input type="number" step="0.01" min="0.01" value={formData.quantity} onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))} placeholder="0.00" required />
                                            </div>
                                        </div>
                                        <div className="inv-form-group">
                                            <label>Cost</label>
                                            <input type="number" step="0.01" min="0" value={formData.cost_per_unit} onChange={e => setFormData(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0.00" />
                                        </div>
                                    </>
                                )}
                                {modalType === 'adjust' && (
                                    <>
                                        <div className="inv-form-row">
                                            <div className="inv-form-group">
                                                <label>Current Available</label>
                                                <input type="text" value={fmtQty(selSpare?.available_quantity)} disabled />
                                            </div>
                                            <div className="inv-form-group">
                                                <label>Adjustment Type *</label>
                                                <select value={formData.adjustment_type} onChange={e => setFormData(f => ({ ...f, adjustment_type: e.target.value }))} required>
                                                    <option value="INCREASE">Increase Stock</option>
                                                    <option value="DECREASE">Decrease Stock</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="inv-form-group">
                                            <label>Quantity *</label>
                                            <input type="number" step="0.01" min="0.01" value={formData.quantity} onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))} placeholder="0.00" required />
                                        </div>
                                        <div className="inv-form-group">
                                            <label>Reason *</label>
                                            <textarea value={formData.remarks} onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Required correction reason…" required />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="inv-modal__footer">
                                <button type="button" className="inv-btn inv-btn--ghost" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="inv-btn inv-btn--primary" disabled={submitting}>
                                    {submitting ? 'Saving…' : (
                                        <>
                                            {modalType === 'add' && 'Add Spare'}
                                            {modalType === 'stock' && 'Add Stock'}
                                            {modalType === 'adjust' && 'Adjust Stock'}
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

export default SparesInventory;
