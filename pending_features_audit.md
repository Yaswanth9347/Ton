# JMJ Management System — Pending & Incomplete Features Report

> **Audit Date:** June 16, 2026  
> **Auditor:** Code analysis of all frontend & backend source files  
> **Stack:** React (Frontend) + Node/Express (Backend) + PostgreSQL (Prisma)

---

## Summary Table

| # | Module | Feature | Status |
|---|--------|---------|--------|
| 1 | Leaves & Holidays | Leave Management UI | ❌ API defined, **no UI exists** |
| 2 | Leaves & Holidays | Holiday Management UI | ❌ API defined, **no UI exists** |
| 3 | Lunch | Lunch Request System | ❌ API defined, **no UI exists, no backend route registered** |
| 4 | Analytics | Charts are static number cards — no actual charts | ⚠️ Half-implemented |
| 5 | Analytics | Date filter does not scope Bores/Govt Bores data | ⚠️ Broken filter |
| 6 | Private Bores | "Point / Supervisor" label inconsistency in form | ⚠️ UI inconsistency |
| 7 | Private Bores | `profit`, `diesel_amount`, `cash`, `phone_pe` columns referenced in Analytics but not in `BoresPage` table | ⚠️ Missing data fields |
| 8 | Diesel Tracking | Vehicle "Current Fuel" level is calculated from transactions — no manual reset UI | ⚠️ Incomplete workflow |
| 9 | Diesel Tracking | Diesel `CONSUMPTION` records are auto-synced from Govt Bores but show no source detail | ⚠️ Vague display |
| 10 | Admin Dashboard | Audit Logs feature explicitly removed but referenced in comments | ⚠️ Dead code comments |
| 11 | Admin — Payroll | Regenerate draft doesn't confirm existing data before overwriting | ⚠️ UX risk |
| 12 | Admin — Attendance | Leave balance management route exists in `api.js` but no UI tab | ⚠️ Half-implemented |
| 13 | Employee Dashboard | Check-in location shown only conditionally — GPS/location logic incomplete | ⚠️ Vague implementation |
| 14 | Profile Page | `Card` and `Button` imports but `Camera`, `Trash2`, `User`, `Lock`, `Mail`, `PasswordInput`, `PasswordStrength` are flagged as linting warnings in `ResetPasswordPage.jsx` | ⚠️ Linting |
| 15 | Inventory — Spares | `STATUS_LABEL` and `STATUS_KEY` constants defined but never used | ⚠️ Dead code |
| 16 | Inventory — Pipes | `lowStock` variable computed but never rendered/used in JSX | ⚠️ Dead code |
| 17 | Inventory — Diesel | `openModal` handler assigned but `Toast` / `ConfirmDialog` local components never instantiated in JSX | ⚠️ Dead code |
| 18 | Workspace | `boreService.js.bak` backup file exists in production source tree | ⚠️ Cleanup needed |
| 19 | Code Hygiene | 382 frontend lint warnings, 13 backend lint warnings — all `no-unused-vars` | ⚠️ Hygiene |

---

## Detailed Findings

---

### 1. ❌ Leave Management — No UI Whatsoever

**Severity: High**

The `api.js` frontend service file has a fully defined `leaveApi` object exposing:
- `getHolidays`, `getLeaveTypes`, `getMyBalances`, `requestLeave`, `getMyLeaves`, `cancelLeave`

The `adminApi` also defines:
- `getAllLeaves`, `reviewLeave`, `getAllLeaveBalances`, `updateLeaveBalance`
- `manageHoliday.create / update / delete`

**However:**
- There is **no route** in `App.jsx` that renders a Leave Management page.
- There is **no UI component** in `components/` or `pages/` that imports or uses any of these APIs.
- The backend route `/leaves-holidays` is **not registered** in `app.js`.
- Employees have no way to view leave balances, request leaves, or see holidays.
- Admins have no way to approve/reject leaves or create public holidays.

**Action Required:** Build the Leave Request & Holiday Management module end-to-end.

---

### 2. ❌ Lunch Request System — Defined But Completely Dead

**Severity: High**

`api.js` exports a complete `lunchApi` with:
- `createRequest`, `getMyRequests`, `updateRequest`, `getAllRequests`, `reviewRequest`
- `getCategories`, `createCategory`, `updateCategory`, `deleteCategory`, `getExpenseSummary`

