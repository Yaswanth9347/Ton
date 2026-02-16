import { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../common/Table';
import { ThemeToggle } from '../common/ThemeToggle';
import { Sun, Moon, Settings, Clock, Edit2, Trash2, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';

export function OvertimeRulesConfig() {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRule, setEditingRule] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState(null);

    // Form state
    const [name, setName] = useState('');
    const [regularHoursPerDay, setRegularHoursPerDay] = useState(8);
    const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.5);
    const [weekendMultiplier, setWeekendMultiplier] = useState(2.0);
    const [holidayMultiplier, setHolidayMultiplier] = useState(2.0);
    const [maxOvertimePerDay, setMaxOvertimePerDay] = useState(4);
    const [isActive, setIsActive] = useState(true);

    const fetchRules = async () => {
        try {
            setLoading(true);
            const response = await adminApi.getOvertimeRules();
            setRules(response.data.data || []);
        } catch (err) {
            console.error('Failed to fetch overtime rules:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const resetForm = () => {
        setName('');
        setRegularHoursPerDay(8);
        setOvertimeMultiplier(1.5);
        setWeekendMultiplier(2.0);
        setHolidayMultiplier(2.0);
        setMaxOvertimePerDay(4);
        setIsActive(true);
        setError(null);
    };

    const handleAddRule = () => {
        resetForm();
        setEditingRule(null);
        setShowModal(true);
    };

    const handleEditRule = (rule) => {
        setEditingRule(rule);
        setName(rule.name);
        setRegularHoursPerDay(parseFloat(rule.regular_hours_per_day));
        setOvertimeMultiplier(parseFloat(rule.overtime_multiplier));
        setWeekendMultiplier(parseFloat(rule.weekend_multiplier));
        setHolidayMultiplier(parseFloat(rule.holiday_multiplier));
        setMaxOvertimePerDay(parseFloat(rule.max_overtime_per_day));
        setIsActive(rule.is_active);
        setError(null);
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setError(null);

        try {
            const data = {
                name,
                regularHoursPerDay,
                overtimeMultiplier,
                weekendMultiplier,
                holidayMultiplier,
                maxOvertimePerDay,
                isActive
            };

            if (editingRule) {
                await adminApi.updateOvertimeRule(editingRule.id, data);
            } else {
                await adminApi.createOvertimeRule(data);
            }

            setShowModal(false);
            fetchRules();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save overtime rule');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this overtime rule?')) return;

        try {
            await adminApi.deleteOvertimeRule(id);
            toast.success('Overtime rule deleted');
            fetchRules();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete overtime rule');
        }
    };

    const handleToggleActive = async (rule) => {
        try {
            await adminApi.updateOvertimeRule(rule.id, { isActive: !rule.is_active });
            toast.success(`Rule ${!rule.is_active ? 'activated' : 'deactivated'}`);
            fetchRules();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update overtime rule');
        }
    };

    return (
        <div className="settings-page">
            {/* ====== Appearance ====== */}
            <div className="settings-section">
                <h3 className="settings-section-title"><Settings size={18} /> Appearance</h3>
                <Card>
                    <div className="settings-row" style={{ padding: 'var(--spacing-2) var(--spacing-4)' }}>
                        <div className="settings-row-info">
                            <h4>Theme</h4>
                            <p>Switch between light and dark mode</p>
                        </div>
                        <ThemeToggle />
                    </div>
                </Card>
            </div>

            {/* ====== Application Info ====== */}
            <div className="settings-section">
                <h3 className="settings-section-title"><Settings size={18} /> Application</h3>
                <Card>
                    <div className="flex items-center justify-between py-2 px-4">
                        <div className="flex items-center gap-2">
                            <span className="text-muted text-xs uppercase font-semibold">Application:</span>
                            <span className="font-medium text-sm">JMJ Management System</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-muted text-xs uppercase font-semibold">Version:</span>
                            <span className="font-medium text-sm">1.0.0</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* ====== Overtime Rules ====== */}
            <div className="settings-section">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="settings-section-title"><Clock size={18} /> Overtime Rules</h3>
                    <Button variant="primary" onClick={handleAddRule} className="flex items-center gap-2">
                        <Plus size={16} /> Add Rule
                    </Button>
                </div>

                <Card>
                    {loading ? (
                        <div className="loading"><div className="spinner"></div></div>
                    ) : rules.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">⏰</div>
                            <div className="empty-state-title">No overtime rules configured</div>
                            <div className="empty-state-description">Add a rule to start tracking overtime</div>
                        </div>
                    ) : (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableHeader>Name</TableHeader>
                                    <TableHeader>Regular Hours</TableHeader>
                                    <TableHeader>OT Multiplier</TableHeader>
                                    <TableHeader>Weekend</TableHeader>
                                    <TableHeader>Holiday</TableHeader>
                                    <TableHeader>Max OT/Day</TableHeader>
                                    <TableHeader>Status</TableHeader>
                                    <TableHeader>Actions</TableHeader>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {rules.map((rule) => (
                                    <TableRow key={rule.id}>
                                        <TableCell>{rule.name}</TableCell>
                                        <TableCell>{rule.regular_hours_per_day} hrs</TableCell>
                                        <TableCell>{rule.overtime_multiplier}x</TableCell>
                                        <TableCell>{rule.weekend_multiplier}x</TableCell>
                                        <TableCell>{rule.holiday_multiplier}x</TableCell>
                                        <TableCell>{rule.max_overtime_per_day} hrs</TableCell>
                                        <TableCell>
                                            <span
                                                className={`badge ${rule.is_active ? 'badge-success' : 'badge-secondary'}`}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => handleToggleActive(rule)}
                                            >
                                                {rule.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-4">
                                                <button
                                                    className="transition-colors hover:scale-110"
                                                    onClick={() => handleEditRule(rule)}
                                                    title="Edit Rule"
                                                    style={{ background: 'transparent', border: 'none', padding: 0, color: 'var(--color-primary)' }}
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    className="text-danger transition-colors hover:scale-110"
                                                    onClick={() => handleDelete(rule.id)}
                                                    title="Delete Rule"
                                                    style={{ background: 'transparent', border: 'none', padding: 0 }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Card>
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingRule ? 'Edit Overtime Rule' : 'Add Overtime Rule'}
            >
                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message mb-4">{error}</div>}

                    <div className="form-group">
                        <label className="form-label">Rule Name</label>
                        <input
                            type="text"
                            className="form-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Default, Night Shift"
                            required
                        />
                    </div>

                    <div className="form-group-grid">
                        <div className="form-group">
                            <label className="form-label">Regular Hours/Day</label>
                            <input
                                type="number"
                                className="form-input"
                                value={regularHoursPerDay}
                                onChange={(e) => setRegularHoursPerDay(parseFloat(e.target.value))}
                                min="1"
                                max="24"
                                step="0.5"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Max OT/Day (hrs)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={maxOvertimePerDay}
                                onChange={(e) => setMaxOvertimePerDay(parseFloat(e.target.value))}
                                min="0"
                                max="16"
                                step="0.5"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group-grid">
                        <div className="form-group">
                            <label className="form-label">OT Multiplier</label>
                            <input
                                type="number"
                                className="form-input"
                                value={overtimeMultiplier}
                                onChange={(e) => setOvertimeMultiplier(parseFloat(e.target.value))}
                                min="1"
                                max="5"
                                step="0.1"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Weekend Multiplier</label>
                            <input
                                type="number"
                                className="form-input"
                                value={weekendMultiplier}
                                onChange={(e) => setWeekendMultiplier(parseFloat(e.target.value))}
                                min="1"
                                max="5"
                                step="0.1"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group-grid">
                        <div className="form-group">
                            <label className="form-label">Holiday Multiplier</label>
                            <input
                                type="number"
                                className="form-input"
                                value={holidayMultiplier}
                                onChange={(e) => setHolidayMultiplier(parseFloat(e.target.value))}
                                min="1"
                                max="5"
                                step="0.1"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select
                                className="form-input"
                                value={isActive ? 'active' : 'inactive'}
                                onChange={(e) => setIsActive(e.target.value === 'active')}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-between mt-6">
                        <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" disabled={formLoading}>
                            {formLoading ? 'Saving...' : 'Save Rule'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
