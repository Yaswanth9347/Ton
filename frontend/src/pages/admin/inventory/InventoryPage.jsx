import { useState, Suspense, lazy } from 'react';
import { Package, Wrench, Fuel, Boxes } from 'lucide-react';
import './InventoryPage.css';

const PipesInventory = lazy(() => import('./PipesInventory').then(m => ({ default: m.PipesInventory })));
const SparesInventory = lazy(() => import('./SparesInventory').then(m => ({ default: m.SparesInventory })));
const DieselTracking = lazy(() => import('./DieselTracking').then(m => ({ default: m.DieselTracking })));

const tabs = [
    { id: 'pipes', label: 'Pipes', icon: <Package size={17} /> },
    { id: 'spares', label: 'Spares (Bits & OB)', icon: <Wrench size={17} /> },
    { id: 'diesel', label: 'Diesel', icon: <Fuel size={17} /> },
];

function LoadingSpinner() {
    return (
        <div className="inv-spinner">
            <div className="inv-spinner__ring" />
            Loading…
        </div>
    );
}

export function InventoryPage() {
    const [activeTab, setActiveTab] = useState('pipes');

    return (
        <div className="inventory-page">
            {/* Header */}
            <div className="inv-header">
                <div className="inv-header__left">
                    <div className="inv-header__eyebrow">
                        <Boxes size={13} />
                        Operations Management
                    </div>
                    <h1 className="inv-header__title">Inventory &amp; Supplies</h1>
                    <p className="inv-header__subtitle">
                        Manage pipes stock, drilling spares, and diesel fuel tracking
                    </p>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="inv-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`inv-tab ${activeTab === tab.id ? 'inv-tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
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
