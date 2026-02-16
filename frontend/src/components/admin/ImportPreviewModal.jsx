import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';

// All available columns that map to the database
const APP_COLUMNS = [
    { key: 's_no', label: 'S.No' },
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'date', label: 'Work Date' },
    { key: 'received_date', label: 'Received Date' },
    { key: 'platform_date', label: 'Platform Date' },
    { key: 'material_date', label: 'Material Date' },
    { key: 'village', label: 'Village' },
    { key: 'location', label: 'Location' },
    { key: 'grant_name', label: 'Grant' },
    { key: 'estCost', label: 'Est Cost' },

    // Drilling
    { key: 'drilling_depth_mtrs', label: 'Drill Depth' },
    { key: 'drilling_rate', label: 'Drill Rate' },
    { key: 'drilling_amount', label: 'Drill Amt' },

    // Casing
    { key: 'casing_type', label: 'Casing Type' },
    { key: 'casing180_qty', label: '180mm Qty' },
    { key: 'casing180_rate', label: '180mm Rate' },
    { key: 'casing180_amount', label: '180mm Amt' },
    { key: 'casing140_qty', label: '140mm Qty' },
    { key: 'casing140_rate', label: '140mm Rate' },
    { key: 'casing140_amount', label: '140mm Amt' },
    { key: 'casing250_qty', label: '250mm Qty' },
    { key: 'casing250_rate', label: '250mm Rate' },
    { key: 'casing250_amount', label: '250mm Amt' },

    // Materials
    { key: 'slotting_qty', label: 'Slot Qty' }, { key: 'slotting_rate', label: 'Slot Rate' }, { key: 'slotting_amount', label: 'Slot Amt' },
    { key: 'pumpset_qty', label: 'Pump Qty' }, { key: 'pumpset_rate', label: 'Pump Rate' }, { key: 'pumpset_amount', label: 'Pump Amt' },
    { key: 'cylinders_qty', label: 'Cyl Qty' }, { key: 'cylinders_rate', label: 'Cyl Rate' }, { key: 'cylinders_amount', label: 'Cyl Amt' },
    { key: 'stand_qty', label: 'Stand Qty' }, { key: 'stand_rate', label: 'Stand Rate' }, { key: 'stand_amount', label: 'Stand Amt' },
    { key: 'head_handle_qty', label: 'Head Qty' }, { key: 'head_handle_rate', label: 'Head Rate' }, { key: 'head_handle_amount', label: 'Head Amt' },

    // Pipes & Labour
    { key: 'pipe_company', label: 'Pipe Co' }, { key: 'gi_pipes_qty', label: 'GI Qty' }, { key: 'gi_pipes_rate', label: 'GI Rate' }, { key: 'gi_pipes_amount', label: 'GI Amt' },
    { key: 'labour_type', label: 'Labour Type' }, { key: 'labour_amount', label: 'Labour Amt' },

    // Other
    { key: 'plotfarm_qty', label: 'Plot Qty' }, { key: 'plotfarm_rate', label: 'Plot Rate' }, { key: 'plotfarm_amount', label: 'Plot Amt' },
    { key: 'erection_qty', label: 'Erection Qty' }, { key: 'erection_rate', label: 'Erection Rate' }, { key: 'erection_amount', label: 'Erection Amt' },
    { key: 'borecap_qty', label: 'Cap Qty' }, { key: 'borecap_rate', label: 'Cap Rate' }, { key: 'borecap_amount', label: 'Cap Amt' },
    { key: 'pcs', label: 'PCs' },

    // Financials
    { key: 'gross_amount', label: 'Gross Amt' },
    { key: 'total_bill_amount', label: 'Bill Amt (TVW)' },
    { key: 'first_part_amount', label: '1st Part' },
    { key: 'second_part_amount', label: '2nd Part' },

    // Taxes
    { key: 'cgst_amt', label: 'CGST' }, { key: 'sgst_amt', label: 'SGST' }, { key: 'igst_amt', label: 'IGST' },
    { key: 'gst_amt', label: 'GST' }, { key: 'sas_amt', label: 'SAS' },
    { key: 'it_amount', label: 'IT' }, { key: 'vat_amount', label: 'VAT' },
    { key: 'total_recoveries', label: 'Recoveries' },

    // Payment
    { key: 'status', label: 'Status' },
    { key: 'net_amount', label: 'Net Amount' },
    { key: 'bank_name', label: 'Bank' },
    { key: 'cheque_no', label: 'Cheque No' },
    { key: 'cheque_date', label: 'Cheque Date' },
    { key: 'voucher_no', label: 'Voucher' },
    { key: 'mBookNo', label: 'M Book No' },
];

