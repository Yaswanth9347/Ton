import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatDate } from '../../utils/formatters';
import { formatForDateTimeLocalInput, toISTSqlTimestamp } from '../../utils/dateTime';

export function AttendanceEditModal({
    isOpen,
    onClose,
    attendance,
    onSubmit,
    loading = false,
    error = null
}) {
    const [formData, setFormData] = useState({
        checkIn: '',
        checkOut: '',
    });

    useEffect(() => {
        if (attendance) {
            setFormData({
                checkIn: formatForDateTimeLocalInput(attendance.checkIn),
                checkOut: formatForDateTimeLocalInput(attendance.checkOut),
            });
        }
    }, [attendance]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            checkIn: toISTSqlTimestamp(formData.checkIn),
            checkOut: toISTSqlTimestamp(formData.checkOut),
        });
    };

    if (!attendance) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Correct Attendance"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSubmit} loading={loading}>
                        Save Changes
                    </Button>
                </>
            }
        >
            <form onSubmit={handleSubmit}>
                {error && (
                    <div className="alert alert-error">
                        {error}
                    </div>
                )}

                <div className="mb-4">
                    <strong>Employee:</strong> {attendance.employeeName}
                    <br />
                    <strong>Date:</strong> {formatDate(attendance.date)}
                </div>

                <div className="form-group">
                    <label htmlFor="checkIn" className="form-label">Check In Time</label>
                    <input
                        id="checkIn"
                        name="checkIn"
                        type="datetime-local"
                        className="form-input"
                        value={formData.checkIn}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="checkOut" className="form-label">Check Out Time</label>
                    <input
                        id="checkOut"
                        name="checkOut"
                        type="datetime-local"
                        className="form-input"
                        value={formData.checkOut}
                        onChange={handleChange}
                    />
                </div>

                <div className="alert alert-error" style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e' }}>
                    <strong>Note:</strong> All corrections are logged in the audit trail for accountability.
                </div>
            </form>
        </Modal>
    );
}
