import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { Package, Wrench, Fuel, Boxes, IndianRupee, TrendingUp, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import './InventoryPage.css';

const PipesInventory = lazy(() => import('./PipesInventory'));
const SparesInventory = lazy(() => import('./SparesInventory'));
const DieselTracking = lazy(() => import('./DieselTracking'));

const API_URL = import.meta.env.VITE_API_URL || '/api';

const tabs = [
    { id: 'pipes', label: 'Pipes', icon: <Package size={17} /> },
    { id: 'spares', label: 'Spares', icon: <Wrench size={17} /> },
    { id: 'diesel', label: 'Diesel', icon: <Fuel size={17} /> },
];

const fmtCurrency = (val) => {
    const num = parseFloat(val || 0);
    if (num >= 100000) return `₹${(num / 100000).toFixed(1)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
    return `₹${num.toFixed(0)}`;
};

function LoadingSpinner() {
    return (
        <div className="inv-spinner">
            <div className="inv-spinner__ring" />
            Loading…
        </div>
    );
}

export function InventoryPage() {
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('inventoryActiveTab') || 'pipes');
    const [summary, setSummary] = useState(null);

    const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

    const fetchSummary = useCallback(async () => {
        try {
            const r = await axios.get(`${API_URL}/inventory/summary`, { headers: authHeaders() });
            setSummary(r.data.data);
        } catch (err) {
            console.error('[Inventory] Failed to fetch summary:', err.message);
        }
    }, []);

    useEffect(() => {
        fetchSummary();
    }, [activeTab, fetchSummary]);

    useEffect(() => {
        const refreshSummary = () => {
            fetchSummary();
        };

        window.addEventListener('inventory:summary-refresh', refreshSummary);
        return () => window.removeEventListener('inventory:summary-refresh', refreshSummary);
    }, [fetchSummary]);

    const handleTabChange = (id) => {
        setActiveTab(id);
        localStorage.setItem('inventoryActiveTab', id);
    };

    return (
        <div className="inventory-page">
            {/* Header */}
            <div className="inv-header">
                <div className="inv-header__left">
                    <h1 className="inv-header__title">Inventory &amp; Supplies</h1>
                </div>
            </div>

            {/* Summary Dashboard */}
            {summary && (
                <div className="inv-summary-dashboard">
                    <div className="inv-summary-card inv-summary-card--pipes">
                        <div className="inv-summary-card__icon"><Package size={20} /></div>
                        <div className="inv-summary-card__content">
                            <div className="inv-summary-card__value">{summary.pipes.total_types}</div>
                            <div className="inv-summary-card__label">Pipe Types</div>
                            <div className="inv-summary-card__sub">
                                {(summary.pipes.total_stock_feet / 20).toFixed(0)} pipes total
                                {summary.pipes.total_value > 0 && <> · {fmtCurrency(summary.pipes.total_value)} value</>}
                            </div>
                        </div>
                        {summary.pipes.low_stock_count > 0 && (
                            <div className="inv-summary-card__alert">
                                <AlertTriangle size={14} /> {summary.pipes.low_stock_count} low
                            </div>
                        )}
                    </div>
                    <div className="inv-summary-card inv-summary-card--spares">
                        <div className="inv-summary-card__icon"><Wrench size={20} /></div>
                        <div className="inv-summary-card__content">
                            <div className="inv-summary-card__value">{summary.spares.total}</div>
                            <div className="inv-summary-card__label">Spare Materials</div>
                            <div className="inv-summary-card__sub">
                                {summary.spares.stocked ?? summary.spares.available} stocked · {summary.spares.low_stock || 0} low stock
                                {summary.spares.total_value > 0 && <> · {fmtCurrency(summary.spares.total_value)}</>}
                            </div>
                        </div>
                    </div>
                    <div className="inv-summary-card inv-summary-card--diesel">
                        <div className="inv-summary-card__icon"><Fuel size={20} /></div>
                        <div className="inv-summary-card__content">
                            <div className="inv-summary-card__value">{fmtCurrency(summary.diesel.last_30_days_amount)}</div>
                            <div className="inv-summary-card__label">Diesel (30 days)</div>
                            <div className="inv-summary-card__sub">
                                {parseFloat(summary.diesel.last_30_days_liters).toFixed(0)}L consumed · {summary.diesel.last_30_days_entries} entries
                            </div>
                        </div>
                    </div>
                    <div className="inv-summary-card inv-summary-card--total">
                        <div className="inv-summary-card__icon"><IndianRupee size={20} /></div>
                        <div className="inv-summary-card__content">
                            <div className="inv-summary-card__value">
                                {fmtCurrency((summary.pipes.total_value || 0) + (summary.spares.total_value || 0))}
                            </div>
                            <div className="inv-summary-card__label">Total Value</div>
                            <div className="inv-summary-card__sub">Pipes + Spares current stock</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Bar */}
            <div className="inv-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`inv-tab ${activeTab === tab.id ? 'inv-tab--active' : ''}`}
                        onClick={() => handleTabChange(tab.id)}
                    >
                        <span className="inv-tab__icon">{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="inv-content">
                <Suspense fallback={<LoadingSpinner />}>
                    {activeTab === 'pipes' && <PipesInventory />}
                    {activeTab === 'spares' && <SparesInventory />}
                    {activeTab === 'diesel' && <DieselTracking />}
                </Suspense>
            </div>
        </div>
    );
}
