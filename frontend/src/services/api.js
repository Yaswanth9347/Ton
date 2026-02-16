import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
});

// Request interceptor to add auth token and handle FormData
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        // For FormData, remove Content-Type and let browser set it with boundary
        if (config.data instanceof FormData) {
            delete config.headers['Content-Type'];
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authApi = {
    login: (username, password) => api.post('/auth/login', { username, password }),
    logout: () => api.post('/auth/logout'),
    getCurrentUser: () => api.get('/auth/me'),
    updateProfile: (data) => api.put('/auth/profile', data),
    changePassword: (data) => api.put('/auth/change-password', data),
    uploadProfilePhoto: (file) => {
        const formData = new FormData();
        formData.append('photo', file);
        return api.post('/auth/profile/photo', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    deleteProfilePhoto: () => api.delete('/auth/profile/photo'),
};

// Attendance API
export const attendanceApi = {
    checkIn: (location) => api.post('/attendance/check-in', { location }),
    checkOut: (location) => api.post('/attendance/check-out', { location }),
    getToday: () => api.get('/attendance/today'),
    getHistory: (params) => api.get('/attendance/history', { params }),
    getCalendar: (month, year) => api.get('/attendance/calendar', { params: { month, year } }),
    getOvertimeSummary: (params) => api.get('/attendance/overtime-summary', { params }),
};

// Admin API
export const adminApi = {
    getDashboard: () => api.get('/admin/dashboard'),
    getEmployees: () => api.get('/admin/employees'),
    addEmployee: (data) => api.post('/admin/employees', data),
    updateEmployee: (id, data) => api.put(`/admin/employees/${id}`, data),
    deactivateEmployee: (id) => api.patch(`/admin/employees/${id}/deactivate`),
    reactivateEmployee: (id) => api.patch(`/admin/employees/${id}/reactivate`),
    getAllAttendance: (params) => api.get('/admin/attendance', { params }),
    getEmployeeAttendance: (userId, params) => api.get(`/admin/attendance/${userId}`, { params }),
    correctAttendance: (id, data) => api.put(`/admin/attendance/${id}`, data),
    exportAttendance: (params) => api.get('/admin/attendance/export', { params, responseType: 'blob' }),
    getAttendanceAnalytics: (params) => api.get('/admin/attendance/analytics', { params }),
    bulkUploadAttendance: (records) => api.post('/admin/attendance/bulk-upload', { records }),
    getAllLeaves: (params) => api.get('/admin/leaves', { params }),
    reviewLeave: (id, data) => api.put(`/admin/leaves/${id}`, data),
    getAllLeaveBalances: (year) => api.get('/admin/leave-balances', { params: { year } }),
    updateLeaveBalance: (userId, leaveTypeId, data) => api.put(`/admin/leave-balances/${userId}/${leaveTypeId}`, data),
    manageHoliday: {
        create: (data) => api.post('/admin/holidays', data),
        update: (id, data) => api.put(`/admin/holidays/${id}`, data),
        delete: (id) => api.delete(`/admin/holidays/${id}`),
    },
    // Overtime rules
    getOvertimeRules: () => api.get('/admin/overtime-rules'),
    createOvertimeRule: (data) => api.post('/admin/overtime-rules', data),
    updateOvertimeRule: (id, data) => api.put(`/admin/overtime-rules/${id}`, data),
    deleteOvertimeRule: (id) => api.delete(`/admin/overtime-rules/${id}`),
    // Employee calendar
    getEmployeeCalendar: (userId, month, year) => api.get(`/admin/employees/${userId}/calendar`, { params: { month, year } }),
    // Employee payroll history
    getEmployeePayrollHistory: (userId) => api.get(`/admin/employees/${userId}/payroll-history`),
};

// Leaves & Holidays API
export const leaveApi = {
    getHolidays: (params) => api.get('/leaves-holidays/holidays', { params }),
    getLeaveTypes: () => api.get('/leaves-holidays/leave-types'),
    getMyBalances: (year) => api.get('/leaves-holidays/balances', { params: { year } }),
    requestLeave: (data) => api.post('/leaves-holidays/leaves', data),
    getMyLeaves: (params) => api.get('/leaves-holidays/leaves/me', { params }),
    cancelLeave: (id) => api.delete(`/leaves-holidays/leaves/${id}`),
};

export const lunchApi = {
    createRequest: (data) => api.post('/lunch', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    getMyRequests: (params) => api.get('/lunch/me', { params }),
    updateRequest: (id, data) => api.put(`/lunch/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    getAllRequests: (params) => api.get('/lunch', { params }),
    reviewRequest: (id, data) => api.put(`/lunch/${id}/review`, data),
    // Meal categories
    getCategories: () => api.get('/lunch/categories'),
    createCategory: (data) => api.post('/lunch/categories', data),
    updateCategory: (id, data) => api.put(`/lunch/categories/${id}`, data),
    deleteCategory: (id) => api.delete(`/lunch/categories/${id}`),
    getExpenseSummary: (params) => api.get('/lunch/me/summary', { params }),
};

export const payrollApi = {
    getMyPayroll: () => api.get('/payroll/me'),
    getPreview: (month, year) => api.get('/payroll/preview', { params: { month, year } }),
    generate: (month, year) => api.post('/payroll/generate', { month, year }),
    export: (month, year) => api.get('/payroll/export', { params: { month, year }, responseType: 'blob' }),
    downloadPayslip: (month, year) => api.get(`/payroll/payslip/${month}/${year}`, { responseType: 'blob' }),
    getPayslipDetails: (month, year) => api.get(`/payroll/payslip-details/${month}/${year}`),
    downloadEmployeePayslip: (userId, month, year) => api.get(`/payroll/admin-payslip/${userId}/${month}/${year}`, { responseType: 'blob' }),
};

// Govt Bores API
export const govtBoreApi = {
    getAll: (params) => api.get('/govt-bores', { params }),
    getById: (id) => api.get(`/govt-bores/${id}`),
    create: (data) => api.post('/govt-bores', data),
    update: (id, data) => api.put(`/govt-bores/${id}`, data),
    delete: (id) => api.delete(`/govt-bores/${id}`),
    parseImportFile: (file) => {
        const fd = new FormData();
        fd.append('file', file);
        // Don't set Content-Type header - let browser set it with proper boundary
        return api.post('/govt-bores/import/preview', fd);
    },
    bulkImport: (records) => api.post('/govt-bores/import', { records }),
    getMandals: () => api.get('/govt-bores/mandals'),
    getVillages: (mandalId) => api.get(`/govt-bores/mandals/${mandalId}/villages`),
};

// Bores API (Private Borewell Data)
export const boreApi = {
    getAll: (params) => api.get('/bores', { params }),
    getById: (id) => api.get(`/bores/${id}`),
    create: (data) => api.post('/bores', data),
    update: (id, data) => api.put(`/bores/${id}`, data),
    delete: (id) => api.delete(`/bores/${id}`),
    getReceiptUrl: (id) => {
        const token = localStorage.getItem('token');
        const base = api.defaults.baseURL;
        return `${base}/bores/${id}/receipt?token=${encodeURIComponent(token)}`;
    },
};

export default api;
