export function SummaryCards({ stats, loading = false }) {
    if (loading) {
        return (
            <div className="stats-grid">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="stat-card">
                        <div className="loading" style={{ padding: '1rem' }}>
                            <div className="spinner"></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="stats-grid">
            <div className="stat-card info">
                <div className="stat-label">Total Employees</div>
                <div className="stat-value">{stats?.totalEmployees || 0}</div>
            </div>

            <div className="stat-card success">
                <div className="stat-label">Present Today</div>
                <div className="stat-value">{stats?.presentToday || 0}</div>
            </div>

            <div className="stat-card danger">
                <div className="stat-label">Absent Today</div>
                <div className="stat-value">{stats?.absentToday || 0}</div>
            </div>

            <div className="stat-card warning">
                <div className="stat-label">Incomplete</div>
                <div className="stat-value">{stats?.incompleteToday || 0}</div>
            </div>
        </div>
    );
}
