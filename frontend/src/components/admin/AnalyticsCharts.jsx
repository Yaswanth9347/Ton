import { useState, useEffect, useCallback } from 'react';
import { adminApi, boreApi, govtBoreApi } from '../../services/api';
import { Card } from '../common/Card';
import {
    Users, Droplets, IndianRupee, TrendingUp,
    Landmark, BarChart3, Activity, Wallet
} from 'lucide-react';

export function AnalyticsCharts() {
    const [analytics, setAnalytics] = useState(null);
    const [boreData, setBoreData] = useState([]);
    const [govtBoreData, setGovtBoreData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const [analyticsRes, boreRes, govtBoreRes] = await Promise.all([
                adminApi.getAttendanceAnalytics(dateRange),
                boreApi.getAll(),
                govtBoreApi.getAll()
            ]);
            setAnalytics(analyticsRes.data.data);
            setBoreData(boreRes.data.data || []);
            setGovtBoreData(govtBoreRes.data.data || []);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    if (loading) {
        return (
            <div className="analytics-loading">
                <div className="spinner"></div>
                <p>Loading analytics...</p>
            </div>
        );
    }

    const { dailyTrend, summary } = analytics || { dailyTrend: [], summary: {} };

    // Bore calculations
    const boreStats = {
        total: boreData.length,
        totalFeet: boreData.reduce((s, r) => s + (parseFloat(r.total_feet) || 0), 0),
        totalAmount: boreData.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
        totalProfit: boreData.reduce((s, r) => s + (parseFloat(r.profit) || 0), 0),
        totalPending: boreData.reduce((s, r) => s + (parseFloat(r.pending) || 0), 0),
        totalDiesel: boreData.reduce((s, r) => s + (parseFloat(r.diesel_amount) || 0), 0),
        totalCash: boreData.reduce((s, r) => s + (parseFloat(r.cash) || 0), 0),
        totalPhonePe: boreData.reduce((s, r) => s + (parseFloat(r.phone_pe) || 0), 0),
    };

    const govtStats = {
        total: govtBoreData.length,
        totalAmount: govtBoreData.reduce((s, r) => s + (parseFloat(r.total_amt) || 0), 0),
        totalNet: govtBoreData.reduce((s, r) => s + (parseFloat(r.net_amount) || 0), 0),
        villages: new Set(govtBoreData.map(r => r.village).filter(Boolean)).size,
    };

    const maxPresent = Math.max(...dailyTrend.map(d => parseInt(d.present) || 0), 1);

    return (
        <div className="analytics-container">
            {/* Date Filter */}
            <div className="analytics-filters">
                <div className="filter-group">
                    <label>From:</label>
                    <input
                        type="date"
                        value={dateRange.startDate}
                        onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                        className="form-input"
                    />
                </div>
                <div className="filter-group">
                    <label>To:</label>
                    <input
                        type="date"
                        value={dateRange.endDate}
                        onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                        className="form-input"
                    />
                </div>
            </div>

            {/* ====== Company Overview ====== */}
            <h3 className="analytics-section-title"><BarChart3 size={18} /> Company Overview</h3>
            <div className="analytics-summary">
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--blue"><Users size={20} /></div>
                    <div className="summary-content">
                        <h4>Total Employees</h4>
                        <p className="summary-value">{summary?.total_records || 0}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--green"><Droplets size={20} /></div>
                    <div className="summary-content">
                        <h4>Private Bores</h4>
                        <p className="summary-value">{boreStats.total}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--purple"><Landmark size={20} /></div>
                    <div className="summary-content">
                        <h4>Govt Bores</h4>
                        <p className="summary-value">{govtStats.total}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--orange"><Activity size={20} /></div>
                    <div className="summary-content">
                        <h4>Villages Served</h4>
                        <p className="summary-value">{govtStats.villages}</p>
                    </div>
                </Card>
            </div>

            {/* ====== Financial Overview ====== */}
            <h3 className="analytics-section-title"><IndianRupee size={18} /> Financial Overview</h3>
            <div className="analytics-summary">
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--green"><IndianRupee size={20} /></div>
                    <div className="summary-content">
                        <h4>Bore Revenue</h4>
                        <p className="summary-value">₹{boreStats.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--blue"><TrendingUp size={20} /></div>
                    <div className="summary-content">
                        <h4>Bore Profit</h4>
                        <p className="summary-value">₹{boreStats.totalProfit.toLocaleString('en-IN')}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--purple"><Landmark size={20} /></div>
                    <div className="summary-content">
                        <h4>Govt Revenue</h4>
                        <p className="summary-value">₹{govtStats.totalAmount.toLocaleString('en-IN')}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--orange"><Wallet size={20} /></div>
                    <div className="summary-content">
                        <h4>Pending Payments</h4>
                        <p className="summary-value">₹{boreStats.totalPending.toLocaleString('en-IN')}</p>
                    </div>
                </Card>
            </div>

            {/* ====== Payment Breakdown ====== */}
            <h3 className="analytics-section-title"><Wallet size={18} /> Payment Breakdown (Bores)</h3>
            <div className="analytics-summary">
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--green"><IndianRupee size={20} /></div>
                    <div className="summary-content">
                        <h4>Cash Received</h4>
                        <p className="summary-value">₹{boreStats.totalCash.toLocaleString('en-IN')}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--blue"><IndianRupee size={20} /></div>
                    <div className="summary-content">
                        <h4>PhonePe Received</h4>
                        <p className="summary-value">₹{boreStats.totalPhonePe.toLocaleString('en-IN')}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--orange"><IndianRupee size={20} /></div>
                    <div className="summary-content">
                        <h4>Diesel Expense</h4>
                        <p className="summary-value">₹{boreStats.totalDiesel.toLocaleString('en-IN')}</p>
                    </div>
                </Card>
                <Card className="summary-card">
                    <div className="analytics-stat-icon analytics-stat-icon--purple"><Activity size={20} /></div>
                    <div className="summary-content">
                        <h4>Total Feet Drilled</h4>
                        <p className="summary-value">{boreStats.totalFeet.toLocaleString('en-IN')}</p>
                    </div>
                </Card>
            </div>

            {/* ====== Attendance Trend ====== */}
            <Card className="chart-card chart-card--premium">
                <div className="chart-header">
                    <h3 className="chart-title">📈 Daily Attendance Trend</h3>
                    <div className="chart-legend">
                        <span className="legend-item"><span className="legend-dot legend-dot--neon"></span> Attendance Rate</span>
                    </div>
                </div>
                <div className="chart-container">
                    {dailyTrend.length === 0 ? (
                        <div className="empty-chart">No data for selected period</div>
                    ) : (
                        <div className="analytics-chart-wrap">
                            <div className="analytics-svg-container">
                                <svg className="analytics-svg" viewBox="0 0 1000 250" preserveAspectRatio="none">
                                    <defs>
                                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#00f2fe" />
                                            <stop offset="100%" stopColor="#4facfe" />
                                        </linearGradient>
                                        <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                                            <feGaussianBlur stdDeviation="5" result="blur" />
                                            <feMerge>
                                                <feMergeNode in="blur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    </defs>

                                    {/* Grid Layout */}
                                    {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                                        <line
                                            key={`h-${i}`}
                                            x1="0" y1={250 * p}
                                            x2="1000" y2={250 * p}
                                            className="chart-grid-line"
                                        />
                                    ))}
                                    {dailyTrend.slice(-14).map((_, i, arr) => (
                                        <line
                                            key={`v-${i}`}
                                            x1={(i / (arr.length - 1)) * 1000} y1="0"
                                            x2={(i / (arr.length - 1)) * 1000} y2="250"
                                            className="chart-grid-line"
                                        />
                                    ))}

                                    {/* Neon Trend Line (Spline) */}
                                    <path
                                        d={(() => {
                                            const data = dailyTrend.slice(-14);
                                            if (data.length < 2) return '';
                                            const points = data.map((d, i) => ({
                                                x: (i / (data.length - 1)) * 1000,
                                                y: 250 - (parseInt(d.present) / maxPresent) * 160 - 45
                                            }));

                                            let d = `M ${points[0].x},${points[0].y}`;
                                            for (let i = 0; i < points.length - 1; i++) {
                                                const cp1x = (points[i].x + points[i + 1].x) / 2;
                                                d += ` C ${cp1x},${points[i].y} ${cp1x},${points[i + 1].y} ${points[i + 1].x},${points[i + 1].y}`;
                                            }
                                            return d;
                                        })()}
                                        fill="none"
                                        stroke="url(#lineGradient)"
                                        strokeWidth="5"
                                        strokeLinecap="round"
                                        filter="url(#neonGlow)"
                                        className="chart-line-neon"
                                    />

                                    {/* Pulse Nodes */}
                                    {dailyTrend.slice(-14).map((d, i, arr) => {
                                        const x = (i / (arr.length - 1)) * 1000;
                                        const y = 250 - (parseInt(d.present) / maxPresent) * 160 - 45;
                                        return (
                                            <g key={i} className="chart-node-glow">
                                                <circle cx={x} cy={y} r="10" className="node-outer" />
                                                <circle cx={x} cy={y} r="4" fill="#fff" className="node-inner" />
                                                <rect
                                                    x={x - 15} y={y - 35}
                                                    width="30" height="20"
                                                    rx="4"
                                                    className="node-tooltip-bg"
                                                />
                                                <text x={x} y={y - 21} textAnchor="middle" className="node-tooltip-text">
                                                    {d.present}
                                                </text>
                                            </g>
                                        );
                                    })}
                                </svg>
                            </div>
                            <div className="chart-x-labels-new">
                                {dailyTrend.slice(-14).map((day, i) => (
                                    <div key={i} className="chart-x-item">
                                        <span className="chart-x-date">
                                            {new Date(day.attendance_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
