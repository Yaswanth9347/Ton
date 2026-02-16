import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Plus, Edit2, Trash2, Download, ChevronLeft, ChevronRight, FileText, MapPin, IndianRupee, Droplets, Filter, X, Eye } from 'lucide-react';
import BorewellForm from '../components/govt-bores/BorewellForm';
import { govtBoreApi } from '../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';

// Column definitions matching Excel structure
const DISPLAY_COLS = [
    // sNo and mandal are handled manually in the table/export
    { key: 'village', label: 'Village', width: '120px' },
    { key: 'location', label: 'Point / Supervisor', width: '150px' },
    { key: 'vehicle', label: 'Vehicle', width: '100px' },
    { key: 'grant', label: 'Grant', width: '100px', align: 'center' },
    { key: 'date', label: 'Date', width: '110px', align: 'center' },
    { key: 'platform_date', label: 'Platform Dt', width: '110px', align: 'center' },
    { key: 'drilling_depth_mtrs', label: 'Total Feet', width: '80px', isNumber: true, align: 'center' },
    { key: 'drilling_amount', label: 'Drilling Amt', width: '110px', isNumber: true, align: 'center' },
    { key: 'casing_type', label: 'Casing Type', width: '110px', align: 'center' },
    { key: 'casing140_qty', label: 'Cas140 (Feet)', width: '110px', isNumber: true, align: 'center' },
    { key: 'casing180_qty', label: 'Cas180 (Feet)', width: '110px', isNumber: true, align: 'center' },
    { key: 'casing250_qty', label: 'Cas250 (Feet)', width: '110px', isNumber: true, align: 'center' },
    { key: 'total_casing_amount', label: 'Total Casing Amt', width: '130px', isNumber: true, align: 'center' }, // New Calculated
    { key: 'material_date', label: 'Material Dt', width: '110px', align: 'center' },
    { key: 'pipe_company', label: 'Pipe Company', width: '110px', align: 'center' },
    { key: 'gi_pipes_amount', label: 'Pipe Amount', width: '100px', isNumber: true, align: 'center' },
    { key: 'materials_total', label: 'Materials Total', width: '110px', isNumber: true, align: 'center' }, // New Calculated
    { key: 'labour_amount', label: 'Labour Charges', width: '110px', isNumber: true, align: 'center' },
    { key: 'gross_amount', label: 'Gross Amount', width: '110px', isNumber: true, align: 'center' },
    { key: 'estCost', label: 'Est Cost', width: '100px', isNumber: true, align: 'center' },
    { key: 'total_bill_amount', label: 'Bill Amount (TVW)', width: '120px', isNumber: true, align: 'center' },
    { key: 'total_recoveries', label: 'Total Recoveries', width: '110px', isNumber: true, align: 'center' },
    { key: 'net_amount', label: 'Net Amount', width: '110px', isNumber: true, align: 'center' },
    { key: 'pcs', label: 'PCs', width: '70px', isNumber: true, align: 'center' },
    { key: 'bank_name', label: 'Bank Name', width: '110px', align: 'center' },
    { key: 'cheque_no', label: 'Cheque No', width: '100px', align: 'center' },
    { key: 'cheque_date', label: 'Cheque Date', width: '100px', align: 'center' },
    { key: 'voucher_no', label: 'Voucher No', width: '100px', align: 'center' },
    { key: 'mBookNo', label: 'M Book No', width: '100px', align: 'center' },
    { key: 'status', label: 'Status', width: '100px', align: 'center' },
];

const ITEMS_PER_PAGE = 25;