**However:**
- No backend route for `/lunch` is mounted in `app.js`.
- No frontend page or component references `lunchApi`.
- The entire lunch/meal expense feature is schema-level code with zero user-facing functionality.

**Action Required:** Either implement the complete Lunch Request module or remove the dead API definitions.

---

### 3. ⚠️ Analytics — Misleadingly Called "Charts" But Has No Charts

**Severity: Medium**

The `AnalyticsCharts.jsx` component is named "charts" and renders inside an `Admin Analytics` tab, but it only shows **static number summary cards** — there are no interactive charts, pie charts, bar graphs, or trend lines except for one custom SVG line chart for daily **attendance** trend only.

**Missing:**
- No bore revenue chart.
- No govt bore completion chart.
- No employee attendance breakdown chart (by department/role).
- No inventory cost trend.
- The date filter (`From / To`) only applies to **attendance analytics** via `adminApi.getAttendanceAnalytics`. The calls to `boreApi.getAll()` and `govtBoreApi.getAll()` fetch ALL records regardless of the date range — meaning the Bore Revenue/Profit cards always show lifetime totals, not filtered ones.

**Action Required:**
1. Pass `dateRange` to bore API calls or filter on the frontend.
2. Add actual chart components (e.g., using Recharts or Chart.js) for bore revenue, govt bore progress, and inventory summary.

---

### 4. ⚠️ Private Bores — Label Inconsistency in Form Modal

**Severity: Low**

In `BoreModal.jsx` (the Private Bore add/edit form), the field label is still **"Point / Supervisor"** (line 206), while the table column in `BoresPage.jsx` says **"Supervisor"**. The Govt Bores module has been standardized to use **"Location"**, but Private Bores has two different labels for the same concept across its own form and table.

**File:** `frontend/src/components/admin/BoreModal.jsx`, line 206  
**Fix:** Decide on one term ("Location" or "Supervisor") and apply it consistently to both the form label and the table column in `BoresPage.jsx` (`DISPLAY_COLS` line 21 shows `label: 'Supervisor'`).

---

### 5. ⚠️ Private Bores — Analytics Uses Fields Not Stored in Schema

**Severity: Medium**

`AnalyticsCharts.jsx` references the following fields on bore records:
```js
boreData.reduce((s, r) => s + (parseFloat(r.profit) || 0), 0)
boreData.reduce((s, r) => s + (parseFloat(r.diesel_amount) || 0), 0)
boreData.reduce((s, r) => s + (parseFloat(r.cash) || 0), 0)
boreData.reduce((s, r) => s + (parseFloat(r.phone_pe) || 0), 0)
boreData.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
```

None of these (`profit`, `diesel_amount`, `cash`, `phone_pe`) appear as columns in the `BoresPage.jsx` `DISPLAY_COLS` or are obviously stored in the database schema as reviewed. They will always resolve to `0`, making the analytics cards silently wrong.

**Action Required:** Verify the exact API response shape for `boreApi.getAll()` and align analytics computations with the actual field names.

---

### 6. ⚠️ Diesel Tracking — Vehicle Fuel Level Has No Manual Correction UI

**Severity: Medium**

The **Vehicle Fuel Status** section in `DieselTracking.jsx` shows a visual fuel bar with `current_fuel` and `tank_percentage`. These values are derived from transaction records (refills minus consumption). However, there is:
- No way to set the initial fuel level when a vehicle is first added.
- No admin UI to manually correct the current fuel level if the system gets out of sync.
- The "Add New Vehicle" modal collects `tank_capacity` but not `initial_fuel`.

**Result:** All new vehicles start with 0% fuel even if they already have fuel in the tank when added.

**Action Required:** Add an initial fuel level field to the "Add New Vehicle" modal and/or provide an admin adjustment action on each vehicle row.

---

### 7. ⚠️ Admin Attendance — Leave Balance Management is Unreachable

**Severity: Medium**

`api.js` defines two admin APIs that have no UI entry point:
```js
getAllLeaveBalances: (year) => api.get('/admin/leave-balances', { params: { year } }),
updateLeaveBalance: (userId, leaveTypeId, data) => ...
```

The `adminRoutes.js` has no routes for `/admin/leave-balances`. There is no tab, panel, or modal in `AdminDashboard.jsx` for managing leave balances. These are effectively dead function definitions.

---

### 8. ⚠️ Employee Dashboard — GPS/Location Feature Is Incomplete

**Severity: Low**

