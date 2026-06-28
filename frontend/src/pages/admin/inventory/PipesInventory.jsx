import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../../../components/common/ConfirmDialog';
import {
    Plus, Minus, RotateCcw, TrendingUp, TrendingDown,
    Package, AlertTriangle, Filter, Trash2, X, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, SlidersHorizontal, Pencil
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { boreApi, govtBoreApi, inventoryApi } from '../../../services/api';
import { formatTruckTypeDisplay } from '../../../utils/formatters';
import './InventoryPage.css';
import './PipesInventory.css';
import { formatDateInIST } from '../../../utils/dateTime';

const DEFAULT_PIPE_LENGTH_FEET = 20;
const TX_PAGE_SIZE = 10;
const INVENTORY_SUMMARY_REFRESH_EVENT = 'inventory:summary-refresh';

/* ── Conversion helpers ── */
const formatNumber = (value) => {
    const num = Math.round(parseFloat(value || 0) * 100) / 100;
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
};

const getPipeLengthFeet = (pipeOrLength) => {
    const parsed = typeof pipeOrLength === 'number'
        ? pipeOrLength
        : parseFloat(pipeOrLength?.length_feet ?? pipeOrLength ?? DEFAULT_PIPE_LENGTH_FEET);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PIPE_LENGTH_FEET;
};

const fmtQty = (val, lengthFeet = DEFAULT_PIPE_LENGTH_FEET) => {
    const feet = parseFloat(val || 0);
    if (!feet || feet === 0) return '0 pipes (0 ft)';

    const pipeLength = getPipeLengthFeet(lengthFeet);
    const fullPipes = Math.floor(feet / pipeLength);
    const remainingFeet = Math.round((feet % pipeLength) * 100) / 100;
    const totalFeet = `${formatNumber(feet)} ft`;
    const pipeLabel = fullPipes === 1 ? '1 pipe' : `${fullPipes} pipes`;

    if (remainingFeet === 0) return `${pipeLabel} (${totalFeet})`;
    if (fullPipes === 0) return `${formatNumber(remainingFeet)} ft (${totalFeet})`;
    return `${pipeLabel} + ${formatNumber(remainingFeet)} ft (${totalFeet})`;
};

const getPipeCount = (feetValue, lengthFeet = DEFAULT_PIPE_LENGTH_FEET) => {
    const totalFeet = parseFloat(feetValue || 0);
    const pipeLength = getPipeLengthFeet(lengthFeet);
    return totalFeet / pipeLength;
};

const formatPipeLabel = (company, size) => {
    const pipeName = company || '—';
    const pipeSize = size || '—';
    return `${pipeName} (${pipeSize})`;
};

const formatVehicleDisplay = (value) => {
    const raw = value?.trim();
    if (!raw) return '—';

    return formatTruckTypeDisplay(raw.replace(/["“”]/g, ''));
};

const stockStatus = (qty, lengthFeet = DEFAULT_PIPE_LENGTH_FEET, reorderLevel = 10) => {
    const pipes = parseFloat(qty) / getPipeLengthFeet(lengthFeet);
    if (pipes === 0) return 'critical';
    if (pipes < reorderLevel) return 'low';
    return 'good';
};

export function PipesInventory() {
    const { user } = useAuth();
    const [pipes, setPipes] = useState([]);
    const [pipeCompanies, setPipeCompanies] = useState([]);
    const [transactions, setTxns] = useState([]);
    const [allocations, setAllocations] = useState([]);
    const [privateBores, setPrivateBores] = useState([]);
    const [govtBores, setGovtBores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('');
    const [selPipe, setSelPipe] = useState(null);
    const [selAllocation, setSelAllocation] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [showCompanyModal, setShowCompanyModal] = useState(false);
    const [companySubmitting, setCompanySubmitting] = useState(false);
    const [companyForm, setCompanyForm] = useState({ company_name: '', edit_id: null });
    const [formData, setFormData] = useState({
        quantity: '', extra_feet: '', unit: 'pipes',
        bore_type: '', bore_id: '',
        adjustment_type: 'INCREASE',
        bore_search: '',
        vehicle_name: '', supervisor_name: '', remarks: '',
        size: '', company: '',
        material_type: '', quality_grade: 'Standard', length_feet: '20', cost_per_unit: '',
        allocation_id: ''
    });
    const [filters, setFilters] = useState({
        dateFrom: '', dateTo: '', company: '', size: '', transactionType: ''
    });
    const [txPage, setTxPage] = useState(1);
    const [txPagination, setTxPagination] = useState({ page: 1, limit: TX_PAGE_SIZE, total: 0, totalPages: 0 });
    const [loadErrors, setLoadErrors] = useState({ pipes: '', transactions: '', allocations: '', bores: '', companies: '' });

    const refreshInventorySummary = () => window.dispatchEvent(new Event(INVENTORY_SUMMARY_REFRESH_EVENT));

    const fetchPipes = useCallback(async () => {
        try {
            const r = await inventoryApi.getPipes();
            setPipes(r.data.data);
            setLoadErrors(prev => ({ ...prev, pipes: '' }));
        } catch (err) {
            setLoadErrors(prev => ({ ...prev, pipes: err.response?.data?.message || 'Failed to load pipe stock' }));
        }
    }, []);

    const fetchPipeCompanies = useCallback(async () => {
        try {
            const r = await inventoryApi.getPipeCompanies();
            setPipeCompanies(r.data.data || []);
            setLoadErrors(prev => ({ ...prev, companies: '' }));
        } catch (err) {
            setLoadErrors(prev => ({ ...prev, companies: err.response?.data?.message || 'Failed to load pipe companies' }));
        }
    }, []);

    const fetchTxns = useCallback(async () => {
        try {
            const params = {
                page: txPage,
                limit: TX_PAGE_SIZE,
            };
            if (filters.dateFrom) params.start_date = filters.dateFrom;
            if (filters.dateTo) params.end_date = filters.dateTo;
            if (filters.company) params.company = filters.company;
            if (filters.size) params.size = filters.size;
            if (filters.transactionType) params.transaction_type = filters.transactionType;

            const r = await inventoryApi.getPipeTransactions(params);
            setTxns(r.data.data);
            setTxPagination(r.data.pagination || { page: txPage, limit: TX_PAGE_SIZE, total: r.data.data?.length || 0, totalPages: 1 });
            setLoadErrors(prev => ({ ...prev, transactions: '' }));
        } catch (err) {
            setLoadErrors(prev => ({ ...prev, transactions: err.response?.data?.message || 'Failed to load pipe transactions' }));
        }
    }, [txPage, filters]);

    const fetchAllocations = useCallback(async () => {
        try {
            const r = await inventoryApi.getPipeAllocations();
            setAllocations(r.data.data || []);
            setLoadErrors(prev => ({ ...prev, allocations: '' }));
        } catch (err) {
            setLoadErrors(prev => ({ ...prev, allocations: err.response?.data?.message || 'Failed to load active allocations' }));
        }
    }, []);

    const fetchBores = useCallback(async () => {
        try {
            const [privateRes, govtRes] = await Promise.all([
                boreApi.getAll(),
                govtBoreApi.getAll()
            ]);
            setPrivateBores(privateRes.data.data || []);
            setGovtBores(govtRes.data.data || []);
            setLoadErrors(prev => ({ ...prev, bores: '' }));
        } catch (err) {
            setLoadErrors(prev => ({ ...prev, bores: err.response?.data?.message || 'Failed to load bore selector data' }));
        }
    }, []);

    useEffect(() => {
        Promise.all([fetchPipes(), fetchPipeCompanies(), fetchAllocations(), fetchTxns(), fetchBores()]).finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!loading) {
            fetchTxns();
        }
    }, [fetchTxns, loading]);

    const openModal = (type, pipe = null, allocation = null) => {
        setModalType(type);
        setSelPipe(pipe);
        setSelAllocation(allocation);
        setFormData({
            quantity: '', extra_feet: '', unit: 'pipes', bore_type: allocation?.bore_type || '', bore_id: allocation?.bore_id || '',
            adjustment_type: 'INCREASE', bore_search: '',
            vehicle_name: allocation?.vehicle_name || '', supervisor_name: allocation?.supervisor_name || '', remarks: '',
            size: '', company: '', material_type: '', quality_grade: 'Standard', length_feet: '20', cost_per_unit: '',
            allocation_id: allocation?.id || ''
        });
        setShowModal(true);
    };
    const closeModal = () => { setShowModal(false); setSelPipe(null); setSelAllocation(null); };

    const getSelectedPipeLengthFeet = () => {
        if (modalType === 'new-pipe') return getPipeLengthFeet(formData.length_feet || DEFAULT_PIPE_LENGTH_FEET);
        if (selPipe) return getPipeLengthFeet(selPipe);
        if (selAllocation) return getPipeLengthFeet(selAllocation);
        return DEFAULT_PIPE_LENGTH_FEET;
    };

    const openCompanyManager = () => {
        setCompanyForm({ company_name: '', edit_id: null });
        setShowCompanyModal(true);
    };

    const closeCompanyManager = () => {
        setCompanyForm({ company_name: '', edit_id: null });
        setShowCompanyModal(false);
    };

    const handleCompanySubmit = async (e) => {
        e.preventDefault();
        setCompanySubmitting(true);
        try {
            const company_name = companyForm.company_name.trim();
            if (!company_name) throw new Error('Company name is required');

            if (companyForm.edit_id) {
                await inventoryApi.updatePipeCompany(companyForm.edit_id, { company_name });
                toast.success('Company updated successfully');
            } else {
                await inventoryApi.addPipeCompany({ company_name });
                toast.success('Company added successfully');
            }

            setCompanyForm({ company_name: '', edit_id: null });
            await fetchPipeCompanies();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to save company');
        } finally {
            setCompanySubmitting(false);
        }
    };

    const handleCompanyDelete = async (companyId) => {
        try {
            await inventoryApi.deletePipeCompany(companyId);
            toast.success('Company deleted successfully');
            await fetchPipeCompanies();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete company');
        }
    };


    const getFormQuantityFeet = () => {
        const selectedLengthFeet = getSelectedPipeLengthFeet();
        const quantity = parseFloat(formData.quantity || 0);
        if (!Number.isFinite(quantity) || quantity < 0) return NaN;

        if (formData.unit === 'feet') {
            return quantity;
        }

        const extraFeet = parseFloat(formData.extra_feet || 0);
        if (!Number.isFinite(extraFeet) || extraFeet < 0 || extraFeet >= selectedLengthFeet) return NaN;

        return (quantity * selectedLengthFeet) + extraFeet;
    };

    const getQuantityPayload = (required = true) => {
        const quantityFeet = getFormQuantityFeet();
        const selectedLengthFeet = getSelectedPipeLengthFeet();

        if (!Number.isFinite(quantityFeet)) {
            throw new Error(`Enter valid pipe quantity. Extra feet must be between 0 and ${(selectedLengthFeet - 0.01).toFixed(2)}.`);
        }

        if (required && quantityFeet <= 0) {
            throw new Error('Pipe quantity must be greater than 0.');
        }

        return {
            quantity: quantityFeet,
            unit: 'feet',
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (modalType === 'add') {
                const quantityPayload = getQuantityPayload();
                await inventoryApi.addStock({
                    pipe_id: selPipe.id,
                    ...quantityPayload,
                    remarks: formData.remarks
                });
                toast.success('Stock added successfully');
            } else if (modalType === 'issue') {
                const quantityPayload = getQuantityPayload();
                await inventoryApi.issuePipes({
                    pipe_inventory_id: selPipe.id,
                    ...quantityPayload,
                    bore_type: formData.bore_type || null,
                    bore_id: formData.bore_id ? parseInt(formData.bore_id) : null,
                    vehicle_name: formData.vehicle_name,
                    supervisor_name: formData.supervisor_name,
                    remarks: formData.remarks
                });
                toast.success('Pipes issued successfully');
            } else if (modalType === 'adjust') {
                const quantityPayload = getQuantityPayload();
                await inventoryApi.adjustPipeStock(selPipe.id, {
                    adjustment_type: formData.adjustment_type,
                    ...quantityPayload,
                    remarks: formData.remarks
                });
                toast.success('Pipe stock adjusted successfully');
            } else if (modalType === 'return') {
                const quantityPayload = getQuantityPayload();
                await inventoryApi.returnPipes({
                    allocation_id: formData.allocation_id ? parseInt(formData.allocation_id) : null,
                    ...quantityPayload,
                    remarks: formData.remarks
                });
                toast.success('Pipes returned successfully');
            } else if (modalType === 'new-pipe') {
                const quantityPayload = getQuantityPayload(false);
                const payload = {
                    size: formData.size, company: formData.company,
                    quantity: quantityPayload.quantity,
                    unit: quantityPayload.unit,
                    material_type: formData.material_type || null,
                    quality_grade: formData.quality_grade || null,
                    length_feet: parseFloat(formData.length_feet) || DEFAULT_PIPE_LENGTH_FEET,
                    cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : 0
                };
                const res = await inventoryApi.addPipe(payload);
                toast.success(res.data?.message || 'Pipe record saved successfully');
            }
            await Promise.all([fetchPipes(), fetchPipeCompanies(), fetchTxns(), fetchAllocations()]);
            refreshInventorySummary();
            closeModal();
        } catch (err) {
            const backendMsg = err.response?.data?.message || err.message;
            console.error(`[Inventory - Pipes] Action failed.\nStatus: ${err.response?.status || 'Unknown'}\nError: ${backendMsg}`);
            toast.error(backendMsg);
        } finally {
            setSubmitting(false);
        }
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

    let totalPipeUnits = 0, totalStoreFeet = 0, totalInUseFeet = 0;
    pipes.forEach(pipe => {
        const q = parseFloat((pipe.store_quantity ?? pipe.quantity) || 0);
        const lengthFeet = getPipeLengthFeet(pipe);
        totalPipeUnits += (q / lengthFeet);
        totalStoreFeet += q;
        totalInUseFeet += parseFloat(pipe.in_use_quantity || 0);
    });
    const lowStock = pipes.filter(p => {
        const feet = parseFloat((p.store_quantity ?? p.quantity) || 0);
        const pipes_ = feet / getPipeLengthFeet(p);
        const reorderLevel = p.reorder_level || 10;
        return pipes_ > 0 && pipes_ < reorderLevel;
    }).length;
    const criticalStock = pipes.filter(p => parseFloat((p.store_quantity ?? p.quantity) || 0) === 0).length;

    const activeAllocations = allocations.filter(allocation => {
        const status = (allocation?.status || '').toLowerCase();
        return status !== 'done' && status !== 'completed';
    });

    const existingCompanies = [...new Set(
        pipeCompanies
            .map(company => (company.company_name || '').trim())
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    const getBoreLabel = (bore, type) => {
        if (type === 'govt') {
            const village = bore.village?.name || bore.village || bore.location || `Govt Bore #${bore.id}`;
            const mandal = bore.mandal?.name || '';
            const status = bore.status || 'No status';
            return [village, mandal, status].filter(Boolean).join(' · ');
        }

        const customer = bore.customer_name || `Private Bore #${bore.id}`;
        const village = bore.village || bore.location || '';
        const status = bore.status || (((parseFloat(bore.balance) || 0) > 0) ? 'Pending' : 'Done');
        return [customer, village, status].filter(Boolean).join(' · ');
    };

    const selectedBoreType = formData.bore_type;
    const availableBores = selectedBoreType === 'govt'
        ? govtBores
        : selectedBoreType === 'private'
            ? privateBores
            : [];
    const boreSearch = formData.bore_search.trim().toLowerCase();
    const filteredBores = availableBores
        .filter((bore) => !boreSearch || getBoreLabel(bore, selectedBoreType).toLowerCase().includes(boreSearch))
        .slice(0, 80);
    const selectedBore = availableBores.find((bore) => String(bore.id) === String(formData.bore_id));

    const applySelectedBore = (boreType, boreId) => {
        const source = boreType === 'govt' ? govtBores : privateBores;
        const bore = source.find((item) => String(item.id) === String(boreId));
        setFormData(f => ({
            ...f,
            bore_id: boreId,
            vehicle_name: boreType === 'govt'
                ? (bore?.vehicle || f.vehicle_name)
                : (bore?.vehicle_name || f.vehicle_name),
            supervisor_name: boreType === 'govt'
                ? (bore?.location || f.supervisor_name)
                : (bore?.supervisor_name || f.supervisor_name)
        }));
    };

    const setFilter = (key, val) => {
        setTxPage(1);
        setFilters(f => ({ ...f, [key]: val }));
    };
    const clearFilters = () => {
        setTxPage(1);
        setFilters({ dateFrom: '', dateTo: '', company: '', size: '', transactionType: '' });
    };

    const transactionTableHeight = `${(TX_PAGE_SIZE + 1) * 48}px`;
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
                    <div className="inv-stat__value">{formatNumber(totalPipeUnits)}</div>
                    <div className="inv-stat__label">Store Pipes</div>
                    <div className="inv-stat__sub">{formatNumber(totalStoreFeet)} ft in store</div>
                </div>
                <div className="inv-stat">
                    <div className="inv-stat__icon-row">
                        <div className="inv-stat__icon inv-stat__icon--amber"><AlertTriangle size={18} /></div>
                    </div>
                    <div className="inv-stat__value">{fmtQty(totalInUseFeet)}</div>
                    <div className="inv-stat__label">In Use</div>
                    <div className="inv-stat__sub">{activeAllocations.length} active bore allocation(s)</div>
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
                    <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                        {user?.role === 'ADMIN' && (
                            <button className="inv-btn inv-btn--ghost inv-btn--sm" onClick={openCompanyManager}>
                                Manage Companies
                            </button>
                        )}
                        <button className="inv-btn inv-btn--primary inv-btn--sm" onClick={() => openModal('new-pipe')}>
                            <Plus size={15} /> Add New Pipe Type
                        </button>
                    </div>
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
                                <th style={{ textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pipes.length === 0 ? (
                                <tr><td colSpan="8" className="inv-table__empty" style={{ textAlign: 'center' }}>No pipe types found. Add one to get started.</td></tr>
                            ) : (
                                Object.entries(pipesBySize).flatMap(([size, sizePipes]) =>
                                    sizePipes.map((pipe, idx) => {
                                        const stockFeet = parseFloat((pipe.store_quantity ?? pipe.quantity) || 0);
                                        const lengthFeet = getPipeLengthFeet(pipe);
                                        const st = stockStatus(stockFeet, lengthFeet, pipe.reorder_level || 10);
                                        const costPerUnit = parseFloat(pipe.cost_per_unit || 0);
                                        const totalValue = getPipeCount(stockFeet, lengthFeet) * costPerUnit;
                                        const hasActiveAllocation = allocations.some(a => a.pipe_inventory_id === pipe.id);
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
                                                            background: pipe.quality_grade === 'Gold' ? 'rgba(245,158,11,0.1)' : 
                                                                        (pipe.quality_grade === 'Special' || pipe.quality_grade === 'Premium') ? 'rgba(16,185,129,0.1)' : 
                                                                        pipe.quality_grade === 'Standard' ? 'rgba(37,99,235,0.1)' : 
                                                                        'rgba(156,163,175,0.1)',
                                                            color: pipe.quality_grade === 'Gold' ? 'var(--color-warning)' : 
                                                                   (pipe.quality_grade === 'Special' || pipe.quality_grade === 'Premium') ? 'var(--color-success)' : 
                                                                   pipe.quality_grade === 'Standard' ? 'var(--color-primary)' : 
                                                                   'var(--text-muted)',
                                                            padding: '2px 8px', borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: '0.7rem'
                                                        }}>{pipe.quality_grade}</span>
                                                    ) : '—'}
                                                </td>
                                                <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{fmtQty(stockFeet, lengthFeet)}</td>
                                                <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', textAlign: 'center' }}>
                                                    {costPerUnit > 0 ? `₹${costPerUnit.toLocaleString('en-IN')}` : '—'}
                                                </td>
                                                <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.82rem', color: totalValue > 0 ? 'var(--color-success)' : 'var(--text-muted)', textAlign: 'center' }}>
                                                    {totalValue > 0 ? `₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <div className="inv-actions" style={{ justifyContent: 'center' }}>
                                                        <button className="inv-action-btn inv-action-btn--add" title="Add Stock" onClick={() => openModal('add', pipe)}><Plus size={14} /></button>
                                                        <button className="inv-action-btn inv-action-btn--issue" title="Issue to Bore" onClick={() => openModal('issue', pipe)} disabled={parseFloat(pipe.store_quantity ?? pipe.quantity) === 0}><Minus size={14} /></button>
                                                        <button className="inv-action-btn inv-action-btn--return" title="Return from Bore" onClick={() => openModal('return', pipe)} disabled={!hasActiveAllocation}><RotateCcw size={14} /></button>
                                                        {user?.role === 'ADMIN' && (
                                                            <button className="inv-action-btn inv-action-btn--load" title="Adjust Stock" onClick={() => openModal('adjust', pipe)}><SlidersHorizontal size={14} /></button>
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
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{activeAllocations.length} active</span>
                </div>
                <div className="inv-table-wrap" style={{ maxHeight: transactionTableHeight, overflowY: 'auto' }}>
                    <table className="inv-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'center' }}>Village</th>
                                <th style={{ textAlign: 'center' }}>Type</th>
                                <th style={{ textAlign: 'center' }}>Vehicle Type</th>
                                <th style={{ textAlign: 'center' }}>Pipe</th>
                                <th style={{ textAlign: 'center' }}>Issued</th>
                                <th style={{ textAlign: 'center' }}>Returned</th>
                                <th style={{ textAlign: 'center' }}>Open</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeAllocations.length === 0 ? (
                                <tr><td colSpan="8" className="inv-table__empty" style={{ textAlign: 'center' }}>No active bore allocations. Store stock is fully available.</td></tr>
                            ) : activeAllocations.map((allocation) => (
                                <tr key={allocation.id}>
                                    <td style={{ fontWeight: 600, textAlign: 'center' }}>{allocation.bore_reference}</td>
                                    <td style={{ textTransform: 'capitalize', textAlign: 'center' }}>{allocation.bore_type}</td>
                                    <td style={{ textAlign: 'center' }}>{formatVehicleDisplay(allocation.vehicle_name)}</td>
                                    <td style={{ textAlign: 'center' }}>{formatPipeLabel(allocation.pipe_company, allocation.pipe_size)}</td>
                                    <td style={{ textAlign: 'center' }}>{fmtQty(allocation.issued_quantity, allocation.length_feet)}</td>
                                    <td style={{ textAlign: 'center' }}>{allocation.returned_quantity > 0 ? fmtQty(allocation.returned_quantity, allocation.length_feet) : '—'}</td>
                                    <td style={{ fontWeight: 700, color: 'var(--color-warning)', textAlign: 'center' }}>{fmtQty(allocation.open_quantity, allocation.length_feet)}</td>
                                    <td style={{ textAlign: 'center' }}>
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
                </div>

                {/* Filters */}
                <div className="inv-controls inv-controls--right" style={{ marginBottom: 'var(--spacing-3)' }}>
                    <div className="inv-filters">
                        <Filter size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <input type="date" className="inv-filter-input" value={filters.dateFrom}
                            onChange={e => setFilter('dateFrom', e.target.value)} title="From date" />
                        <input type="date" className="inv-filter-input" value={filters.dateTo}
                            onChange={e => setFilter('dateTo', e.target.value)} title="To date" />
                        <select className="inv-filter-input" value={filters.company}
                            onChange={e => setFilter('company', e.target.value)}>
                            <option value="">All Brands</option>
                            {[...new Set(pipes.map(p => p.company))].sort().map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <select className="inv-filter-input" value={filters.size}
                            onChange={e => setFilter('size', e.target.value)}>
                            <option value="">All Sizes</option>
                            {[...new Set(pipes.map(p => p.size).filter(Boolean))].sort().map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                        <select className="inv-filter-input" value={filters.transactionType}
                            onChange={e => setFilter('transactionType', e.target.value)}>
                            <option value="">All Types</option>
                            <option value="PURCHASE">Purchase</option>
                            <option value="LOAD">Load</option>
                            <option value="ISSUE">Issue</option>
                            <option value="RETURN">Return</option>
                            <option value="ADJUST_IN">Adjust In</option>
                            <option value="ADJUST_OUT">Adjust Out</option>
                        </select>
                        {(filters.dateFrom || filters.dateTo || filters.company || filters.size || filters.transactionType) && (
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
                                <th style={{ textAlign: 'center' }}>Date</th>
                                <th style={{ textAlign: 'center' }}>Type</th>
                                <th style={{ textAlign: 'center' }}>Size</th>
                                <th style={{ textAlign: 'center' }}>Brand</th>
                                <th style={{ textAlign: 'center' }}>Quantity</th>
                                <th style={{ textAlign: 'center' }}>Bore Type</th>
                                <th style={{ textAlign: 'center' }}>Vehicle</th>
                                <th style={{ textAlign: 'center' }}>Flow</th>
                                <th style={{ textAlign: 'center' }}>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length === 0 ? (
                                <tr><td colSpan="9" className="inv-table__empty" style={{ textAlign: 'center' }}>No transactions match current filters.</td></tr>
                            ) : (
                                transactions.map(tx => (
                                    <tr key={tx.id}>
                                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem', textAlign: 'center' }}>
                                            {formatDateInIST(tx.created_at)}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`status-badge status-badge--${tx.transaction_type.toLowerCase()}`} style={{ justifyContent: 'center' }}>
                                                {tx.transaction_type === 'PURCHASE' && <TrendingUp size={12} />}
                                                {tx.transaction_type === 'LOAD' && <TrendingDown size={12} />}
                                                {tx.transaction_type === 'ISSUE' && <TrendingDown size={12} />}
                                                {tx.transaction_type === 'RETURN' && <RotateCcw size={12} />}
                                                {tx.transaction_type?.startsWith('ADJUST') && <SlidersHorizontal size={12} />}
                                                {tx.transaction_type}
                                            </span>
                                        </td>
                                        <td style={{ fontWeight: 600, textAlign: 'center' }}>{tx.size}</td>
                                        <td style={{ textAlign: 'center' }}>{tx.company}</td>
                                        <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500, textAlign: 'center' }}>{fmtQty(tx.quantity, tx.length_feet)}</td>
                                        <td style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                                            {(() => {
                                                const val = tx.bore_type;
                                                if (!val) return '—';
                                                if (val === 'govt') return 'Government';
                                                if (val === 'private') return 'Private';
                                                return val;
                                            })()}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {formatVehicleDisplay(tx.vehicle_name)}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '0.76rem', textAlign: 'center' }}>
                                            {(() => {
                                                const src = (tx.source_location || '').replace(/^MAIN_STORE$/, 'Store').replace(/^SUPPLIER$/, 'Supplier').replace(/^VEHICLE:/, 'Vehicle ');
                                                const dst = (tx.destination_location || '').replace(/^MAIN_STORE$/, 'Store').replace(/^SUPPLIER$/, 'Supplier').replace(/^VEHICLE:/, 'Vehicle ');
                                                if (!src && !dst) return '—';
                                                return `${src || '—'} → ${dst || '—'}`;
                                            })()}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{tx.remarks || '—'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    {txPagination.totalPages > 1 && (
                        <div className="inv-pagination">
                            <span>
                                Showing {(txPage - 1) * TX_PAGE_SIZE + 1}–{Math.min(txPage * TX_PAGE_SIZE, txPagination.total)} of {txPagination.total}
                            </span>
                            <div className="inv-pagination__btns">
                                <button className="inv-pagination__btn" onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1}><ChevronLeft size={13} /></button>
                                {Array.from({ length: Math.min(5, txPagination.totalPages) }, (_, i) => {
                                    const pg = Math.max(1, Math.min(txPage - 2, txPagination.totalPages - 4)) + i;
                                    return <button key={pg} className={`inv-pagination__btn ${txPage === pg ? 'inv-pagination__btn--active' : ''}`} onClick={() => setTxPage(pg)}>{pg}</button>;
                                })}
                                <button className="inv-pagination__btn" onClick={() => setTxPage(p => Math.min(txPagination.totalPages, p + 1))} disabled={txPage === txPagination.totalPages}><ChevronRight size={13} /></button>
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
                                {modalType === 'adjust' && <><SlidersHorizontal size={16} /> Adjust Pipe Stock</>}
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
                                                <input type="text" value={formData.company} onChange={e => setFormData(f => ({ ...f, company: e.target.value }))} placeholder="Select existing company" required list="pipe-companies" />
                                                <datalist id="pipe-companies">
                                                    {existingCompanies.map(company => <option key={company} value={company} />)}
                                                </datalist>
                                            </div>
                                        </div>
                                        <div className="inv-form-row">
                                            <div className="inv-form-group" style={{ flex: 1 }}>
                                                <label>Quality Grade</label>
                                                <select value={formData.quality_grade} onChange={e => setFormData(f => ({ ...f, quality_grade: e.target.value }))}>
                                                    <option value="">Select quality</option>
                                                    <option value="Gold">Gold</option>
                                                    <option value="Special">Special</option>
                                                    <option value="Standard">Standard</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="inv-form-row">
                                            <div className="inv-form-group">
                                                <label>Length per pipe (feet)</label>
                                                <input type="number" step="0.01" min="1" value={formData.length_feet} onChange={e => setFormData(f => ({ ...f, length_feet: e.target.value }))} />
                                            </div>
                                            <div className="inv-form-group">
                                                <label>Cost per Unit (₹)</label>
                                                <input type="number" step="0.01" min="0" value={formData.cost_per_unit} onChange={e => setFormData(f => ({ ...f, cost_per_unit: e.target.value }))} placeholder="0.00" />
                                            </div>
                                        </div>
                                        <div className="inv-form-row">
                                            <div className="inv-form-group">
                                                <label>Initial Full Pipes (optional)</label>
                                                <input type="number" step="1" min="0" value={formData.quantity} onChange={e => setFormData(f => ({ ...f, quantity: e.target.value, unit: 'pipes' }))} placeholder="0" />
                                            </div>
                                            <div className="inv-form-group">
                                                <label>Extra Feet (optional)</label>
                                                <input type="number" step="0.01" min="0" max={Math.max(getSelectedPipeLengthFeet() - 0.01, 0.01).toFixed(2)} value={formData.extra_feet} onChange={e => setFormData(f => ({ ...f, extra_feet: e.target.value, unit: 'pipes' }))} placeholder="0" />
                                            </div>
                                        </div>
                                        {(formData.quantity || formData.extra_feet) && Number.isFinite(getFormQuantityFeet()) && (
                                            <div className="inv-form-hint">Total stock: {fmtQty(getFormQuantityFeet())}</div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="inv-form-group">
                                            <label>Pipe</label>
                                            <input type="text" value={`${selPipe?.size} — ${selPipe?.company}`} disabled />
                                        </div>
                                        <div className="inv-form-group">
                                            <label>{formData.unit === 'pipes' ? 'Full Pipes *' : 'Total Feet *'}</label>
                                            <div className="inv-form-group-inline">
                                                <input type="number" step={formData.unit === 'pipes' ? '1' : '0.01'} min={formData.unit === 'pipes' ? '0' : '0.01'} value={formData.quantity}
                                                    onChange={e => setFormData(f => ({ ...f, quantity: e.target.value }))} placeholder="Enter quantity" required={formData.unit === 'feet'} />
                                                <select value={formData.unit} onChange={e => setFormData(f => ({ ...f, unit: e.target.value, extra_feet: '' }))}>
                                                    <option value="pipes">Pipes</option>
                                                    <option value="feet">Feet</option>
                                                </select>
                                            </div>
                                        </div>
                                        {formData.unit === 'pipes' && (
                                            <div className="inv-form-group">
                                                <label>Extra Feet</label>
                                                <input type="number" step="0.01" min="0" max={(getSelectedPipeLengthFeet() - 0.01).toFixed(2)} value={formData.extra_feet}
                                                    onChange={e => setFormData(f => ({ ...f, extra_feet: e.target.value }))} placeholder="0" />
                                            </div>
                                        )}
                                        {(formData.quantity || formData.extra_feet) && Number.isFinite(getFormQuantityFeet()) && (
                                            <div className="inv-form-hint">
                                                Total: {fmtQty(getFormQuantityFeet())}
                                            </div>
                                        )}
                                        {modalType === 'add' && (
                                            <div className="inv-form-group">
                                                <label>Remarks</label>
                                                <textarea value={formData.remarks} onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Optional notes…" />
                                            </div>
                                        )}
                                        {modalType === 'adjust' && (
                                            <>
                                                <div className="inv-form-row">
                                                    <div className="inv-form-group">
                                                        <label>Current Store Stock</label>
                                                        <input type="text" value={fmtQty(selPipe?.store_quantity ?? selPipe?.quantity)} disabled />
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
                                                    <label>Reason *</label>
                                                    <textarea value={formData.remarks} onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))} rows={2} placeholder="Required correction reason…" required />
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
                                                                bore_type: allocation?.bore_type || '',
                                                                bore_id: allocation?.bore_id || '',
                                                                vehicle_name: allocation?.vehicle_name || '',
                                                                supervisor_name: allocation?.supervisor_name || ''
                                                            }));
                                                        }} required>
                                                            <option value="">Select active bore allocation</option>
                                                            {activeAllocations
                                                                .filter(a => !selPipe || a.pipe_inventory_id === selPipe.id)
                                                                .map(a => (
                                                                    <option key={a.id} value={a.id}>
                                                                        {a.bore_reference} · {a.vehicle_name || 'No vehicle'} · Open {fmtQty(a.open_quantity, a.length_feet)}
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
                                                        <select value={formData.bore_type} onChange={e => setFormData(f => ({ ...f, bore_type: e.target.value, bore_id: '', bore_search: '', vehicle_name: '', supervisor_name: '' }))} disabled={modalType === 'return' && !!formData.allocation_id} required={modalType === 'issue'}>
                                                            <option value="">None</option>
                                                            <option value="private">Private Bore</option>
                                                            <option value="govt">Government Bore</option>
                                                        </select>
                                                    </div>
                                                    {formData.bore_type && modalType === 'issue' && (
                                                        <div className="inv-form-group">
                                                            <label>Search Bore</label>
                                                            <input type="text" value={formData.bore_search} onChange={e => setFormData(f => ({ ...f, bore_search: e.target.value }))} placeholder="Search village, customer, status…" />
                                                        </div>
                                                    )}
                                                </div>
                                                {formData.bore_type && modalType === 'issue' && (
                                                    <>
                                                        <div className="inv-form-group">
                                                            <label>Bore Job *</label>
                                                            <select value={formData.bore_id} onChange={e => applySelectedBore(formData.bore_type, e.target.value)} required>
                                                                <option value="">Select bore job</option>
                                                                {filteredBores.map((bore) => (
                                                                    <option key={bore.id} value={bore.id}>{getBoreLabel(bore, formData.bore_type)}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        {selectedBore && (
                                                            <div className="inv-form-hint">
                                                                Selected: {getBoreLabel(selectedBore, formData.bore_type)}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
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
                                            {modalType === 'adjust' && 'Adjust Stock'}
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

            {showCompanyModal && (
                <div className="modal-overlay" onClick={closeCompanyManager}>
                    <div className="inv-modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                        <div className="inv-modal__header">
                            <span className="inv-modal__title">Pipe Companies</span>
                            <button className="inv-modal__close" onClick={closeCompanyManager}>×</button>
                        </div>
                        <form onSubmit={handleCompanySubmit}>
                            <div className="inv-modal__body">
                                <div className="inv-form-row">
                                    <div className="inv-form-group" style={{ flex: 1 }}>
                                        <label>Company Name *</label>
                                        <input
                                            type="text"
                                            value={companyForm.company_name}
                                            onChange={e => setCompanyForm(f => ({ ...f, company_name: e.target.value }))}
                                            placeholder="Enter company name"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="inv-table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
                                    <table className="inv-table">
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left' }}>Company</th>
                                                <th style={{ textAlign: 'center', width: 140 }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pipeCompanies.length === 0 ? (
                                                <tr><td colSpan="2" className="inv-table__empty">No companies found.</td></tr>
                                            ) : pipeCompanies.map(company => (
                                                <tr key={company.id}>
                                                    <td>{company.company_name}</td>
                                                    <td>
                                                        <div className="inv-actions" style={{ justifyContent: 'center' }}>
                                                            <button type="button" className="inv-action-btn inv-action-btn--issue" title="Edit" onClick={() => setCompanyForm({ company_name: company.company_name, edit_id: company.id })}>
                                                                <Pencil size={13} />
                                                            </button>
                                                            <button type="button" className="inv-action-btn inv-action-btn--delete" title="Delete" onClick={() => handleCompanyDelete(company.id)}>
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="inv-modal__footer">
                                <button type="button" className="inv-btn inv-btn--ghost" onClick={closeCompanyManager}>Close</button>
                                <button type="submit" className="inv-btn inv-btn--primary" disabled={companySubmitting}>
                                    {companySubmitting ? 'Saving…' : (companyForm.edit_id ? 'Update Company' : 'Add Company')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PipesInventory;