export default function GovtBoresPage() {
    const { isAdmin } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [saving, setSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const scrollContainerRef = useRef(null);
    const [statusFilter, setStatusFilter] = useState('');
    const [viewMode, setViewMode] = useState(false); // Track if modal is in view-only mode

    // Fetch records
    const fetchRecords = useCallback(async () => {
        try {
            setLoading(true);
            const res = await govtBoreApi.getAll();
            setRecords(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch govt bore records:', err);
            toast.error('Failed to load records');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    // Format date for display
    const formatDate = (val) => {
        if (!val) return '-';
        try {
            return new Date(val).toLocaleDateString('en-GB');
        } catch {
            return val;
        }
    };

    // Helper to access nested/flat data
    const getValue = (rec, key) => {
        if (key === 'mandal') return rec.mandal?.name || '-';
        if (key === 'village') return rec.village?.name || '-';
        if (key === 'vehicle') {
            // Standardize vehicle display
            const val = rec[key];
            if (!val) return '-';
            if (val.toLowerCase() === '4 1/2 tyre') return '4 ½ Tyre';
            if (val.toLowerCase() === '6 1/2 tyre') return '6 ½ Tyre';
            // If matches 10 tyre or 10 Tyre
            if (val.toLowerCase() === '10 tyre') return '10 Tyre';
            // Default capitalization of 'Tyre'
            return val.replace(/\btyre\b/gi, 'Tyre');
        }
        if (key === 'date' || key === 'platform_date' || key === 'material_date' || key === 'cheque_date') return formatDate(rec[key]);

        // Calculated Fields
        if (key === 'total_casing_amount') {
            return (parseFloat(rec.casing180_amount) || 0) +
                (parseFloat(rec.casing140_amount) || 0) +
                (parseFloat(rec.casing250_amount) || 0);
        }

        if (key === 'materials_total') {
            // Sum of all materials excluding pipes (since Pipe Amount is separate)
            // pumpset, cylinders, stand, head_handle, plotfarm, erection, borecap
            let total = (parseFloat(rec.pumpset_amount) || 0) +
                (parseFloat(rec.cylinders_amount) || 0) +
                (parseFloat(rec.stand_amount) || 0) +
                (parseFloat(rec.head_handle_amount) || 0) +
                (parseFloat(rec.plotfarm_amount) || 0) +
                (parseFloat(rec.erection_amount) || 0) +
                (parseFloat(rec.borecap_amount) || 0);

            // Add Custom Materials from custom_data
            if (rec.custom_data && rec.custom_data.materials && Array.isArray(rec.custom_data.materials)) {
                total += rec.custom_data.materials.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            }
            return total;
        }

        return rec[key];
    };

    // Format number/currency for display
    const formatValue = (col, val) => {
        if (val === null || val === undefined || val === '') return '-';
        if (col.isDate) return formatDate(val);
        if (col.isNumber && typeof val === 'number') {
            return '₹' + val.toLocaleString('en-IN');
        }
        if (col.isNumber && !isNaN(parseFloat(val))) {
            return '₹' + parseFloat(val).toLocaleString('en-IN');
        }
        return val;
    };

    // Filter records based on search and status
    const filteredRecords = useMemo(() => {
        let result = records;

        if (statusFilter) {
            result = result.filter(rec => rec.status === statusFilter);
        }

        if (!search.trim()) return result;
        const term = search.toLowerCase();
        return result.filter((rec) => {
            const village = rec.village?.name || '';
            const mandal = rec.mandal?.name || '';
            const location = rec.location || '';
            const vehicle = rec.vehicle || '';
            const grant = rec.grant || ''; // New
            const bank = rec.bank_name || ''; // New
            const cheque = rec.cheque_no || ''; // New
            const voucher = rec.voucher_no || ''; // New
            const mBook = rec.mBookNo || ''; // New

            return village.toLowerCase().includes(term) ||
                mandal.toLowerCase().includes(term) ||
                location.toLowerCase().includes(term) ||
                vehicle.toLowerCase().includes(term) ||
                grant.toLowerCase().includes(term) ||
                bank.toLowerCase().includes(term) ||
                cheque.toLowerCase().includes(term) ||
                voucher.toLowerCase().includes(term) ||
                mBook.toLowerCase().includes(term);
        });
    }, [records, search, statusFilter]);

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredRecords, currentPage]);

    // Reset page on search change
    useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

    // Summary stats
    const stats = useMemo(() => {
        const total = records.length;
        const totalAmount = records.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const netAmount = records.reduce((sum, r) => sum + (parseFloat(r.net_amount) || 0), 0);
        const mandals = new Set(records.map((r) => r.mandal?.name).filter(Boolean)).size;
        const billPaid = records.filter(r => r.status === 'Bill Paid').length;
        return { total, totalAmount, netAmount, mandals, billPaid };
    }, [records]);

    // Handlers
    const handleAdd = () => {
        setSelectedRecord(null);
        setViewMode(false);
        setIsModalOpen(true);
    };

    const handleEdit = (record) => {
        setSelectedRecord(record);
        setViewMode(false);
        setIsModalOpen(true);
    };

    const handleView = (record) => {
        setSelectedRecord(record);
        setViewMode(true);
        setIsModalOpen(true);
    };



    const handleDelete = async (record) => {
        if (!window.confirm('Are you sure you want to delete this record?')) return;
        try {
            await govtBoreApi.delete(record.id);
            toast.success('Record deleted');
            fetchRecords();
        } catch {
            toast.error('Failed to delete record');
        }
    };

    const handleSave = async (formData) => {
        try {
            setSaving(true);
            if (selectedRecord) {
                await govtBoreApi.update(selectedRecord.id, formData);
                toast.success('Record updated');
            } else {
                await govtBoreApi.create(formData);
                toast.success('Record created');
            }
            setIsModalOpen(false);
            fetchRecords();
        } catch {
            toast.error('Failed to save record');
        } finally {
            setSaving(false);
        }
    };

    const handleExportExcel = () => {
        try {
            // Prepare data for Excel
            const exportData = filteredRecords.map((rec, i) => {
                const row = {
                    'S.No': rec.sNo || i + 1,
                    'Mandal': rec.mandal?.name || '',
                };

                DISPLAY_COLS.forEach(col => {
                    let val = getValue(rec, col.key);
                    // Parse numbers if applicable
                    if (col.isNumber) {
                        // Remove commas if present and convert to number
                        if (typeof val === 'string') val = val.replace(/,/g, '');
                        val = parseFloat(val) || 0;
                    }
                    row[col.label] = val;
                });
                return row;
            });

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Auto-width for columns
            const colWidths = Object.keys(exportData[0] || {}).map(key => ({
                wch: Math.max(key.length, ...exportData.map(d => String(d[key] || '').length)) + 2
            }));
            ws['!cols'] = colWidths;

            // Create workbook and append sheet
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Govt Bores');

            // Save file
            XLSX.writeFile(wb, `Govt_Bores_${new Date().toISOString().split('T')[0]}.xlsx`);
            toast.success('Excel exported successfully');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export Excel');
        }
    };



    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Bill Paid': return 'badge badge-success';
            case 'Completed': return 'badge badge-info';
            case 'In Progress': return 'badge badge-warning';
            case 'Pending': return 'badge badge-pending';
            default: return 'badge';
        }
    };

    return (
        <div className="govt-bores">
            {/* Summary Cards */}
            <div className="govt-bores__stats">
                <div className="govt-bores__stat-card">
                    <div className="govt-bores__stat-icon govt-bores__stat-icon--total">
                        <FileText size={20} />
                    </div>
                    <div className="govt-bores__stat-info">
                        <span className="govt-bores__stat-value">{stats.total}</span>
                        <span className="govt-bores__stat-label">Total Records</span>
                    </div>
                </div>
                <div className="govt-bores__stat-card">
                    <div className="govt-bores__stat-icon govt-bores__stat-icon--villages">
                        <MapPin size={20} />
                    </div>
                    <div className="govt-bores__stat-info">
                        <span className="govt-bores__stat-value">{stats.mandals}</span>
                        <span className="govt-bores__stat-label">Mandals Covered</span>
                    </div>
                </div>
                <div className="govt-bores__stat-card">
                    <div className="govt-bores__stat-icon govt-bores__stat-icon--amount">
                        <IndianRupee size={20} />
                    </div>
                    <div className="govt-bores__stat-info">
                        <span className="govt-bores__stat-value">₹{stats.totalAmount.toLocaleString('en-IN')}</span>
                        <span className="govt-bores__stat-label">Total Work Value</span>
                    </div>
                </div>
                <div className="govt-bores__stat-card">
                    <div className="govt-bores__stat-icon govt-bores__stat-icon--paid">
                        <Droplets size={20} />
                    </div>
                    <div className="govt-bores__stat-info">
                        <span className="govt-bores__stat-value">{stats.billPaid}</span>
                        <span className="govt-bores__stat-label">Bills Paid</span>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="govt-bores__toolbar">
                <div className="govt-bores__search-wrap">
                    <Search size={18} className="govt-bores__search-icon" />
                    <input
                        type="text"
                        placeholder="Search by village, mandal, vehicle, location..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="govt-bores__search-input"
                    />
                </div>

                {/* Status Filter */}
                <div className="govt-bores__filter-wrap">
                    <Filter size={16} />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="govt-bores__filter-select"
                    >
                        <option value="">All Status</option>
                        <option value="Pending">Pending</option>
                        <option value="To be recording">To be recording</option>
                        <option value="Done">Done</option>
                        <option value="Completed">Completed</option>
                    </select>
                </div>

                <div className="govt-bores__toolbar-actions">
                    <button className="btn btn-secondary" onClick={handleExportExcel}>
                        <Download size={16} />
                        <span>Export Excel</span>
                    </button>
                    {isAdmin && (
                        <button className="btn btn-primary" onClick={handleAdd}>
                            <Plus size={18} />
                            <span>Add Record</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="govt-bores__table-wrap" ref={scrollContainerRef}>
                <table className="govt-bores__table">
                    <thead>
                        <tr>
                            <th className="govt-bores__th govt-bores__th--sticky-sno">S.No</th>
                            <th className="govt-bores__th" style={{ minWidth: '140px', width: '140px' }}>Mandal</th>
                            {DISPLAY_COLS.map((col) => (
                                <th key={col.key} className="govt-bores__th" style={{ minWidth: col.width, width: col.width, textAlign: col.align || 'left' }}>
                                    {col.label}
                                </th>
                            ))}
                            <th className="govt-bores__th govt-bores__th--actions-right" style={{ minWidth: '110px', width: '110px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={DISPLAY_COLS.length + 3} className="govt-bores__empty">
                                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                                    <p>Loading records...</p>
                                </td>
                            </tr>
                        ) : paginatedRecords.length === 0 ? (
                            <tr>
                                <td colSpan={DISPLAY_COLS.length + 3} className="govt-bores__empty">
                                    <Droplets size={40} strokeWidth={1} />
                                    <p>No records found</p>
                                    {isAdmin && (
                                        <button className="btn btn-primary" onClick={handleAdd}>
                                            <Plus size={16} /> Add First Record
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((rec, idx) => (
                                <tr key={rec.id || idx} className={idx % 2 === 1 ? 'govt-bores__row--alt' : ''}>
                                    <td className="govt-bores__td govt-bores__td--sticky-sno">
                                        {rec.sNo || (currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                                    </td>
                                    <td className="govt-bores__td" style={{ minWidth: '140px', width: '140px' }}>{rec.mandal?.name || '-'}</td>
                                    {DISPLAY_COLS.map((col) => (
                                        <td key={col.key} className="govt-bores__td" style={{ minWidth: col.width, width: col.width, textAlign: col.align || 'left' }}>
                                            {col.key === 'status' ? (
                                                <span className={getStatusBadgeClass(rec.status)}>
                                                    {rec.status || '-'}
                                                </span>
                                            ) : formatValue(col, getValue(rec, col.key))}
                                        </td>
                                    ))}
                                    <td className="govt-bores__td govt-bores__td--actions-right" style={{ minWidth: '110px', width: '110px' }}>
                                        <div className="govt-bores__action-btns">
                                            {!isAdmin ? (
                                                <button
                                                    className="govt-bores__action-btn govt-bores__action-btn--view"
                                                    onClick={() => handleView(rec)}
                                                    title="View Details"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            ) : (
                                                <>
                                                    {rec.status === 'Completed' ? (
                                                        <button
                                                            className="govt-bores__action-btn govt-bores__action-btn--view"
                                                            onClick={() => handleView(rec)}
                                                            title="View Details"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                    ) : (
                                                        <>
                                                            <button
                                                                className="govt-bores__action-btn govt-bores__action-btn--edit"
                                                                onClick={() => handleEdit(rec)}
                                                                title="Edit"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button
                                                                className="govt-bores__action-btn govt-bores__action-btn--delete"
                                                                onClick={() => handleDelete(rec)}
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="govt-bores__pagination">
                    <span className="govt-bores__pagination-info">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of{' '}
                        {filteredRecords.length} records
                    </span>
                    <div className="govt-bores__pagination-controls">
                        <button
                            className="govt-bores__page-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => p - 1)}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                            .map((page, idx, arr) => (
                                <>
                                    {idx > 0 && arr[idx - 1] !== page - 1 && (
                                        <span key={`ellipsis-${page}`} className="govt-bores__page-ellipsis">...</span>
                                    )}
                                    <button
                                        key={page}
                                        className={`govt-bores__page-btn ${page === currentPage ? 'govt-bores__page-btn--active' : ''}`}
                                        onClick={() => setCurrentPage(page)}
                                    >
                                        {page}
                                    </button>
                                </>
                            ))}
                        <button
                            className="govt-bores__page-btn"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => p + 1)}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {isModalOpen && (
                <BorewellForm
                    key={selectedRecord ? selectedRecord.id : 'new'}
                    record={selectedRecord}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    saving={saving}
                    viewMode={viewMode}
                />
            )}
        </div>
    );
}