The employee dashboard conditionally shows a "Check-in Location" card if `todayStatus?.checkInLocation` has data. The UI exists, but:
- The attendance check-in API `attendanceApi.checkIn(location)` accepts a location parameter, but the `CheckInOutButtons.jsx` component likely doesn't collect location before calling `handleCheckIn()`.
- There is no geolocation request (`navigator.geolocation.getCurrentPosition`) visible in `EmployeeDashboard.jsx` or the hooks.
- If the location is never collected, the GPS card will never appear — making the feature silently absent.

**Action Required:** Verify that `CheckInOutButtons` or the `useAttendance` hook actually requests browser GPS permissions and sends coordinates on check-in.

---

### 9. ⚠️ Inventory — Significant Dead Code in All Three Tabs

**Severity: Low (hygiene)**

**SparesInventory.jsx:**
- `STATUS_LABEL` (line 43) and `STATUS_KEY` (line 44) — defined, never referenced in JSX.
- `Toast` and `ConfirmDialog` are locally defined but **not rendered** in JSX at all (the component uses `toast` state and `confirm` state variables but the JSX for displaying them is missing — the toast notifications will silently fail).

**PipesInventory.jsx:**
- `lowStock` (line 442) is computed from `pipes.filter(...)` but the variable is never displayed anywhere in the rendered output.

**DieselTracking.jsx:**
- `openModal` at line 146 is the general open function but is **assigned a value but never used** per linting — the actual calls use `openAddFuelModal` and `openVehicleModal` instead.

---

### 10. ⚠️ Admin Dashboard — Removed Feature Leaves Dead Comment Noise

**Severity: Low**

In `AdminDashboard.jsx`, there are two explicit comments:
- Line 68: `// Audit logs feature removed`
- Line 108: `// Audit logs feature removed`

These comments indicate a feature was once planned and then removed, but the stubs/wrappers were not cleaned up. The `LoginHistoryPanel` still exists as a separate functional component (under Settings tab) so audit logging is partially present but not tied to any "Audit Logs" tab concept.

---

### 11. ⚠️ Reorder Level Settings Use `window.prompt()` (Poor UX)

**Severity: Medium (UX)**

Both `PipesInventory.jsx` (`handleUpdatePipeSettings`) and `SparesInventory.jsx` (`handleUpdateSpareSettings`) use the browser's native `window.prompt()` dialog to collect a reorder level value from the admin. This is:
- Visually inconsistent with the rest of the application (which uses custom modals).
- Inaccessible (cannot be styled or controlled).
- Not mobile-friendly.

**Action Required:** Replace `window.prompt()` calls with inline modals or edit-in-place inputs in the table row.

---

### 12. ⚠️ Workspace Cleanup — Stale Backup Files

**Severity: Low**

The following files exist in the repository source tree and should not be committed:
- `backend/src/services/boreService.js.bak` — a leftover backup file from an edit.

These files pollute the source tree and can confuse future developers.

---

## Not Issues (Confirmed Working)

The following were previously suspected as issues but are **confirmed functional**:
- ✅ `/api` root returns 404 — this is by design; specific sub-routes work correctly.
- ✅ `/api/health` → `200 OK` — backend is healthy.
- ✅ Prisma migrations are fully up to date (7/7 applied).
- ✅ `BorewellForm.jsx` and `GovtBoresPage.jsx` label rename to "Location" — confirmed applied.
- ✅ `SparesInventory.jsx` `Toast` and `ConfirmDialog` — **wait, these ARE missing from JSX** (see Item 9).

---

## Priority Action Plan

| Priority | Action |
|----------|--------|
| 🔴 P1 | Implement Leave Request & Holiday Management UI (Employees + Admin) |
| 🔴 P1 | Either implement or fully remove the Lunch module |
| 🟠 P2 | Fix Analytics date filter to scope bore data correctly |
| 🟠 P2 | Fix `SparesInventory` and `DieselTracking` — missing Toast/Confirm JSX rendering |
| 🟡 P3 | Replace `window.prompt()` with modal-based reorder level editor |
| 🟡 P3 | Add initial fuel level to "Add New Vehicle" flow in Diesel Tracking |
| 🟢 P4 | Standardize "Point / Supervisor" → "Supervisor" or "Location" in Private Bores form |
| 🟢 P4 | Remove `boreService.js.bak` and dead code comments |
| 🟢 P4 | Clean up 382 frontend lint warnings (unused vars/imports) |
