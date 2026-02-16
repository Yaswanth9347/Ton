import { google } from 'googleapis';
import path from 'path';

// Configuration
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Sheet1';
const KEY_FILE_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'secrets/google-credentials.json';

/**
 * Get authenticated Google Sheets client
 */
const getAuthClient = async () => {
    const auth = new google.auth.GoogleAuth({
        keyFile: KEY_FILE_PATH,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    return auth.getClient();
};

/**
 * Format date to DD/MM/YYYY
 */
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch (e) {
        return dateStr;
    }
};

/**
 * Safe value helper — converts null/undefined to empty string, numbers to string
 */
const sv = (val, defaultVal = '') => {
    if (val === null || val === undefined) return defaultVal;
    return String(val);
};

const sn = (val) => {
    if (val === null || val === undefined) return 0;
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
};

/**
 * Map record to Google Sheet row values
 * MUST match the exact column order of your Google Sheet header row.
 * All actual DB fields are included — no ghost fields.
 */
const mapRecordToRow = (record) => {
    return [
        // Column A: ID
        sv(record.id),
        // Column B: Mandal
        record.mandal?.name || sv(record.mandalId),
        // Column C: Village
        record.village?.name || sv(record.villageId),
        // Column D: Location
        sv(record.location),
        // Column E: Vehicle
        sv(record.vehicle),
        // Column F: Grant
        sv(record.grant),
        // Column G: Est. Cost
        sn(record.estCost),
        // Column H: M Book No
        sv(record.mBookNo),
        // Column I: Status
        sv(record.status),
        // Column J: Work Date
        formatDate(record.date),
        // Column K: Platform Date
        formatDate(record.platform_date),
        // Column L: Material Date
        formatDate(record.material_date),
        // Column M: Casing Type
        sv(record.casing_type),

        // Drilling (N, O, P)
        sn(record.drilling_depth_mtrs),
        sn(record.drilling_rate),
        sn(record.drilling_amount),

        // Casing 140 (Q, R, S)
        sn(record.casing140_qty),
        sn(record.casing140_rate),
        sn(record.casing140_amount),

        // Casing 180 (T, U, V)
        sn(record.casing180_qty),
        sn(record.casing180_rate),
        sn(record.casing180_amount),

        // Casing 250 (W, X, Y)
        sn(record.casing250_qty),
        sn(record.casing250_rate),
        sn(record.casing250_amount),

        // Bore Cap (Z, AA, AB)
        sn(record.borecap_qty),
        sn(record.borecap_rate),
        sn(record.borecap_amount),

        // Cylinders (AC, AD, AE)
        sn(record.cylinders_qty),
        sn(record.cylinders_rate),
        sn(record.cylinders_amount),

        // Erection (AF, AG, AH)
        sn(record.erection_qty),
        sn(record.erection_rate),
        sn(record.erection_amount),

        // Head & Handle (AI, AJ, AK)
        sn(record.head_handle_qty),
        sn(record.head_handle_rate),
        sn(record.head_handle_amount),

        // Plot/Farm (AL, AM, AN)
        sn(record.plotfarm_qty),
        sn(record.plotfarm_rate),
        sn(record.plotfarm_amount),

        // Pump Set (AO, AP, AQ)
        sn(record.pumpset_qty),
        sn(record.pumpset_rate),
        sn(record.pumpset_amount),

        // Slotting (AR, AS, AT)
        sn(record.slotting_qty),
        sn(record.slotting_rate),
        sn(record.slotting_amount),

        // Stand (AU, AV, AW)
        sn(record.stand_qty),
        sn(record.stand_rate),
        sn(record.stand_amount),

        // GI Pipes (AX, AY, AZ, BA)
        sv(record.pipe_company),
        sn(record.gi_pipes_qty),
        sn(record.gi_pipes_rate),
        sn(record.gi_pipes_amount),

        // Labour (BB, BC)
        sv(record.labour_type),
        sn(record.labour_amount),

        // PCs (BD)
        sn(record.pcs),

        // Gross Amount (BE)
        sn(record.gross_amount),

        // Billing (BF, BG, BH)
        sn(record.total_bill_amount),
        sn(record.first_part_amount),
        sn(record.second_part_amount),

        // Taxes (BI - BT)
        sn(record.cgst_percent),
        sn(record.cgst_amt),
        sn(record.sgst_percent),
        sn(record.sgst_amt),
        sn(record.igst_percent),
        sn(record.igst_amt),
        sn(record.gst_percent),
        sn(record.gst_amt),
        sn(record.sas_percent),
        sn(record.sas_amt),
        sn(record.it_percent),
        sn(record.it_amount),
        sn(record.vat_percent),
        sn(record.vat_amount),

        // Recoveries & Net (BU, BV)
        sn(record.total_recoveries),
        sn(record.net_amount),

        // Payment (BW - CA)
        sv(record.bank_name),
        sv(record.cheque_no),
        formatDate(record.cheque_date),
        formatDate(record.received_date),
        sv(record.voucher_no),

        // Remarks (CB)
        sv(record.remarks),
    ];
};

/**
 * Append a new record to Google Sheets
 */
export const appendRecord = async (record) => {
    try {
        if (!SPREADSHEET_ID) {
            console.warn('Skipping Google Sheets sync: GOOGLE_SHEET_ID not set.');
            return;
        }

        const client = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        const rowValues = mapRecordToRow(record);

        console.log(`[Sheets Sync] Appending ${rowValues.length} columns for Record ID ${record.id}`);

        const request = {
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:A`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [rowValues],
            },
        };

        const response = await sheets.spreadsheets.values.append(request);
        console.log(`[Sheets Sync] Successfully appended. Range: ${response.data.updates?.updatedRange}`);

    } catch (error) {
        handleError(error);
    }
};

/**
 * Update an existing record in Google Sheets
 * Finds the row by ID (Column A) and updates it.
 */
export const updateRecord = async (record) => {
    try {
        if (!SPREADSHEET_ID) return;

        const client = await getAuthClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        // 1. Fetch all IDs from Column A
        const idResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:A`,
        });

        const rows = idResponse.data.values || [];
        const recordIdStr = String(record.id);

        // 2. Find the row index (1-based for Sheets API)
        const rowIndex = rows.findIndex(row => row[0] == recordIdStr);

        if (rowIndex === -1) {
            console.warn(`[Sheets Sync] Record ID ${record.id} not found in Google Sheets. Appending instead.`);
            // Fallback: append if row not found (e.g., was created before sync was enabled)
            return await appendRecord(record);
        }

        const sheetRowNumber = rowIndex + 1;
        const rowValues = mapRecordToRow(record);

        console.log(`[Sheets Sync] Updating row ${sheetRowNumber} with ${rowValues.length} columns for Record ID ${record.id}`);

        // 3. Update the specific row
        const request = {
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A${sheetRowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [rowValues],
            },
        };

        const response = await sheets.spreadsheets.values.update(request);
        console.log(`[Sheets Sync] Successfully updated row ${sheetRowNumber} for Record ID ${record.id}.`);

    } catch (error) {
        handleError(error);
    }
};

const handleError = (error) => {
    console.error('[Sheets Sync] FAILED:', error.message);
    if (error.code === 404) {
        console.error('[Sheets Sync] Check if SPREADSHEET_ID is correct.');
    } else if (error.code === 401 || error.code === 403) {
        console.error('[Sheets Sync] Check if Service Account has permission to edit the sheet.');
    } else if (error.message.includes('not supported for this document')) {
        console.error('[Sheets Sync] TIP: Ensure your Google Sheet is a native Google Sheet (not an .xlsx file).');
    } else if (error.message.includes('Unable to parse range')) {
        console.error(`[Sheets Sync] TIP: Check if SHEET_NAME "${SHEET_NAME}" exists in your file.`);
    }
};