// Common aliases for fuzzy matching
const ALIASES = {
    'date': 'bore_date',
    'bore date': 'bore_date',
    'grant': 'grant_name',
    'grant name': 'grant_name',
    's.no': 's_no',
    'sno': 's_no',
    'sl.no': 's_no',
    'sl no': 's_no',
    'serial': 's_no',
    'serial no': 's_no',
    'serial number': 's_no',
    'drilling depth': 'drill_depth',
    'drilling rate': 'drill_rate',
    'drilling amount': 'drill_amt',
    'drilling amt': 'drill_amt',
    'casing 180mm depth': 'cas180_depth',
    'casing 180 depth': 'cas180_depth',
    '180 depth': 'cas180_depth',
    'casing 180mm rate': 'cas180_rate',
    'casing 180 rate': 'cas180_rate',
    '180 rate': 'cas180_rate',
    'casing 180mm amt': 'cas180_amt',
    'casing 180 amt': 'cas180_amt',
    '180 amt': 'cas180_amt',
    '180mm amount': 'cas180_amt',
    'casing 140mm depth': 'cas140_depth',
    'casing 140 depth': 'cas140_depth',
    '140 depth': 'cas140_depth',
    'casing 140mm rate': 'cas140_rate',
    'casing 140 rate': 'cas140_rate',
    '140 rate': 'cas140_rate',
    'casing 140mm amt': 'cas140_amt',
    'casing 140 amt': 'cas140_amt',
    '140 amt': 'cas140_amt',
    '140mm amount': 'cas140_amt',
    'slotting qty': 'slot_qty',
    'slotting quantity': 'slot_qty',
    'slot quantity': 'slot_qty',
    'slotting rate': 'slot_rate',
    'slotting amt': 'slot_amt',
    'slotting amount': 'slot_amt',
    'slot amount': 'slot_amt',
    'pump set rate': 'pump_rate',
    'pump set': 'pump_rate',
    'gi pipes qty': 'gi_qty',
    'gi pipes quantity': 'gi_qty',
    'gi quantity': 'gi_qty',
    'gi pipes rate': 'gi_rate',
    'gi pipes amt': 'gi_amt',
    'gi pipes amount': 'gi_amt',
    'gi amount': 'gi_amt',
    'plot farm': 'plot_farm_rate',
    'plot farm rate': 'plot_farm_rate',
    'erection': 'erection_rate',
    'bore cap': 'bore_cap_rate',
    'total amount': 'total_amt',
    'total': 'total_amt',
    'm book': 'm_book_no',
    'm book no': 'm_book_no',
    'mbook': 'm_book_no',
    'book no': 'm_book_no',
    'bill amt': 'total_bill_amt',
    'bill amount': 'total_bill_amt',
    'total bill': 'total_bill_amt',
    'total bill amt': 'total_bill_amt',
    'total bill amount': 'total_bill_amt',
    'tvw': 'total_bill_amt',
    '1st part': 'first_part',
    'first part': 'first_part',
    '2nd part': 'second_part',
    'second part': 'second_part',
    'it (2.3%)': 'it',
    'income tax': 'it',
    'vat (5%)': 'vat',
    'recoveries': 'total_recoveries',
    'total recoveries': 'total_recoveries',
    'net amount': 'net_amount',
    'net amt': 'net_amount',
    'net': 'net_amount',
    'voucher': 'voucher_no',
    'voucher no': 'voucher_no',
    'voucher number': 'voucher_no',
    'cheque': 'cheque_no_date',
    'cheque no': 'cheque_no_date',
    'cheque no & date': 'cheque_no_date',
    'cheque number': 'cheque_no_date',
    'cheque no date': 'cheque_no_date',
    'estimated cost': 'est_cost',
    'est. cost': 'est_cost',
};

/**
 * Try to match a file header string to an APP_COLUMNS key
 */
function autoMatchHeader(header) {
    const h = header.toLowerCase().trim();

    // 1. Exact match on label
    const exactLabel = APP_COLUMNS.find(c => c.label.toLowerCase() === h);
    if (exactLabel) return exactLabel.key;

    // 2. Exact match on key
    const exactKey = APP_COLUMNS.find(c => c.key.toLowerCase() === h);
    if (exactKey) return exactKey.key;

    // 3. Match from aliases
    if (ALIASES[h]) return ALIASES[h];

    // 4. Fuzzy: key with underscores replaced by spaces
    const fuzzyKey = APP_COLUMNS.find(c => c.key.replace(/_/g, ' ').toLowerCase() === h);
    if (fuzzyKey) return fuzzyKey.key;

    // 5. Partial: check if header contains a label or vice versa
    const partial = APP_COLUMNS.find(c =>
        h.includes(c.label.toLowerCase()) || c.label.toLowerCase().includes(h)
    );
    if (partial && h.length >= 2) return partial.key;

    return ''; // Skip
}

