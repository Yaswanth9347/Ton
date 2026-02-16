/**
 * Format a date string to display format
 */
export const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

/**
 * Format a timestamp to time format
 */
export const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

/**
 * Format a timestamp to datetime format
 */
export const formatDateTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

/**
 * Format hours to display
 */
export const formatHours = (hours) => {
    if (hours === null || hours === undefined) return '-';
    return `${hours.toFixed(2)} hrs`;
};

/**
 * Format currency (Indian Rupees)
 */
export const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amount);
};

/**
 * Get status badge class
 */
export const getStatusBadgeClass = (status, isComplete) => {
    if (status === 'present' && isComplete) return 'badge-success';
    if (status === 'present' && !isComplete) return 'badge-warning';
    if (status === 'absent') return 'badge-danger';
    return 'badge-info';
};

/**
 * Get status display text
 */
export const getStatusText = (status, isComplete) => {
    if (status === 'present' && isComplete) return 'Present';
    if (status === 'present' && !isComplete) return 'Incomplete';
    if (status === 'absent') return 'Absent';
    if (status === 'not_checked_in') return 'Not Checked In';
    return status;
};

/**
 * Get today's date in YYYY-MM-DD format
 */
export const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
};

/**
 * Get date N days ago in YYYY-MM-DD format
 */
export const getDateDaysAgo = (days) => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
};
