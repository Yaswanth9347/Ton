import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import {
    Plus, Fuel, Trash2, Pencil,
    X, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Filter
} from 'lucide-react';
import { inventoryApi } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { formatTruckTypeDisplay } from '../../../utils/formatters';
import { formatDateInIST, getCurrentISTDate } from '../../../utils/dateTime';
import './InventoryPage.css';
import './DieselTracking.css';

const PAGE_SIZE = 10;
const getDateDaysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().slice(0, 10);
};

const today = () => getCurrentISTDate();

export function DieselTracking() {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [addingVehicle, setAddingVehicle] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showVehicleModal, setShowVehicleModal] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const [txPage, setTxPage] = useState(1);
    const [txFilters, setTxFilters] = useState({ truckType: '', vehicleNumber: '', transactionType: '', dateFrom: '', dateTo: '' });
    const [txPagination, setTxPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
    const [loadErrors, setLoadErrors] = useState({ transactions: '', vehicles: '' });
    const [formData, setFormData] = useState({
        vehicle_id: null,
        truck_type: '', vehicle_name: '', purchase_date: today(),
        amount: '', liters: ''
    });
    const [vehicleFormData, setVehicleFormData] = useState({
        truck_type: '',
        vehicle_number: '',
        tank_capacity: ''
    });
    const [summaryDateFrom, setSummaryDateFrom] = useState(getDateDaysAgo(30));
    const [summaryDateTo, setSummaryDateTo] = useState(today());
    const [dieselSummary, setDieselSummary] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const isAdmin = user?.role === 'ADMIN';

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

            const r = await inventoryApi.getDieselRecords(params);
            setTransactions(r.data.data || []);
            setTxPagination(r.data.pagination || { page: txPage, limit: PAGE_SIZE, total: r.data.data?.length || 0, totalPages: 1 });
            setLoadErrors(prev => ({ ...prev, transactions: '' }));
        } catch (err) {
            setLoadErrors(prev => ({ ...prev, transactions: err.response?.data?.message || 'Failed to load diesel transactions' }));
        }
    }, [txPage, txFilters]);

    const fetchVehicles = useCallback(async () => {
        try {
            const r = await inventoryApi.getDieselVehicles();
            setVehicles(r.data.data || []);
            setLoadErrors(prev => ({ ...prev, vehicles: '' }));
        } catch (err) {
            setLoadErrors(prev => ({ ...prev, vehicles: err.response?.data?.message || 'Failed to load diesel vehicles' }));
        }
    }, []);

    const fetchDieselSummary = useCallback(async () => {
        if (!summaryDateFrom || !summaryDateTo) return;
        setSummaryLoading(true);
        try {
            const res = await inventoryApi.getDieselSummary({
                start_date: summaryDateFrom,
                end_date: summaryDateTo,
            });
            setDieselSummary(res.data?.data || null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load diesel summary');
        } finally {
            setSummaryLoading(false);
        }
    }, [summaryDateFrom, summaryDateTo]);

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

    useEffect(() => {
        fetchDieselSummary();
    }, [fetchDieselSummary]);

    const openModal = () => {
        setFormData({ vehicle_id: null, truck_type: '', vehicle_name: '', purchase_date: today(), amount: '', liters: '' });
        setShowModal(true);
    };
    const openVehicleModal = () => {
        if (!isAdmin) {
            toast.error('Only Admin can add diesel vehicles');
            return;
        }
        setVehicleFormData({ truck_type: '', vehicle_number: '', tank_capacity: '' });
        setShowVehicleModal(true);
    };
    const openAddFuelModal = (record) => {
        const matchedVehicle = mappedVehicles.find((vehicle) => vehicle.id && record?.id && vehicle.id === record.id)
            || mappedVehicles.find((vehicle) => vehicle.vehicle_number === record?.vehicle_number);
        setFormData({
            vehicle_id: matchedVehicle?.id || record?.id || null,
            truck_type: matchedVehicle?.truck_type || record?.truck_type || '',
            vehicle_name: matchedVehicle?.vehicle_number || record?.vehicle_number || '',
            purchase_date: today(),
            amount: '',
            liters: ''
        });
        setShowModal(true);
    };
    const openEditFuelModal = (record) => {
        if (record?.record_source === 'GOVT_BORE' || record?.is_auto_synced) {
            toast.error('Auto-synced govt bore diesel records cannot be edited here');
            return;
        }

        setFormData({
            record_id: record.id,
            vehicle_id: record.vehicle_id || null,
            truck_type: record.truck_type || '',
            vehicle_name: record.vehicle_name || '',
            purchase_date: (record.purchase_date || record.created_at || '').slice(0, 10),
            amount: record.amount ?? '',
            liters: record.liters ?? ''
        });
        setShowModal(true);
    };
    const closeModal = () => { setShowModal(false); };
    const closeVehicleModal = () => { setShowVehicleModal(false); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const selectedVehicle = mappedVehicles.find((vehicle) => vehicle.id && formData.vehicle_id && vehicle.id === formData.vehicle_id)
                || mappedVehicles.find((vehicle) => vehicle.vehicle_number === formData.vehicle_name)
                || null;
            const payload = {
                ...formData,
                truck_type: selectedVehicle?.truck_type || formData.truck_type,
                vehicle_name: selectedVehicle?.vehicle_number || formData.vehicle_name,
                amount: parseFloat(formData.amount),
                liters: formData.liters ? parseFloat(formData.liters) : null
            };
            if (formData.record_id) {
                await inventoryApi.updateDieselRecord(formData.record_id, payload);
                toast.success('Diesel record updated');
            } else {
                await inventoryApi.createDieselRecord(payload);
                toast.success('Diesel record added');
            }
            await Promise.all([fetchTransactions(), fetchVehicles()]);
            await fetchDieselSummary();
            closeModal();
        } catch (err) {
            console.error('[Inventory] Failed to save Diesel record. Reason:', err.response?.data?.message || err.message);
            toast.error(err.response?.data?.message || 'An error occurred');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteDieselTransaction = (record) => {
        if (!isAdmin) {
            toast.error('Only Admin can delete diesel transactions');
            return;
        }

        if (record?.record_source === 'GOVT_BORE' || record?.is_auto_synced) {
            toast.error('Auto-synced govt bore diesel records cannot be deleted here');
            return;
        }

        setConfirm({
            message: 'Delete this diesel transaction? This action cannot be undone.',
            onConfirm: async () => {
                setConfirm(null);
                try {
                    await inventoryApi.deleteDieselRecord(record.id);
                    toast.success('Diesel transaction deleted');
                    await Promise.all([fetchTransactions(), fetchVehicles()]);
                    await fetchDieselSummary();
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to delete diesel transaction');
                }
            }
        });
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
            toast.success('New truck added successfully');
            await fetchVehicles();
            closeVehicleModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add truck');
        } finally {
            setAddingVehicle(false);
        }
    };

    const handleDeleteVehicle = (row) => {
        if (!isAdmin) {
            toast.error('Only Admin can delete diesel vehicles');
            return;
        }
        setConfirm({
            message: 'Are you sure you want to delete this truck record? This action cannot be undone.',
            onConfirm: async () => {
                setConfirm(null);
                try {
                    await inventoryApi.deleteDieselVehicle(row.id);
                    toast.success('Truck record deleted successfully');
                    await Promise.all([fetchVehicles(), fetchTransactions()]);
                } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to delete truck record');
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
    const selectedVehicle = sortedVehicles.find((vehicle) => vehicle.id && formData.vehicle_id && vehicle.id === formData.vehicle_id)
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
    const topErrors = [...new Set(Object.values(loadErrors).filter(Boolean))];

    return (
        <div>
            {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
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

            <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="inv-section-header">
                    <span className="inv-section-title">Diesel Summary</span>
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)', alignItems: 'center' }}>
                        <input type="date" className="inv-filter-input inv-filter-input--sm" value={summaryDateFrom} onChange={e => setSummaryDateFrom(e.target.value)} />
                        <input type="date" className="inv-filter-input inv-filter-input--sm" value={summaryDateTo} onChange={e => setSummaryDateTo(e.target.value)} max={today()} />
                        <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={fetchDieselSummary} disabled={summaryLoading}>
                            {summaryLoading ? 'Loading…' : 'Refresh'}
                        </button>
                    </div>
                </div>
                {dieselSummary && (
                    <div className="inv-stats" style={{ marginTop: 0 }}>
                        <div className="inv-stat">
                            <div className="inv-stat__value">{dieselSummary.summary?.total_records || 0}</div>
                            <div className="inv-stat__label">Refill Entries</div>
                        </div>
                        <div className="inv-stat">
                            <div className="inv-stat__value">{parseFloat(dieselSummary.summary?.total_liters || 0).toFixed(2)} L</div>
                            <div className="inv-stat__label">Total Liters</div>
                        </div>
                        <div className="inv-stat">
                            <div className="inv-stat__value">₹{parseFloat(dieselSummary.summary?.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                            <div className="inv-stat__label">Total Amount</div>
                        </div>
                    </div>
                )}
            </div>

            {/* 1) Diesel Records Table */}
            <div style={{ marginBottom: 'var(--spacing-6)' }}>
                <div className="inv-section-header">
                    <span className="inv-section-title">Diesel Records</span>
                    {isAdmin && (
                        <button className="inv-btn inv-btn--primary inv-btn--sm" onClick={openVehicleModal}>
                            <Plus size={15} /> Add New
                        </button>
                    )}
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
                                    <tr key={row.id || `${row.truck_type}-${row.vehicle_number}`}>
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
                                                {isAdmin && (
                                                    <button
                                                        className="inv-action-btn inv-action-btn--delete"
                                                        title="Delete Truck"
                                                        onClick={() => handleDeleteVehicle(row)}
                                                        disabled={!row.id}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
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
                            <div key={row.id || `${row.truck_type}-${row.vehicle_number}`} className="diesel-tank-card">
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
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr><td colSpan="8" className="inv-table__empty" style={{ textAlign: 'center' }}>No diesel transactions found.</td></tr>
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
                                            <td style={{ textAlign: 'center' }}>
                                                <div className="inv-actions" style={{ justifyContent: 'center' }}>
                                                    {transaction.record_source !== 'GOVT_BORE' && !transaction.is_auto_synced && (
                                                        <button className="inv-action-btn inv-action-btn--issue" title="Edit transaction" onClick={() => openEditFuelModal(transaction)}>
                                                            <Pencil size={13} />
                                                        </button>
                                                    )}
                                                    {isAdmin && transaction.record_source !== 'GOVT_BORE' && !transaction.is_auto_synced && (
                                                        <button className="inv-action-btn inv-action-btn--delete" title="Delete transaction" onClick={() => handleDeleteDieselTransaction(transaction)}>
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
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
                                <>{formData.record_id ? <Pencil size={16} /> : <Plus size={16} />} {formData.record_id ? 'Edit Fuel Purchase' : 'Add Fuel Purchase'}</>
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
                                    {submitting ? 'Saving…' : (formData.record_id ? 'Update Fuel' : 'Add Fuel')}
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
