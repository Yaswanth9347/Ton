import { useState, useEffect, useCallback } from 'react';
import {
    Plus, Fuel, Trash2,
    X, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';
import axios from 'axios';
import { inventoryApi } from '../../../services/api';
import { formatTruckTypeDisplay } from '../../../utils/formatters';
import { formatDateInIST, getCurrentISTDate } from '../../../utils/dateTime';
import './InventoryPage.css';
import './DieselTracking.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const PAGE_SIZE = 10;

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

const today = () => getCurrentISTDate();

export function DieselTracking() {
    const [transactions, setTransactions] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [addingVehicle, setAddingVehicle] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [toast, setToast] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [txPage, setTxPage] = useState(1);
    const [txFilters, setTxFilters] = useState({ truckType: '', vehicleNumber: '', transactionType: '', dateFrom: '', dateTo: '' });
    const [txPagination, setTxPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
    const [formData, setFormData] = useState({
        truck_type: '', vehicle_name: '', purchase_date: today(),
        amount: '', liters: ''
    });
    const [vehicleFormData, setVehicleFormData] = useState({
        truck_type: '',
        vehicle_number: '',
        tank_capacity: ''
    });

    const showToast = (type, msg) => setToast({ type, message: msg });
    const authH = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

    const fetchTransactions = useCallback(async () => {
        try {
            const params = {
                page: txPage,
                limit: PAGE_SIZE,
            };
            if (txFilters.truckType) params.truck_type = txFilters.truckType;
            if (txFilters.vehicleNumber) params.vehicle_number = txFilters.vehicleNumber;
            if (txFilters.transactionType) params.transaction_type = txFilters.transactionType;
            if (txFilters.dateFrom) params.start_date = txFilters.dateFrom;
            if (txFilters.dateTo) params.end_date = txFilters.dateTo;

            const r = await axios.get(`${API_URL}/inventory/diesel`, {
                headers: authH(),
                params,
            });
            setTransactions(r.data.data || []);
            setTxPagination(r.data.pagination || { page: txPage, limit: PAGE_SIZE, total: r.data.data?.length || 0, totalPages: 1 });
        } catch (err) {
            console.error('[Inventory] Error fetching Diesel data:', err);
        }
    }, [txPage, txFilters]);

    const fetchVehicles = useCallback(async () => {
        try {
            const r = await inventoryApi.getDieselVehicles();
            setVehicles(r.data.data || []);
        } catch (err) {
            console.error('[Inventory] Error fetching diesel vehicle status:', err);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchTransactions(), fetchVehicles()]).finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!loading) {
            fetchTransactions();
        }
    }, [fetchTransactions, loading]);

    const openModal = () => {
        setFormData({ truck_type: '', vehicle_name: '', purchase_date: today(), amount: '', liters: '' });
        setShowModal(true);
    };
    const openVehicleModal = () => {
        setVehicleFormData({ truck_type: '', vehicle_number: '', tank_capacity: '' });
        setShowVehicleModal(true);
    };
    const openAddFuelModal = (record) => {
        const matchedVehicle = mappedVehicles.find((vehicle) => vehicle.truck_type === record?.truck_type)
            || mappedVehicles.find((vehicle) => vehicle.vehicle_number === record?.vehicle_number);
        setFormData({
            truck_type: matchedVehicle?.truck_type || record?.truck_type || '',
            vehicle_name: matchedVehicle?.vehicle_number || record?.vehicle_number || '',
            purchase_date: today(),
            amount: '',
            liters: ''
        });
        setShowModal(true);
    };
    const closeModal = () => { setShowModal(false); };
    const closeVehicleModal = () => { setShowVehicleModal(false); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const selectedVehicle = mappedVehicles.find((vehicle) => vehicle.truck_type === formData.truck_type) || null;
            const payload = {
                ...formData,
                truck_type: formData.truck_type,
                vehicle_name: selectedVehicle?.vehicle_number || formData.vehicle_name || formData.truck_type,
                amount: parseFloat(formData.amount),
                liters: formData.liters ? parseFloat(formData.liters) : null
            };
            await axios.post(`${API_URL}/inventory/diesel`, payload, { headers: authH() });
            showToast('success', 'Diesel record added');
            await Promise.all([fetchTransactions(), fetchVehicles()]);
            closeModal();
        } catch (err) {
            console.error('[Inventory] Failed to add Diesel record. Reason:', err.response?.data?.message || err.message);
            showToast('error', err.response?.data?.message || 'An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddVehicle = async (e) => {
        e.preventDefault();
        setAddingVehicle(true);
        try {
            await inventoryApi.addDieselVehicle({
                truck_type: vehicleFormData.truck_type,
                vehicle_number: vehicleFormData.vehicle_number,
                tank_capacity: parseFloat(vehicleFormData.tank_capacity)
            });
            showToast('success', 'New truck added successfully');
            await fetchVehicles();
            closeVehicleModal();
        } catch (err) {
            showToast('error', err.response?.data?.message || 'Failed to add truck');
        } finally {
            setAddingVehicle(false);
        }
    };

    const handleDeleteVehicle = (row) => {
        setConfirm({
            message: 'Are you sure you want to delete this truck record? This action cannot be undone.',
            onConfirm: async () => {
                setConfirm(null);
                try {
                    await inventoryApi.deleteDieselVehicle(row.id);
                    showToast('success', 'Truck record deleted successfully');
                    await Promise.all([fetchVehicles(), fetchTransactions()]);
                } catch (err) {
                    showToast('error', err.response?.data?.message || 'Failed to delete truck record');
                }
            }
        });
    };

    if (loading) return <div className="inv-spinner"><div className="inv-spinner__ring" />Loading diesel records…</div>;

    /* Derived */
    const mappedVehicles = [...(vehicles || [])].sort((a, b) => {
        const byTruck = (a.truck_type || '').localeCompare(b.truck_type || '', undefined, { sensitivity: 'base' });
        if (byTruck !== 0) return byTruck;
        return (a.vehicle_number || '').localeCompare(b.vehicle_number || '', undefined, { sensitivity: 'base' });
    });
    const sortedVehicles = mappedVehicles.map((vehicle) => ({
        ...vehicle,
        tank_capacity: parseFloat(vehicle?.tank_capacity || 0),
        current_fuel: parseFloat(vehicle?.current_fuel || 0),
        tank_percentage: parseFloat(vehicle?.tank_percentage || 0),
    }));
    const selectedVehicle = sortedVehicles.find((vehicle) => vehicle.truck_type === formData.truck_type)
        || sortedVehicles.find((vehicle) => vehicle.vehicle_number === formData.vehicle_name)
        || null;

    const dieselRows = sortedVehicles.map((vehicle) => {
        return {
            id: vehicle?.id,
            truck_type: vehicle.truck_type,
            vehicle_number: vehicle?.vehicle_number || '—',
            tank_capacity: parseFloat(vehicle?.tank_capacity || 0),
            current_fuel: parseFloat(vehicle?.current_fuel || 0),
            tank_percentage: Math.max(0, Math.min(100, parseFloat(vehicle?.tank_percentage || 0))),
            latest_purchase_date: vehicle?.latest_purchase_date || null,
            total_liters: parseFloat(vehicle?.total_liters || 0),
            total_cost: parseFloat(vehicle?.total_cost || 0),
        };
    });

    const desktopCardColumns = dieselRows.length >= 4 ? 4 : Math.max(1, dieselRows.length || 1);

    const totalTxPages = txPagination.totalPages || 0;

    return (
        <div>
            {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
            {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

            {/* 1) Diesel Records Table */}
            <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="inv-section-header">
                    <span className="inv-section-title">Diesel Records</span>
                    <button className="inv-btn inv-btn--primary inv-btn--sm" onClick={openVehicleModal}>
                        <Plus size={15} /> Add New
                    </button>
                </div>
                <div className="inv-table-wrap">
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center' }}>Vehicle Type</th>
                                <th style={{ textAlign: 'center' }}>Vehicle Number</th>
                                <th style={{ textAlign: 'center' }}>Latest Purchase Date</th>
                                <th style={{ textAlign: 'center' }}>Total Liters</th>
                                <th style={{ textAlign: 'center' }}>Total Cost (₹)</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dieselRows.length === 0 ? (
                                <tr><td colSpan="6" className="inv-table__empty" style={{ textAlign: 'center' }}>No truck records yet. Click Add New to create one.</td></tr>
                            ) : dieselRows.map((row) => {
                                return (
                                    <tr key={row.truck_type}>
                                        <td style={{ fontWeight: 700, textAlign: 'center' }}>{formatTruckTypeDisplay(row.truck_type)}</td>
                                        <td style={{ textAlign: 'center' }}>{row.vehicle_number}</td>
                                        <td style={{ textAlign: 'center' }}>{row.latest_purchase_date ? formatDateInIST(row.latest_purchase_date) : '—'}</td>
                                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{row.total_liters.toFixed(2)} L</td>
                                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-warning)' }}>₹{row.total_cost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className="inv-actions" style={{ justifyContent: 'center' }}>
                                                <button className="inv-action-btn inv-action-btn--add" title="Add Fuel" onClick={() => openAddFuelModal(row)}>
                                                    <Plus size={14} />
                                                </button>
                                                <button
                                                    className="inv-action-btn inv-action-btn--delete"
                                                    title="Delete Truck"
                                                    onClick={() => handleDeleteVehicle(row)}
                                                    disabled={!row.id}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 2) Truck Fuel Status Table */}
            <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="inv-section-header">
                    <span className="inv-section-title">Vehicle Fuel Status</span>
                </div>
                <div className={`diesel-tank-grid diesel-tank-grid--${desktopCardColumns}`}>
                    {dieselRows.length === 0 ? (
                        <div className="diesel-empty">No truck fuel status available. Add truck records in Diesel Records.</div>
                    ) : dieselRows.map((row) => {
                        const tankCapacity = row.tank_capacity;
                        const currentFuel = row.current_fuel;
                        const percentage = row.tank_percentage;

                        return (
                            <div key={row.truck_type} className="diesel-tank-card">
                                <div className="diesel-tank-card__head">
                                    <div>
                                        <div className="diesel-tank-card__type">{formatTruckTypeDisplay(row.truck_type)}</div>
                                        <div className="diesel-tank-card__vehicle">{row.vehicle_number}</div>
                                    </div>
                                    <div className="diesel-tank-card__pct">{percentage.toFixed(0)}%</div>
                                </div>
                                <div className="diesel-fuel-bar-wrap">
                                    <div className="diesel-fuel-bar-track">
                                        <div className="diesel-fuel-bar-fill" style={{ width: `${percentage}%` }} />
                                    </div>
                                </div>
                                <div className="diesel-tank-card__fuel-info">
                                    <span className="diesel-tank-card__fuel-value">Current: {currentFuel.toFixed(2)} L</span>
                                    <span className="diesel-tank-card__fuel-value">Capacity: {tankCapacity.toFixed(2)} L</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 3) Transaction History Table */}
            <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="inv-section-header">
                    <span className="inv-section-title">Transaction History</span>
                </div>
                <div className="inv-controls inv-controls--right" style={{ marginBottom: 'var(--spacing-3)' }}>
                    <div className="inv-filters">
                        <Filter size={15} style={{ color: 'var(--text-muted)' }} />
                        <select className="inv-filter-input" value={txFilters.truckType} onChange={e => { setTxFilters(f => ({ ...f, truckType: e.target.value })); setTxPage(1); }}>
                            <option value="">All Vehicle Types</option>
                            {[...new Set((vehicles || []).map(v => v.truck_type).filter(Boolean))].sort().map(truckType => (
                                <option key={truckType} value={truckType}>{formatTruckTypeDisplay(truckType)}</option>
                            ))}
                        </select>
                        <select className="inv-filter-input" value={txFilters.vehicleNumber} onChange={e => { setTxFilters(f => ({ ...f, vehicleNumber: e.target.value })); setTxPage(1); }}>
                            <option value="">All Vehicles</option>
                            {[...new Set((vehicles || []).map(v => v.vehicle_number).filter(Boolean))].sort().map(vehicleNumber => (
                                <option key={vehicleNumber} value={vehicleNumber}>{vehicleNumber}</option>
                            ))}
                        </select>
                        <select className="inv-filter-input" value={txFilters.transactionType} onChange={e => { setTxFilters(f => ({ ...f, transactionType: e.target.value })); setTxPage(1); }}>
                            <option value="">All Types</option>
                            <option value="REFILL">Refill</option>
                            <option value="CONSUMPTION">Consumption</option>
                        </select>
                        <input type="date" className="inv-filter-input" value={txFilters.dateFrom} onChange={e => { setTxFilters(f => ({ ...f, dateFrom: e.target.value })); setTxPage(1); }} />
                        <input type="date" className="inv-filter-input" value={txFilters.dateTo} onChange={e => { setTxFilters(f => ({ ...f, dateTo: e.target.value })); setTxPage(1); }} />
                        {(txFilters.truckType || txFilters.vehicleNumber || txFilters.transactionType || txFilters.dateFrom || txFilters.dateTo) && (
                            <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={() => { setTxFilters({ truckType: '', vehicleNumber: '', transactionType: '', dateFrom: '', dateTo: '' }); setTxPage(1); }}>
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
                                <th style={{ textAlign: 'center' }}>Vehicle Type</th>
                                <th style={{ textAlign: 'center' }}>Vehicle Number</th>
                                <th style={{ textAlign: 'center' }}>Transaction Type</th>
                                <th style={{ textAlign: 'center' }}>Liters</th>
                                <th style={{ textAlign: 'center' }}>Amount (₹)</th>
                                <th style={{ textAlign: 'center' }}>Source → Destination</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr><td colSpan="7" className="inv-table__empty" style={{ textAlign: 'center' }}>No diesel transactions found.</td></tr>
                            ) : (
                                transactions.map((transaction) => {
                                    const liters = parseFloat(transaction.liters || 0);
                                    const amount = parseFloat(transaction.amount || 0);
                                    const txType = (transaction.transaction_type || '').toUpperCase();
                                    return (
                                        <tr key={transaction.id}>
                                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                                {formatDateInIST(transaction.purchase_date || transaction.created_at)}
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{transaction.truck_type ? formatTruckTypeDisplay(transaction.truck_type) : '—'}</td>
                                            <td style={{ textAlign: 'center' }}>{transaction.vehicle_name || '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                {txType ? (
                                                    <span className={`status-badge status-badge--${txType.toLowerCase()}`} style={{ justifyContent: 'center' }}>
                                                        <span className="status-badge__dot" />
                                                        {txType}
                                                    </span>
                                                ) : '—'}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>{Number.isFinite(liters) ? `${liters.toFixed(2)} L` : '—'}</td>
                                            <td style={{ textAlign: 'center', color: 'var(--color-warning)', fontWeight: 600 }}>
                                                {transaction.transaction_type === 'REFILL' && amount > 0 ? `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                                            </td>
                                            <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                {transaction.source_destination || (transaction.transaction_type === 'REFILL' ? 'Fuel Station → Truck' : 'Truck → Bore Operation')}
                                            </td>
                                        </tr>
                                    );
                                })
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
                    <div className="inv-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                        <div className="inv-modal__header">
                            <span className="inv-modal__title">
                                <><Plus size={16} /> Add Fuel Purchase</>
                            </span>
                            <button className="inv-modal__close" onClick={closeModal}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="inv-modal__body">
                                <div className="inv-form-row">
                                    <div className="inv-form-group">
                                        <label>Vehicle Type *</label>
                                        <input type="text" value={formatTruckTypeDisplay(formData.truck_type)} readOnly />
                                    </div>
                                    <div className="inv-form-group">
                                        <label>Vehicle Number *</label>
                                        <input type="text" value={selectedVehicle?.vehicle_number || formData.vehicle_name || ''} readOnly />
                                    </div>
                                </div>
                                <div className="inv-form-row">
                                    <div className="inv-form-group">
                                        <label>Purchase Date *</label>
                                        <input type="date" value={formData.purchase_date} max={today()} onChange={e => setFormData(f => ({ ...f, purchase_date: e.target.value }))} required />
                                    </div>
                                    <div className="inv-form-group">
                                        <label>Liters Filled *</label>
                                        <input type="number" step="0.01" min="0" value={formData.liters} onChange={e => setFormData(f => ({ ...f, liters: e.target.value }))} placeholder="0.00" required />
                                    </div>
                                </div>
                                {selectedVehicle && (
                                    <div className="inv-form-hint" style={{ marginTop: '-4px', marginBottom: '4px' }}>
                                        Fuel status: {parseFloat(selectedVehicle.current_fuel || 0).toFixed(2)} L / {parseFloat(selectedVehicle.tank_capacity || 0).toFixed(2)} L ({parseFloat(selectedVehicle.tank_percentage || 0).toFixed(0)}%)
                                    </div>
                                )}
                                <div className="inv-form-row">
                                    <div className="inv-form-group">
                                        <label>Amount Paid (₹) *</label>
                                        <input type="number" step="0.01" min="0" value={formData.amount} onChange={e => setFormData(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
                                    </div>
                                </div>
                                {formData.amount && formData.liters && parseFloat(formData.liters) > 0 && (
                                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', padding: '8px 14px', fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', fontWeight: 600 }}>
                                        <Fuel size={12} style={{ display: 'inline', marginRight: 4 }} />
                                        Price per liter: ₹{(parseFloat(formData.amount) / parseFloat(formData.liters)).toFixed(2)}
                                    </div>
                                )}

                            </div>
                            <div className="inv-modal__footer">
                                <button type="button" className="inv-btn inv-btn--ghost" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="inv-btn inv-btn--primary" disabled={submitting}>
                                    {submitting ? 'Saving…' : 'Add Fuel'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showVehicleModal && (
                <div className="modal-overlay" onClick={closeVehicleModal}>
                    <div className="inv-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                        <div className="inv-modal__header">
                            <span className="inv-modal__title"><><Plus size={16} /> Add New Vehicle</></span>
                            <button className="inv-modal__close" onClick={closeVehicleModal}>×</button>
                        </div>
                        <form onSubmit={handleAddVehicle}>
                            <div className="inv-modal__body">
                                <div className="inv-form-row">
                                    <div className="inv-form-group">
                                        <label>Vehicle Type *</label>
                                        <input
                                            type="text"
                                            value={vehicleFormData.truck_type}
                                            onChange={e => setVehicleFormData(v => ({ ...v, truck_type: e.target.value }))}
                                            placeholder="e.g. 12 Tyre"
                                            required
                                        />
                                    </div>
                                    <div className="inv-form-group">
                                        <label>Vehicle Number *</label>
                                        <input
                                            type="text"
                                            value={vehicleFormData.vehicle_number}
                                            onChange={e => setVehicleFormData(v => ({ ...v, vehicle_number: e.target.value }))}
                                            placeholder="e.g. AP 09 XX 1234"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="inv-form-row">
                                    <div className="inv-form-group">
                                        <label>Tank Capacity (L) *</label>
                                        <input
                                            type="number"
                                            min="1"
                                            step="0.01"
                                            value={vehicleFormData.tank_capacity}
                                            onChange={e => setVehicleFormData(v => ({ ...v, tank_capacity: e.target.value }))}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="inv-modal__footer">
                                <button type="button" className="inv-btn inv-btn--ghost" onClick={closeVehicleModal}>Cancel</button>
                                <button type="submit" className="inv-btn inv-btn--primary" disabled={addingVehicle}>
                                    {addingVehicle ? 'Saving…' : 'Add New Vehicle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DieselTracking;
