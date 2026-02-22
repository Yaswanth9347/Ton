import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Search, Plus, Download, Upload,
    Droplets, ChevronLeft, ChevronRight,
    IndianRupee, Layers, TrendingUp,
    Edit2, Trash2, FileDown
} from 'lucide-react';
import BoreModal from '../components/admin/BoreModal';
import { boreApi } from '../services/api';
import toast from 'react-hot-toast';

// Column definitions for the table
const DISPLAY_COLS = [
    { key: 'date', label: 'Date', width: '110px', type: 'date', align: 'center' },
    { key: 'customer_name', label: 'Customer', width: '180px' },
    { key: 'village', label: 'Village', width: '140px' },
    { key: 'vehicle_name', label: 'Vehicle', width: '120px' },
    { key: 'supervisor_name', label: 'Supervisor', width: '150px' },
    { key: 'bore_type', label: 'Type', width: '80px', align: 'center' },
    // Drilling Details
    { key: 'drill_upto_casing_feet', label: 'Upto Cas (Ft)', width: '100px', type: 'number', align: 'center' },
    { key: 'drill_upto_casing_rate', label: 'Upto Cas (Rate)', width: '100px', type: 'number', align: 'center' },
    { key: 'empty_drilling_feet', label: 'Empty (Ft)', width: '100px', type: 'number', align: 'center' },
    { key: 'empty_drilling_rate', label: 'Empty (Rate)', width: '100px', type: 'number', align: 'center' },
    { key: 'jump_300_feet', label: 'J-300 (Ft)', width: '90px', type: 'number', align: 'center' },
    { key: 'jump_300_rate', label: 'J-300 (Rate)', width: '90px', type: 'number', align: 'center' },
    { key: 'jump_400_feet', label: 'J-400 (Ft)', width: '90px', type: 'number', align: 'center' },
    { key: 'jump_400_rate', label: 'J-400 (Rate)', width: '90px', type: 'number', align: 'center' },
    { key: 'total_drilling_feet', label: 'Total Feet', width: '90px', type: 'number', align: 'center' },
    { key: 'total_drilling_amt', label: 'Drill Amt', width: '110px', type: 'currency', align: 'right' },
    // Casing Details
    { key: 'cas140_feet', label: 'Cas140 (Ft)', width: '90px', type: 'number', align: 'center' },
    { key: 'cas140_rate', label: 'Cas140 (Rate)', width: '90px', type: 'number', align: 'center' },
    { key: 'cas180_4g_feet', label: '180-4G (Ft)', width: '100px', type: 'number', align: 'center' },
    { key: 'cas180_4g_rate', label: '180-4G (Rate)', width: '100px', type: 'number', align: 'center' },
    { key: 'cas180_6g_feet', label: '180-6G (Ft)', width: '100px', type: 'number', align: 'center' },
    { key: 'cas180_6g_rate', label: '180-6G (Rate)', width: '100px', type: 'number', align: 'center' },
    { key: 'cas250_4g_feet', label: '250-4G (Ft)', width: '100px', type: 'number', align: 'center' },
    { key: 'cas250_4g_rate', label: '250-4G (Rate)', width: '100px', type: 'number', align: 'center' },
    // Slotting & Labour
    { key: 'slotting_pipes', label: 'Slot Pipes', width: '100px', type: 'number', align: 'center' },
    { key: 'slotting_rate', label: 'Slot Rate', width: '100px', type: 'number', align: 'center' },
    { key: 'labour_charge', label: 'Labour', width: '100px', type: 'currency', align: 'right' },
    { key: 'rpm', label: 'RPM', width: '80px', type: 'number', align: 'center' },
    // Totals & Payments
    { key: 'total_amount', label: 'Total (₹)', width: '120px', type: 'currency', align: 'right' },
    { key: 'discount', label: 'Discount', width: '100px', type: 'currency', align: 'right' },
    { key: 'amount_paid', label: 'Paid (₹)', width: '130px', type: 'currency', align: 'center' },
    { key: 'balance', label: 'Balance (₹)', width: '130px', type: 'currency', align: 'center' },
    { key: 'status', label: 'Status', width: '110px', align: 'center' },
];

