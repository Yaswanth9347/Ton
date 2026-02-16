import { useState, useRef } from 'react';
import { adminApi } from '../../services/api';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { toast } from 'react-hot-toast';

export function BulkUploadModal({ isOpen, onClose, onSuccess }) {
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState(null);
    const [results, setResults] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            toast.error('Please select a CSV file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            const records = parseCSV(text);
            setPreview(records);
            setResults(null);
        };
        reader.readAsText(file);
    };

    const parseCSV = (text) => {
        const lines = text.trim().split('\n');
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const records = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
            const record = {};
            
            headers.forEach((header, index) => {
                // Map common header variations
                const key = mapHeader(header);
                if (key) {
                    record[key] = values[index] || '';
                }
            });

            if (record.username && record.date) {
                records.push(record);
            }
        }

        return records;
    };

    const mapHeader = (header) => {
        const mapping = {
            'username': 'username',
            'user': 'username',
            'employee': 'username',
            'date': 'date',
            'attendance_date': 'date',
            'check_in': 'checkIn',
            'checkin': 'checkIn',
            'in_time': 'checkIn',
            'check_out': 'checkOut',
            'checkout': 'checkOut',
            'out_time': 'checkOut',
            'status': 'status'
        };
        return mapping[header] || null;
    };

    const handleUpload = async () => {
        if (!preview || preview.length === 0) {
            toast.error('No valid records to upload');
            return;
        }

        setLoading(true);
        try {
            const response = await adminApi.bulkUploadAttendance(preview);
            setResults(response.data.data);
            toast.success(response.data.message);
            if (response.data.data.failed === 0) {
                onSuccess?.();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Upload failed');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setPreview(null);
        setResults(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        onClose();
    };

    const downloadTemplate = () => {
        const template = 'username,date,check_in,check_out,status\njohndoe,2026-01-09,09:00,18:00,present\njanedoe,2026-01-09,09:30,17:30,present';
        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'attendance_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Upload Attendance">
            <div className="bulk-upload-container">
                {/* Instructions */}
                <div className="upload-instructions">
                    <h4>📋 CSV Format Requirements:</h4>
                    <ul>
                        <li><strong>username</strong> - Employee username (required)</li>
                        <li><strong>date</strong> - Date in YYYY-MM-DD format (required)</li>
                        <li><strong>check_in</strong> - Check-in time in HH:MM format</li>
                        <li><strong>check_out</strong> - Check-out time in HH:MM format</li>
                        <li><strong>status</strong> - present, absent, half_day, late</li>
                    </ul>
                    <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                        📥 Download Template
                    </Button>
                </div>

                {/* File Input */}
                <div className="upload-area">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".csv"
                        onChange={handleFileSelect}
                        className="file-input"
                        id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="upload-label">
                        <span className="upload-icon">📄</span>
                        <span>Click to select CSV file or drag & drop</span>
                    </label>
                </div>

                {/* Preview */}
                {preview && preview.length > 0 && (
                    <div className="upload-preview">
                        <h4>Preview ({preview.length} records)</h4>
                        <div className="preview-table-container">
                            <table className="preview-table">
                                <thead>
                                    <tr>
                                        <th>Username</th>
                                        <th>Date</th>
                                        <th>Check In</th>
                                        <th>Check Out</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.slice(0, 5).map((record, index) => (
                                        <tr key={index}>
                                            <td>{record.username}</td>
                                            <td>{record.date}</td>
                                            <td>{record.checkIn || '-'}</td>
                                            <td>{record.checkOut || '-'}</td>
                                            <td>{record.status || 'present'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {preview.length > 5 && (
                                <p className="text-muted">...and {preview.length - 5} more records</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="upload-results">
                        <div className={`result-summary ${results.failed > 0 ? 'has-errors' : 'success'}`}>
                            <p>✅ Successful: <strong>{results.success}</strong></p>
                            <p>❌ Failed: <strong>{results.failed}</strong></p>
                        </div>
                        {results.errors && results.errors.length > 0 && (
                            <div className="result-errors">
                                <h5>Errors:</h5>
                                <ul>
                                    {results.errors.slice(0, 5).map((err, index) => (
                                        <li key={index}>
                                            <strong>{err.row?.username || 'Unknown'}</strong>: {err.error}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="upload-actions">
                    <Button variant="secondary" onClick={handleClose}>Cancel</Button>
                    <Button 
                        variant="primary" 
                        onClick={handleUpload}
                        loading={loading}
                        disabled={!preview || preview.length === 0}
                    >
                        📤 Upload {preview?.length || 0} Records
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