export default function ImportPreviewModal({ isOpen, onClose, importData, onImport, importing }) {
    const [columnMapping, setColumnMapping] = useState({});

    // Auto-match columns when import data changes
    useEffect(() => {
        if (!importData?.headers) return;
        const mapping = {};
        const usedKeys = new Set();

        importData.headers.forEach((header, index) => {
            const matched = autoMatchHeader(header);
            if (matched && !usedKeys.has(matched)) {
                mapping[index] = matched;
                usedKeys.add(matched);
            } else {
                mapping[index] = '';
            }
        });

        setColumnMapping(mapping);
    }, [importData]);

    const handleMappingChange = (fileIndex, appKey) => {
        setColumnMapping(prev => {
            const newMapping = { ...prev };
            // If this app column was already mapped elsewhere, clear the old one
            if (appKey) {
                Object.keys(newMapping).forEach(k => {
                    if (newMapping[k] === appKey && parseInt(k) !== fileIndex) {
                        newMapping[k] = '';
                    }
                });
            }
            newMapping[fileIndex] = appKey;
            return newMapping;
        });
    };

    const mappedCount = useMemo(() =>
        Object.values(columnMapping).filter(v => v).length
        , [columnMapping]);

    const handleImport = () => {
        if (!importData?.allRows) return;

        // Build mapped records
        const records = importData.allRows.map(row => {
            const record = {};
            Object.entries(columnMapping).forEach(([fileIndex, appKey]) => {
                if (appKey) {
                    const val = row[parseInt(fileIndex)];
                    record[appKey] = (val !== undefined && val !== null && val !== '') ? val : null;
                }
            });
            return record;
        });

        // Filter out completely empty records
        const validRecords = records.filter(r =>
            Object.values(r).some(v => v !== null && v !== undefined && v !== '')
        );

        onImport(validRecords);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="import-modal-overlay" onClick={onClose}>
            <div className="import-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="import-modal__header">
                    <div className="import-modal__header-left">
                        <FileSpreadsheet size={20} />
                        <h3>Import Data</h3>
                    </div>
                    <button className="import-modal__close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* File Info */}
                <div className="import-modal__info">
                    <div className="import-modal__info-item">
                        <span className="import-modal__info-label">Total Rows:</span>
                        <span className="import-modal__info-value">{importData?.totalRows || 0}</span>
                    </div>
                    <div className="import-modal__info-item">
                        <span className="import-modal__info-label">Detected Columns:</span>
                        <span className="import-modal__info-value">{importData?.headers?.length || 0}</span>
                    </div>
                    <div className="import-modal__info-item">
                        <span className="import-modal__info-label">Mapped:</span>
                        <span className="import-modal__info-value import-modal__info-value--mapped">
                            {mappedCount} / {importData?.headers?.length || 0}
                        </span>
                    </div>
                </div>

                {/* Column Mapping */}
                <div className="import-modal__section">
                    <h4 className="import-modal__section-title">
                        <span>Column Mapping</span>
                        <span className="import-modal__section-hint">Map your file columns to app fields. Unmapped columns will be skipped (shown as -).</span>
                    </h4>
                    <div className="import-modal__mapping-list">
                        {importData?.headers?.map((header, index) => (
                            <div key={index} className="import-modal__mapping-row">
                                <div className="import-modal__mapping-file-col">
                                    <span className="import-modal__mapping-index">{index + 1}</span>
                                    <span className="import-modal__mapping-header" title={header}>{header}</span>
                                </div>
                                <span className="import-modal__mapping-arrow">→</span>
                                <select
                                    className={`import-modal__mapping-select ${columnMapping[index] ? 'import-modal__mapping-select--matched' : ''}`}
                                    value={columnMapping[index] || ''}
                                    onChange={e => handleMappingChange(index, e.target.value)}
                                >
                                    <option value="">— Skip this column —</option>
                                    {APP_COLUMNS.map(col => (
                                        <option
                                            key={col.key}
                                            value={col.key}
                                            disabled={Object.values(columnMapping).includes(col.key) && columnMapping[index] !== col.key}
                                        >
                                            {col.label} ({col.key})
                                        </option>
                                    ))}
                                </select>
                                {columnMapping[index] ? (
                                    <CheckCircle2 size={16} className="import-modal__mapping-icon import-modal__mapping-icon--ok" />
                                ) : (
                                    <AlertCircle size={16} className="import-modal__mapping-icon import-modal__mapping-icon--skip" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Preview Table */}
                <div className="import-modal__section">
                    <h4 className="import-modal__section-title">
                        <span>Data Preview</span>
                        <span className="import-modal__section-hint">First {Math.min(5, importData?.previewRows?.length || 0)} rows</span>
                    </h4>
                    <div className="import-modal__preview-wrap">
                        <table className="import-modal__preview-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    {importData?.headers?.map((header, i) => (
                                        <th key={i} className={columnMapping[i] ? '' : 'import-modal__preview-th--skipped'}>
                                            {columnMapping[i]
                                                ? APP_COLUMNS.find(c => c.key === columnMapping[i])?.label || header
                                                : <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{header}</span>
                                            }
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {importData?.previewRows?.map((row, ri) => (
                                    <tr key={ri}>
                                        <td>{ri + 1}</td>
                                        {row.map((cell, ci) => (
                                            <td
                                                key={ci}
                                                className={columnMapping[ci] ? '' : 'import-modal__preview-td--skipped'}
                                            >
                                                {cell || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="import-modal__footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={importing}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleImport}
                        disabled={importing || mappedCount === 0}
                    >
                        {importing ? (
                            <>
                                <div className="spinner spinner--sm"></div>
                                <span>Importing...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={16} />
                                <span>Import {importData?.totalRows || 0} Records</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
