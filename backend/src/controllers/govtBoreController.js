import * as govtBoreService from '../services/govtBoreService.js';
import * as googleSheetsService from '../services/googleSheetsService.js';



/**
 * Get all govt bore records
 * GET /api/govt-bores
 */
export const getAllRecords = async (req, res, next) => {
    try {
        const { search } = req.query;
        const records = await govtBoreService.getAllRecords(search);

        res.json({
            success: true,
            data: records,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get a single govt bore record
 * GET /api/govt-bores/:id
 */
export const getRecord = async (req, res, next) => {
    try {
        const record = await govtBoreService.getRecordById(req.params.id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Record not found',
            });
        }

        res.json({
            success: true,
            data: record,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create a new govt bore record
 * POST /api/govt-bores
 */
export const createRecord = async (req, res, next) => {
    try {
        const { mandal, village, location, vehicle } = req.body;
        if (!mandal || !village || !location || !vehicle) {
            return res.status(400).json({
                success: false,
                message: 'Mandatory fields missing: Mandal, Village, Location, Vehicle'
            });
        }

        // --- Backend Validation & Recalculation ---
        // Ensure amounts match qty * rate to prevent client-side errors/tampering
        const recalculateRow = (data, qtyKey, rateKey, amtKey) => {
            const qty = parseFloat(data[qtyKey]) || 0;
            const rate = parseFloat(data[rateKey]) || 0;
            if (qty > 0 && rate > 0) {
                data[amtKey] = (qty * rate).toFixed(2);
            }
        };

        // Standard Rows
        recalculateRow(req.body, 'drilling_depth_mtrs', 'drilling_rate', 'drilling_amount');
        ['casing180', 'casing140', 'casing250', 'borecap', 'cylinders', 'erection',
            'head_handle', 'plotfarm', 'pumpset', 'slotting', 'stand', 'gi_pipes'].forEach(prefix => {
                recalculateRow(req.body, `${prefix}_qty`, `${prefix}_rate`, `${prefix}_amount`);
            });

        // Recalculate Gross Amount
        // Note: We can't easily recalculate custom rows here without parsing custom_data
        // For now, we trust the frontend's gross_amount but validated standard rows
        // ------------------------------------------

        const record = await govtBoreService.createRecord(req.body);

        // Async Sync to Google Sheets (Non-blocking)
        googleSheetsService.appendRecord(record).catch(err => console.error('bg-sync error:', err));

        res.status(201).json({
            success: true,
            data: record,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update a govt bore record
 * PUT /api/govt-bores/:id
 */
export const updateRecord = async (req, res, next) => {
    try {
        const { mandal, village, location, vehicle } = req.body;
        // Basic validation for updates too
        if (!mandal || !village || !location || !vehicle) {
            return res.status(400).json({
                success: false,
                message: 'Mandatory fields missing: Mandal, Village, Location, Vehicle'
            });
        }

        // --- Backend Validation & Recalculation ---
        const recalculateRow = (data, qtyKey, rateKey, amtKey) => {
            const qty = parseFloat(data[qtyKey]); // Use strictly passed values
            const rate = parseFloat(data[rateKey]);
            // Only update if both are provided/valid numbers in the update payload
            // Note: This is partial update safe only if both qty/rate are sent. 
            // Ideally we'd need current DB state for partials, but for full form submits this works.
            if (!isNaN(qty) && !isNaN(rate)) {
                data[amtKey] = (qty * rate).toFixed(2);
            }
        };

        recalculateRow(req.body, 'drilling_depth_mtrs', 'drilling_rate', 'drilling_amount');
        ['casing180', 'casing140', 'casing250', 'borecap', 'cylinders', 'erection',
            'head_handle', 'plotfarm', 'pumpset', 'slotting', 'stand', 'gi_pipes'].forEach(prefix => {
                recalculateRow(req.body, `${prefix}_qty`, `${prefix}_rate`, `${prefix}_amount`);
            });
        // ------------------------------------------

        const record = await govtBoreService.updateRecord(req.params.id, req.body);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Record not found',
            });
        }

        // Async Sync to Google Sheets (Update for backup)
        googleSheetsService.updateRecord(record).catch(err => console.error('bg-sync update error:', err));

        res.json({
            success: true,
            data: record,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Delete a govt bore record
 * DELETE /api/govt-bores/:id
 */
export const deleteRecord = async (req, res, next) => {
    try {
        const record = await govtBoreService.deleteRecord(req.params.id);

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Record not found',
            });
        }

        res.json({
            success: true,
            message: 'Record deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};





/**
 * Get all mandals
 * GET /api/govt-bores/mandals
 */
export const getMandals = async (req, res, next) => {
    try {
        const mandals = await govtBoreService.getMandals();
        res.json({
            success: true,
            data: mandals,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all villages for a mandal
 * GET /api/govt-bores/mandals/:id/villages
 */
export const getVillages = async (req, res, next) => {
    try {
        const villages = await govtBoreService.getVillagesByMandal(req.params.id);
        res.json({
            success: true,
            data: villages,
        });
    } catch (error) {
        next(error);
    }
};