const ITEMS_PER_PAGE = 25;

export default function BoresPage() {
    const { isAdmin, isSupervisor } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [saving, setSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const scrollContainerRef = useRef(null);
    const [viewMode, setViewMode] = useState(false);

    // Fetch records
    const fetchRecords = useCallback(async () => {
        try {
            setLoading(true);
            const res = await boreApi.getAll();
            setRecords(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch bore records:', err);
            toast.error('Failed to load records');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    // Drag-to-scroll for wide table
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        let isDown = false;
        let startX, startY, scrollLeft, scrollTop;

        const onMouseDown = (e) => {
            if (e.target.closest('button')) return;
            isDown = true;
            container.style.cursor = 'grabbing';
            startX = e.pageX - container.offsetLeft;
            startY = e.pageY - container.offsetTop;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
        };

        const onMouseLeave = () => { isDown = false; container.style.cursor = 'grab'; };
        const onMouseUp = () => { isDown = false; container.style.cursor = 'grab'; };

        const onMouseMove = (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const y = e.pageY - container.offsetTop;
            container.scrollLeft = scrollLeft - (x - startX) * 1.5;
            container.scrollTop = scrollTop - (y - startY) * 1.5;
        };

        const onWheel = (e) => {
            if (e.shiftKey) {
                container.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        };

        container.style.cursor = 'grab';
        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('mouseleave', onMouseLeave);
        container.addEventListener('mouseup', onMouseUp);
        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('mouseleave', onMouseLeave);
            container.removeEventListener('mouseup', onMouseUp);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('wheel', onWheel);
        };
    }, []);

    // Format date for display
    const formatDate = (val) => {
        if (!val) return '-';
        try {
            return new Date(val).toLocaleDateString('en-GB');
        } catch {
            return val;
        }
    };

    // Format value for display
    const formatValue = (col, val) => {
        if (val === null || val === undefined || val === '') return '-';
        if (col.type === 'date') return formatDate(val);
        if (col.type === 'currency') return `₹${parseFloat(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        if (col.type === 'number') return parseFloat(val).toLocaleString('en-IN');
        return val;
    };

    // Filter records based on search
    const filteredRecords = useMemo(() => {
        let result = records.map(rec => {
            const balance = parseFloat(rec.balance) || 0;
            return {
                ...rec,
                status: balance > 0 ? 'Pending' : 'Completed'
            };
        });

        if (!search.trim()) return result;
        const term = search.toLowerCase();
        return result.filter((rec) =>
            (rec.customer_name && rec.customer_name.toLowerCase().includes(term)) ||
            (rec.village && rec.village.toLowerCase().includes(term)) ||
            (rec.supervisor_name && rec.supervisor_name.toLowerCase().includes(term)) ||
            (rec.vehicle_name && rec.vehicle_name.toLowerCase().includes(term)) ||
            (rec.bore_type && rec.bore_type.toLowerCase().includes(term))
        );
    }, [records, search]);

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredRecords, currentPage]);

    // Reset page on search change
    useEffect(() => { setCurrentPage(1); }, [search]);

    // Summary stats
    const stats = useMemo(() => {
        const total = records.length;
        const totalFeet = records.reduce((sum, r) => sum + (parseFloat(r.total_drilling_feet) || 0), 0);
        const totalAmount = records.reduce((sum, r) => sum + (parseFloat(r.total_amount) || 0), 0);
        const totalPaid = records.reduce((sum, r) => sum + (parseFloat(r.amount_paid) || 0), 0);
        const totalBalance = records.reduce((sum, r) => sum + (parseFloat(r.balance) || 0), 0);
        return { total, totalFeet, totalAmount, totalPaid, totalBalance };
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
        if (!window.confirm(`Delete entry for "${record.customer_name}"?`)) return;
        try {
            await boreApi.delete(record.id);
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
                await boreApi.update(selectedRecord.id, formData);
                toast.success('Record updated');
            } else {
                await boreApi.create(formData);
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

    const handleDownloadReceipt = (record) => {
        const url = boreApi.getReceiptUrl(record.id);
        window.open(url, '_blank');
    };

    const handleExportCSV = () => {
        try {
            const headers = ['#', ...DISPLAY_COLS.map((c) => c.label)];
            const rows = filteredRecords.map((rec, i) => [
                i + 1,
                ...DISPLAY_COLS.map((c) => rec[c.key] ?? ''),
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Bores_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            toast.success('CSV exported successfully');
        } catch {
            toast.error('Failed to export CSV');
        }
    };

    const handleImportCSV = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const text = ev.target.result;
                const lines = text.split('\n').filter(l => l.trim());
                if (lines.length < 2) { toast.error('CSV is empty'); return; }
                const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
                let imported = 0;
                for (let i = 1; i < lines.length; i++) {
                    const vals = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
                    const row = {};
                    headers.forEach((h, idx) => {
                        const col = DISPLAY_COLS.find(c => c.label.toLowerCase() === h.toLowerCase());
                        if (col) row[col.key] = vals[idx] || null;
                    });
                    if (Object.keys(row).length > 0) {
                        await boreApi.create(row);
                        imported++;
                    }
                }
                toast.success(`Imported ${imported} records`);
                fetchRecords();
            } catch {
                toast.error('Failed to import CSV');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="bores">
            {/* Summary Cards */}
            <div className="bores__stats">
                <div className="bores__stat-card">
                    <div className="bores__stat-icon bores__stat-icon--total">
                        <Layers size={20} />
                    </div>
                    <div className="bores__stat-info">
                        <span className="bores__stat-value">{stats.total}</span>
                        <span className="bores__stat-label">Total Entries</span>
                    </div>
                </div>
                <div className="bores__stat-card">
                    <div className="bores__stat-icon bores__stat-icon--feet">
                        <Droplets size={20} />
                    </div>
                    <div className="bores__stat-info">
                        <span className="bores__stat-value">{stats.totalFeet.toLocaleString('en-IN')}</span>
                        <span className="bores__stat-label">Total Feet</span>
                    </div>
                </div>
                <div className="bores__stat-card">
                    <div className="bores__stat-icon bores__stat-icon--amount">
                        <IndianRupee size={20} />
                    </div>
                    <div className="bores__stat-info">
                        <span className="bores__stat-value">₹{stats.totalAmount.toLocaleString('en-IN')}</span>
                        <span className="bores__stat-label">Total Amount</span>
                    </div>
                </div>
                <div className="bores__stat-card">
                    <div className="bores__stat-icon bores__stat-icon--profit">
                        <TrendingUp size={20} />
                    </div>
                    <div className="bores__stat-info">
                        <span className="bores__stat-value">₹{stats.totalPaid.toLocaleString('en-IN')}</span>
                        <span className="bores__stat-label">Total Paid</span>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bores__toolbar">
                <div className="bores__search-wrap">
                    <Search size={18} className="bores__search-icon" />
                    <input
                        type="text"
                        placeholder="Search by customer, village, supervisor, vehicle..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bores__search-input"
                    />
                </div>
                <div className="bores__toolbar-actions">
                    <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                        <Upload size={16} />
                        <span>Import CSV</span>
                        <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
                    </label>
                    <button className="btn btn-secondary" onClick={handleExportCSV}>
                        <Download size={16} />
                        <span>Export CSV</span>
                    </button>
                    {isAdmin && (
                        <button className="btn btn-primary" onClick={handleAdd}>
                            <Plus size={18} />
                            <span>Add Entry</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bores__table-wrap" ref={scrollContainerRef}>
                <table className="bores__table">
                    <thead>
                        <tr>
                            <th className="bores__th bores__th--sticky-sno" style={{ minWidth: '80px', width: '80px', textAlign: 'center' }}>#</th>
                            {DISPLAY_COLS.map((col) => (
                                <th key={col.key} className="bores__th" style={{ minWidth: col.width, width: col.width, textAlign: col.align || 'left' }}>
                                    {col.label}
                                </th>
                            ))}
                            <th className="bores__th bores__th--actions-right" style={{ minWidth: '160px', width: '160px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={DISPLAY_COLS.length + 2} className="bores__empty">
                                    <div className="spinner" style={{ margin: '0 auto' }}></div>
                                    <p>Loading records...</p>
                                </td>
                            </tr>
                        ) : paginatedRecords.length === 0 ? (
                            <tr>
                                <td colSpan={DISPLAY_COLS.length + 2} className="bores__empty">
                                    <div className="bores__empty-content">
                                        <Droplets size={40} strokeWidth={1} />
                                        <p>{search ? 'No records match your search' : 'No bore entries yet'}</p>
                                        {!search && isAdmin && (
                                            <button className="btn btn-primary" onClick={handleAdd}>
                                                Add First Entry
                                            </button>
                                        )}
                                        {search && (
                                            <button className="btn btn-secondary" onClick={() => setSearch('')}>
                                                Clear Search
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            paginatedRecords.map((rec, idx) => (
                                <tr key={rec.id} className={idx % 2 === 1 ? 'bores__row--alt' : ''}>
                                    <td className="bores__td bores__td--sticky-sno" style={{ minWidth: '80px', width: '80px', textAlign: 'center' }}>
                                        {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                                    </td>
                                    {DISPLAY_COLS.map((col) => {
                                        let cellContent = formatValue(col, rec[col.key]);
                                        let cellClass = `bores__td ${col.key === 'profit' ? 'bores__td--profit' : ''}`;

                                        if (col.key === 'amount_paid') {
                                            cellContent = <span className="bores__badge bores__badge--paid">{cellContent}</span>;
                                        } else if (col.key === 'balance') {
                                            cellContent = <span className={`bores__badge ${parseFloat(rec.balance) > 0 ? 'bores__badge--pending' : 'bores__badge--paid'}`}>{cellContent}</span>;
                                        } else if (col.key === 'status') {
                                            cellContent = <span className={`bores__status-tag ${rec.status === 'Pending' ? 'bores__status-tag--pending' : 'bores__status-tag--completed'}`}>{rec.status}</span>;
                                        }

                                        return (
                                            <td key={col.key} className={cellClass} style={{ minWidth: col.width, width: col.width, textAlign: col.align || 'left' }}>
                                                {cellContent}
                                            </td>
                                        );
                                    })}
                                    <td className="bores__td bores__td--actions-right" style={{ minWidth: '160px', width: '160px' }}>
                                        <div className="bores__action-btns">
                                            {(isAdmin || isSupervisor) && (
                                                <button
                                                    className="bores__action-btn bores__action-btn--download"
                                                    onClick={() => handleDownloadReceipt(rec)}
                                                    title="Download Receipt"
                                                >
                                                    <FileDown size={18} />
                                                </button>
                                            )}
                                            {isAdmin ? (
                                                <>
                                                    <button
                                                        className="bores__action-btn bores__action-btn--edit"
                                                        onClick={() => handleEdit(rec)}
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        className="bores__action-btn bores__action-btn--delete"
                                                        onClick={() => handleDelete(rec)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    className="bores__action-btn bores__action-btn--view"
                                                    onClick={() => handleView(rec)}
                                                    title="View Details"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
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
                <div className="bores__pagination">
                    <span className="bores__pagination-info">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)} of{' '}
                        {filteredRecords.length} records
                    </span>
                    <div className="bores__pagination-controls">
                        <button
                            className="bores__page-btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => p - 1)}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                            .map((page, i, arr) => (
                                <span key={page}>
                                    {i > 0 && arr[i - 1] !== page - 1 && (
                                        <span className="bores__page-ellipsis">…</span>
                                    )}
                                    <button
                                        className={`bores__page-btn ${page === currentPage ? 'bores__page-btn--active' : ''}`}
                                        onClick={() => setCurrentPage(page)}
                                    >
                                        {page}
                                    </button>
                                </span>
                            ))}
                        <button
                            className="bores__page-btn"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => p + 1)}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Modal */}
            <BoreModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                record={selectedRecord}
                onSave={handleSave}
                saving={saving}
                viewMode={viewMode}
            />
        </div>
    );
}
