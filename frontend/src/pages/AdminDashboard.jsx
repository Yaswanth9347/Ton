import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi, boreApi, govtBoreApi } from '../services/api';
import { SummaryCards } from '../components/admin/SummaryCards';
import { EmployeeTable } from '../components/admin/EmployeeTable';
import { EmployeeForm } from '../components/admin/EmployeeForm';
import { AttendanceTable } from '../components/admin/AttendanceTable';
import { AttendanceEditModal } from '../components/admin/AttendanceEditModal';
import { AnalyticsCharts } from '../components/admin/AnalyticsCharts';
import { BulkUploadModal } from '../components/admin/BulkUploadModal';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { toast } from 'react-hot-toast';
import { OvertimeRulesConfig } from '../components/admin/OvertimeRulesConfig';
import { AdminPayrollTab } from '../components/admin/AdminPayrollTab';
import { AttendanceCalendarView } from '../components/admin/AttendanceCalendarView';
import {
    Users, UserCheck, UserX, Clock,
    Droplets, IndianRupee, TrendingUp, Landmark,
    UserPlus, Upload, Download
} from 'lucide-react';

export function AdminDashboard({ tab = 'dashboard' }) {
    const { user, logout } = useAuth();
    const activeTab = tab;

    // Dashboard state
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);

    // Employees state
    const [employees, setEmployees] = useState([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [employeeFormError, setEmployeeFormError] = useState(null);
    const [employeeFormLoading, setEmployeeFormLoading] = useState(false);

    // Attendance state
    const [attendance, setAttendance] = useState([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [editingAttendance, setEditingAttendance] = useState(null);
    const [attendanceFormError, setAttendanceFormError] = useState(null);
    const [attendanceFormLoading, setAttendanceFormLoading] = useState(false);
    const [showBulkUpload, setShowBulkUpload] = useState(false);

    // Calendar view state
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [calendarEmployee, setCalendarEmployee] = useState(null);

    // Bore stats for dashboard
    const [boreStats, setBoreStats] = useState({ total: 0, totalAmount: 0, totalProfit: 0 });
    const [govtBoreStats, setGovtBoreStats] = useState({ total: 0, totalAmount: 0, totalNet: 0 });

    // Audit logs feature removed

    // Fetch dashboard stats
    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const response = await adminApi.getDashboard();
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setStatsLoading(false);
        }
    }, []);

    // Fetch employees
    const fetchEmployees = useCallback(async () => {
        setEmployeesLoading(true);
        try {
            const response = await adminApi.getEmployees();
            setEmployees(response.data.data);
        } catch (error) {
            console.error('Failed to fetch employees:', error);
        } finally {
            setEmployeesLoading(false);
        }
    }, []);

    // Fetch attendance
    const fetchAttendance = useCallback(async (filters = {}) => {
        setAttendanceLoading(true);
        try {
            const response = await adminApi.getAllAttendance(filters);
            setAttendance(response.data.data);
        } catch (error) {
            console.error('Failed to fetch attendance:', error);
        } finally {
            setAttendanceLoading(false);
        }
    }, []);

    // Audit logs feature removed

    // Initial data fetch
    useEffect(() => {
        fetchStats();
        fetchEmployees();
        // Fetch bore stats for dashboard
        (async () => {
            try {
                const [boreRes, govtBoreRes] = await Promise.all([
                    boreApi.getAll(),
                    govtBoreApi.getAll()
                ]);
                const bores = boreRes.data.data || [];
                const govtBores = govtBoreRes.data.data || [];
                setBoreStats({
                    total: bores.length,
                    totalAmount: bores.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
                    totalProfit: bores.reduce((s, r) => s + (parseFloat(r.profit) || 0), 0),
                });
                setGovtBoreStats({
                    total: govtBores.length,
                    totalAmount: govtBores.reduce((s, r) => s + (parseFloat(r.total_amt) || 0), 0),
                    totalNet: govtBores.reduce((s, r) => s + (parseFloat(r.net_amount) || 0), 0),
                });
            } catch (e) { console.error('Failed to fetch bore stats', e); }
        })();
    }, [fetchStats, fetchEmployees]);

    // Fetch data when tab changes
    useEffect(() => {
        if (activeTab === 'attendance') {
            fetchAttendance();
        }
    }, [activeTab, fetchAttendance]);

    // Employee handlers
    const handleAddEmployee = () => {
        setEditingEmployee(null);
        setEmployeeFormError(null);
        setShowEmployeeModal(true);
    };

    const handleEditEmployee = (employee) => {
        setEditingEmployee(employee);
        setEmployeeFormError(null);
        setShowEmployeeModal(true);
    };

    const handleEmployeeSubmit = async (data) => {
        setEmployeeFormLoading(true);
        setEmployeeFormError(null);
        try {
            if (editingEmployee) {
                await adminApi.updateEmployee(editingEmployee.id, data);
            } else {
                await adminApi.addEmployee(data);
            }
            setShowEmployeeModal(false);
            fetchEmployees();
            fetchStats();
        } catch (error) {
            setEmployeeFormError(error.response?.data?.message || 'Failed to save employee');
        } finally {
            setEmployeeFormLoading(false);
        }
    };

    const handleToggleActive = async (employee) => {
        try {
            if (employee.isActive) {
                await adminApi.deactivateEmployee(employee.id);
            } else {
                await adminApi.reactivateEmployee(employee.id);
            }
            fetchEmployees();
            fetchStats();
            toast.success(`Employee ${employee.isActive ? 'deactivated' : 'reactivated'} successfully`);
        } catch (error) {
            console.error('Failed to toggle employee status:', error);
            toast.error(error.response?.data?.message || 'Failed to update employee status');
        }
    };

    // Attendance handlers
    const handleCorrectAttendance = (record) => {
        setEditingAttendance(record);
        setAttendanceFormError(null);
    };

    const handleAttendanceSubmit = async (data) => {
        setAttendanceFormLoading(true);
        setAttendanceFormError(null);
        try {
            await adminApi.correctAttendance(editingAttendance.id, data);
            setEditingAttendance(null);
            fetchAttendance();
        } catch (error) {
            setAttendanceFormError(error.response?.data?.message || 'Failed to correct attendance');
        } finally {
            setAttendanceFormLoading(false);
        }
    };

    const handleExport = async (filters = {}) => {
        try {
            const response = await adminApi.exportAttendance(filters);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `attendance_report_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export report');
        }
    };

    const handleLogout = async () => {
        await logout();
    };

    return (
        <div>
            <main>
                {/* Dashboard Tab */}
                {activeTab === 'dashboard' && (
                    <div className="dashboard-overview">
                        {/* Quick Stats Row */}
                        <div className="dash-stats-grid">
                            <div className="dash-stat-card">
                                <div className="dash-stat-icon dash-stat-icon--employees">
                                    <Users size={22} />
                                </div>
                                <div className="dash-stat-body">
                                    <span className="dash-stat-value">{stats?.totalEmployees || 0}</span>
                                    <span className="dash-stat-label">Total Employees</span>
                                </div>
                            </div>
                            <div className="dash-stat-card">
                                <div className="dash-stat-icon dash-stat-icon--present">
                                    <UserCheck size={22} />
                                </div>
                                <div className="dash-stat-body">
                                    <span className="dash-stat-value">{stats?.presentToday || 0}</span>
                                    <span className="dash-stat-label">Present Today</span>
                                </div>
                            </div>
                            <div className="dash-stat-card">
                                <div className="dash-stat-icon dash-stat-icon--absent">
                                    <UserX size={22} />
                                </div>
                                <div className="dash-stat-body">
                                    <span className="dash-stat-value">{stats?.absentToday || 0}</span>
                                    <span className="dash-stat-label">Absent Today</span>
                                </div>
                            </div>
                            <div className="dash-stat-card">
                                <div className="dash-stat-icon dash-stat-icon--incomplete">
                                    <Clock size={22} />
                                </div>
                                <div className="dash-stat-body">
                                    <span className="dash-stat-value">{stats?.incompleteToday || 0}</span>
                                    <span className="dash-stat-label">Incomplete</span>
                                </div>
                            </div>
                        </div>

                        {/* Company Business Stats */}
                        <h3 className="dash-section-title">Business Overview</h3>
                        <div className="dash-stats-grid dash-stats-grid--business">
                            <div className="dash-stat-card dash-stat-card--wide">
                                <div className="dash-stat-icon dash-stat-icon--bores">
                                    <Droplets size={22} />
                                </div>
                                <div className="dash-stat-body">
                                    <span className="dash-stat-value">{boreStats.total}</span>
                                    <span className="dash-stat-label">Private Bores</span>
                                </div>
                            </div>
                            <div className="dash-stat-card dash-stat-card--wide">
                                <div className="dash-stat-icon dash-stat-icon--income">
                                    <IndianRupee size={22} />
                                </div>
                                <div className="dash-stat-body">
                                    <span className="dash-stat-value">₹{boreStats.totalAmount.toLocaleString('en-IN')}</span>
                                    <span className="dash-stat-label">Private Bores Revenue</span>
                                </div>
                            </div>
                            <div className="dash-stat-card dash-stat-card--wide">
                                <div className="dash-stat-icon dash-stat-icon--profit">
                                    <TrendingUp size={22} />
                                </div>
                                <div className="dash-stat-body">
                                    <span className="dash-stat-value">₹{boreStats.totalProfit.toLocaleString('en-IN')}</span>
                                    <span className="dash-stat-label">Private Bores Profit</span>
                                </div>
                            </div>
                            <div className="dash-stat-card dash-stat-card--wide">
                                <div className="dash-stat-icon dash-stat-icon--govt">
                                    <Landmark size={22} />
                                </div>
                                <div className="dash-stat-body">
                                    <span className="dash-stat-value">{govtBoreStats.total}</span>
                                    <span className="dash-stat-label">Govt Bores</span>
                                </div>
                            </div>
                            <div className="dash-stat-card dash-stat-card--wide">
                                <div className="dash-stat-icon dash-stat-icon--income">
                                    <IndianRupee size={22} />
                                </div>
                                <div className="dash-stat-body">
                                    <span className="dash-stat-value">₹{govtBoreStats.totalAmount.toLocaleString('en-IN')}</span>
                                    <span className="dash-stat-label">Govt Total Amount</span>
                                </div>
                            </div>
                            <div className="dash-stat-card dash-stat-card--wide">
                                <div className="dash-stat-icon dash-stat-icon--profit">
                                    <TrendingUp size={22} />
                                </div>
                                <div className="dash-stat-body">
                                    <span className="dash-stat-value">₹{govtBoreStats.totalNet.toLocaleString('en-IN')}</span>
                                    <span className="dash-stat-label">Govt Net Amount</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Employees Tab */}
                {activeTab === 'employees' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3>Employee Management</h3>
                            <Button variant="primary" onClick={handleAddEmployee} className="flex items-center gap-2">
                                <UserPlus size={18} fill="currentColor" /> Add Employee
                            </Button>
                        </div>
                        <EmployeeTable
                            employees={employees}
                            loading={employeesLoading}
                            onEdit={handleEditEmployee}
                            onToggleActive={handleToggleActive}
                            onViewCalendar={(employee) => {
                                setCalendarEmployee(employee);
                                setShowCalendarModal(true);
                            }}
                        />
                    </div>
                )}

                {/* Attendance Tab */}
                {activeTab === 'attendance' && (
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3>Attendance Records</h3>
                            <div className="flex gap-2">
                                <Button variant="primary" onClick={() => setShowBulkUpload(true)} className="flex items-center gap-2">
                                    <Upload size={18} fill="currentColor" /> Bulk Upload
                                </Button>
                                <Button variant="secondary" onClick={() => handleExport()} className="flex items-center gap-2">
                                    <Download size={18} fill="currentColor" /> Export CSV
                                </Button>
                            </div>
                        </div>
                        <AttendanceTable
                            attendance={attendance}
                            employees={employees}
                            loading={attendanceLoading}
                            onCorrect={handleCorrectAttendance}
                            onFilter={fetchAttendance}
                        />
                    </div>
                )}

                {/* Analytics Tab */}
                {activeTab === 'analytics' && (
                    <div>
                        <AnalyticsCharts />
                    </div>
                )}

                {/* Payroll Tab */}
                {activeTab === 'payroll' && (
                    <div>
                        <AdminPayrollTab />
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                    <div>
                        <OvertimeRulesConfig />
                    </div>
                )}
            </main>

            {/* Employee Modal */}
            <Modal
                isOpen={showEmployeeModal}
                onClose={() => setShowEmployeeModal(false)}
                title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
            >
                <EmployeeForm
                    employee={editingEmployee}
                    onSubmit={handleEmployeeSubmit}
                    onCancel={() => setShowEmployeeModal(false)}
                    loading={employeeFormLoading}
                    error={employeeFormError}
                />
            </Modal>

            {/* Attendance Edit Modal */}
            <AttendanceEditModal
                isOpen={!!editingAttendance}
                onClose={() => setEditingAttendance(null)}
                attendance={editingAttendance}
                onSubmit={handleAttendanceSubmit}
                loading={attendanceFormLoading}
                error={attendanceFormError}
            />

            {/* Bulk Upload Modal */}
            <BulkUploadModal
                isOpen={showBulkUpload}
                onClose={() => setShowBulkUpload(false)}
                onSuccess={() => {
                    setShowBulkUpload(false);
                    fetchAttendance();
                    fetchStats();
                }}
            />

            {/* Employee Calendar Modal */}
            <Modal
                isOpen={showCalendarModal}
                onClose={() => {
                    setShowCalendarModal(false);
                    setCalendarEmployee(null);
                }}
                title={calendarEmployee ? `Attendance Calendar - ${calendarEmployee.firstName} ${calendarEmployee.lastName}` : 'Attendance Calendar'}
                size="md"
            >
                {calendarEmployee && (
                    <AttendanceCalendarView userId={calendarEmployee.id} />
                )}
            </Modal>
        </div>
    );
}
