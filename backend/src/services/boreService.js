import db from '../models/db.js';
import prisma from '../config/prisma.js';
import { releaseBorePipeAllocations, syncPrivateBorePipeInventory } from './pipeAllocationService.js';
import { ensurePrivateBoreSchema } from '../utils/ensurePrivateBoreSchema.js';

const asNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const asInteger = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Get all borewell records with optional search and pagination
 */
export const getAllRecords = async (search) => {
  let query = `
        SELECT * FROM borewell_data
        ORDER BY date DESC, created_at DESC
    `;
  const params = [];

  if (search) {
    query = `
            SELECT * FROM borewell_data
            WHERE customer_name ILIKE $1
               OR village ILIKE $1
               OR vehicle_name ILIKE $1
               OR supervisor_name ILIKE $1
               OR CAST(id AS TEXT) ILIKE $1
            ORDER BY date DESC, created_at DESC
        `;
    params.push(`%${search}%`);
  }

  const result = await db.query(query, params);
  return result.rows;
};

/**
 * Get a single borewell record by ID
 */
export const getRecordById = async (id) => {
  const result = await db.query('SELECT * FROM borewell_data WHERE id = CAST($1 AS INTEGER)', [id]);
  return result.rows[0] || null;
};

/**
 * Create a new borewell record
 */
export const createRecord = async (data, userId) => {
  await ensurePrivateBoreSchema();

  const pipeDetails = data.pipe_details ? (typeof data.pipe_details === 'string' ? data.pipe_details : JSON.stringify(data.pipe_details)) : '{}';
  const customData = data.custom_data ? (typeof data.custom_data === 'string' ? data.custom_data : JSON.stringify(data.custom_data)) : '{}';
  const result = await prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRawUnsafe(
      `INSERT INTO borewell_data (
            date, vehicle_name, supervisor_name, customer_name, village, phone_number, bore_type,
            drill_upto_casing_feet, drill_upto_casing_rate, drill_upto_casing_amt,
            empty_drilling_feet, empty_drilling_rate, empty_drilling_amt,
            jump_300_feet, jump_300_rate, jump_300_amt,
            jump_400_feet, jump_400_rate, jump_400_amt,
            total_drilling_feet, total_drilling_amt,
            cas140_feet, cas140_rate, cas140_amt,
            cas180_4g_feet, cas180_4g_rate, cas180_4g_amt,
            cas180_6g_feet, cas180_6g_rate, cas180_6g_amt,
            cas250_4g_feet, cas250_4g_rate, cas250_4g_amt,
            cas250_6g_feet, cas250_6g_rate, cas250_6g_amt,
            slotting_pipes, slotting_rate, slotting_amt,
            pipes_on_vehicle_before, pipes_used_qty, pipes_used_pieces_ft, pipes_left_on_vehicle,
            pipe_details, custom_data, pipe_inventory_id, labour_charge, rpm,
            start_time, end_time, total_hrs,
            phone_pe_received, phone_pe_receiver_name, cash_paid,
            total_amount, amount_paid, balance, discount,
            created_by
        ) VALUES (
            CAST($1 AS DATE), $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
            $41, $42, $43, CAST($44 AS JSONB), CAST($45 AS JSONB), $46, $47, $48, $49, $50,
            $51, $52, $53, $54, $55, $56, $57, $58, $59
        ) RETURNING *`,
      data.date, data.vehicle_name, data.supervisor_name, data.customer_name, data.village, data.phone_number, data.bore_type,
      asNumber(data.drill_upto_casing_feet), asNumber(data.drill_upto_casing_rate), asNumber(data.drill_upto_casing_amt),
      asNumber(data.empty_drilling_feet), asNumber(data.empty_drilling_rate), asNumber(data.empty_drilling_amt),
      0, 0, 0,  // jump_300 legacy fields — now stored in custom_data
      0, 0, 0,  // jump_400 legacy fields — now stored in custom_data
      asNumber(data.total_drilling_feet), asNumber(data.total_drilling_amt),
      asNumber(data.cas140_feet), asNumber(data.cas140_rate), asNumber(data.cas140_amt),
      asNumber(data.cas180_4g_feet), asNumber(data.cas180_4g_rate), asNumber(data.cas180_4g_amt),
      asNumber(data.cas180_6g_feet), asNumber(data.cas180_6g_rate), asNumber(data.cas180_6g_amt),
      asNumber(data.cas250_4g_feet), asNumber(data.cas250_4g_rate), asNumber(data.cas250_4g_amt),
      asNumber(data.cas250_6g_feet), asNumber(data.cas250_6g_rate), asNumber(data.cas250_6g_amt),
      asInteger(data.slotting_pipes), asNumber(data.slotting_rate), asNumber(data.slotting_amt),
      asInteger(data.pipes_on_vehicle_before), asInteger(data.pipes_used_qty), asNumber(data.pipes_used_pieces_ft), asInteger(data.pipes_left_on_vehicle),
      pipeDetails, customData, asInteger(data.pipe_inventory_id), asNumber(data.labour_charge), asNumber(data.rpm),
      data.start_time, data.end_time, asNumber(data.total_hrs),
      asNumber(data.phone_pe_received), data.phone_pe_receiver_name, asNumber(data.cash_paid),
      asNumber(data.total_amount), asNumber(data.amount_paid), asNumber(data.balance), asNumber(data.discount),
      userId
    );

    const record = inserted[0];
    await syncPrivateBorePipeInventory({ tx, currentRecord: record, createdBy: userId });
    return record;
  });
  
  return result;
};

/**
 * Update an existing borewell record
 */
export const updateRecord = async (id, data, userId) => {
  const previousRecord = await getRecordById(id);
  await ensurePrivateBoreSchema();

  const pipeDetails = data.pipe_details ? (typeof data.pipe_details === 'string' ? data.pipe_details : JSON.stringify(data.pipe_details)) : '{}';
  const customData = data.custom_data ? (typeof data.custom_data === 'string' ? data.custom_data : JSON.stringify(data.custom_data)) : '{}';
  const result = await prisma.$transaction(async (tx) => {
    const updatedRows = await tx.$queryRawUnsafe(
      `UPDATE borewell_data SET
            date = CAST($1 AS DATE), vehicle_name = $2, supervisor_name = $3, customer_name = $4, village = $5,
            phone_number = $6, bore_type = $7,
            drill_upto_casing_feet = $8, drill_upto_casing_rate = $9, drill_upto_casing_amt = $10,
            empty_drilling_feet = $11, empty_drilling_rate = $12, empty_drilling_amt = $13,
            jump_300_feet = $14, jump_300_rate = $15, jump_300_amt = $16,
            jump_400_feet = $17, jump_400_rate = $18, jump_400_amt = $19,
            total_drilling_feet = $20, total_drilling_amt = $21,
            cas140_feet = $22, cas140_rate = $23, cas140_amt = $24,
            cas180_4g_feet = $25, cas180_4g_rate = $26, cas180_4g_amt = $27,
            cas180_6g_feet = $28, cas180_6g_rate = $29, cas180_6g_amt = $30,
            cas250_4g_feet = $31, cas250_4g_rate = $32, cas250_4g_amt = $33,
            cas250_6g_feet = $34, cas250_6g_rate = $35, cas250_6g_amt = $36,
            slotting_pipes = $37, slotting_rate = $38, slotting_amt = $39,
            pipes_on_vehicle_before = $40, pipes_used_qty = $41, pipes_used_pieces_ft = $42, pipes_left_on_vehicle = $43,
            pipe_details = CAST($44 AS JSONB), custom_data = CAST($45 AS JSONB), pipe_inventory_id = $46, labour_charge = $47, rpm = $48,
            start_time = $49, end_time = $50, total_hrs = $51,
            phone_pe_received = $52, phone_pe_receiver_name = $53, cash_paid = $54,
            total_amount = $55, amount_paid = $56, balance = $57, discount = $58,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = CAST($59 AS INTEGER)
        RETURNING *`,
      data.date, data.vehicle_name, data.supervisor_name, data.customer_name, data.village,
      data.phone_number, data.bore_type,
      asNumber(data.drill_upto_casing_feet), asNumber(data.drill_upto_casing_rate), asNumber(data.drill_upto_casing_amt),
      asNumber(data.empty_drilling_feet), asNumber(data.empty_drilling_rate), asNumber(data.empty_drilling_amt),
      0, 0, 0,  // jump_300 legacy fields — now stored in custom_data
      0, 0, 0,  // jump_400 legacy fields — now stored in custom_data
      asNumber(data.total_drilling_feet), asNumber(data.total_drilling_amt),
      asNumber(data.cas140_feet), asNumber(data.cas140_rate), asNumber(data.cas140_amt),
      asNumber(data.cas180_4g_feet), asNumber(data.cas180_4g_rate), asNumber(data.cas180_4g_amt),
      asNumber(data.cas180_6g_feet), asNumber(data.cas180_6g_rate), asNumber(data.cas180_6g_amt),
      asNumber(data.cas250_4g_feet), asNumber(data.cas250_4g_rate), asNumber(data.cas250_4g_amt),
      asNumber(data.cas250_6g_feet), asNumber(data.cas250_6g_rate), asNumber(data.cas250_6g_amt),
      asInteger(data.slotting_pipes), asNumber(data.slotting_rate), asNumber(data.slotting_amt),
      asInteger(data.pipes_on_vehicle_before), asInteger(data.pipes_used_qty), asNumber(data.pipes_used_pieces_ft), asInteger(data.pipes_left_on_vehicle),
      pipeDetails, customData, asInteger(data.pipe_inventory_id), asNumber(data.labour_charge), asNumber(data.rpm),
      data.start_time, data.end_time, asNumber(data.total_hrs),
      asNumber(data.phone_pe_received), data.phone_pe_receiver_name, asNumber(data.cash_paid),
      asNumber(data.total_amount), asNumber(data.amount_paid), asNumber(data.balance), asNumber(data.discount),
      id
    );

    const record = updatedRows[0];
    await syncPrivateBorePipeInventory({ tx, currentRecord: record, previousRecord, createdBy: userId });
    return record;
  });

  return result;
};

/**
 * Delete a borewell record
 */
export const deleteRecord = async (id, userId) => {
  return await prisma.$transaction(async (tx) => {
    const [previousRecord] = await tx.$queryRawUnsafe('SELECT * FROM borewell_data WHERE id = CAST($1 AS INTEGER)', id);
    if (previousRecord) {
        await syncPrivateBorePipeInventory({ tx, currentRecord: null, previousRecord, createdBy: userId });
    }

    await releaseBorePipeAllocations({
      tx,
      boreType: 'private',
      boreId: id,
      createdBy: userId,
      remarks: `Auto-returned to store after deleting private bore #${id}`
    });

    // Delete associated allocations first to avoid SET NULL violating check constraints
    await tx.pipe_bore_allocations.deleteMany({
      where: {
        bore_type: 'private',
        private_bore_id: id
      }
    });

    await tx.spare_bore_allocations.deleteMany({
      where: {
        bore_type: 'private',
        private_bore_id: id
      }
    });

    const result = await tx.$queryRawUnsafe('DELETE FROM borewell_data WHERE id = CAST($1 AS INTEGER) RETURNING *', id);
    return result[0] || null;
  });
};

/**
 * Generate HTML receipt for a borewell record (JMJ Management style)
 */
export const generateBoreReceipt = (record) => {
  const date = record.date
    ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : 'N/A';

  const fmt = (v) => {
    const n = parseFloat(v) || 0;
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${record.customer_name || 'Bore'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; padding: 40px; max-width: 900px; margin: 0 auto; background: #fff; line-height: 1.5; }
    .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { color: #1e40af; font-size: 26px; }
    .header p { color: #64748b; margin-top: 5px; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section-title { font-size: 13px; font-weight: 700; color: #1e40af; text-transform: uppercase; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .info-item { }
    .info-label { font-size: 11px; color: #64748b; text-transform: uppercase; }
    .info-value { font-size: 14px; color: #0f172a; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-top: 5px; }
    th, td { padding: 8px 10px; text-align: left; border: 1px solid #e2e8f0; }
    th { background: #f8fafc; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    td { font-size: 13px; color: #334155; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .bg-blue { background: #eff6ff; }
    .total-row { background: #f1f5f9; font-weight: 700; font-size: 14px; }
    .payment-summary { display: flex; justify-content: flex-end; }
    .payment-table { width: 350px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 11px; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>JMJ BORE WELLS</h1>
    <p>Private Borewell Drilling & Services Receipt</p>
  </div>

  <div class="section">
    <div class="section-title">Basic Details</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Date</div><div class="info-value">${date}</div></div>
      <div class="info-item"><div class="info-label">Vehicle Name</div><div class="info-value">${record.vehicle_name || 'N/A'}</div></div>
      <div class="info-item"><div class="info-label">Supervisor</div><div class="info-value">${record.supervisor_name || 'N/A'}</div></div>
      <div class="info-item"><div class="info-label">Customer Name</div><div class="info-value">${record.customer_name || 'N/A'}</div></div>
      <div class="info-item"><div class="info-label">Village</div><div class="info-value">${record.village || 'N/A'}</div></div>
      <div class="info-item"><div class="info-label">Phone</div><div class="info-value">${record.phone_number || 'N/A'}</div></div>
      <div class="info-item"><div class="info-label">Bore Type</div><div class="info-value">${record.bore_type || 'N/A'}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Drilling Details</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Feet (ft)</th>
          <th class="text-right">Rate (₹)</th>
          <th class="text-right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Drilling up to Casing</td>
          <td class="text-right">${record.drill_upto_casing_feet}</td>
          <td class="text-right">${fmt(record.drill_upto_casing_rate)}</td>
          <td class="text-right">${fmt(record.drill_upto_casing_amt)}</td>
        </tr>
        <tr>
          <td>Empty Drilling</td>
          <td class="text-right">${record.empty_drilling_feet}</td>
          <td class="text-right">${fmt(record.empty_drilling_rate)}</td>
          <td class="text-right">${fmt(record.empty_drilling_amt)}</td>
        </tr>
        ${(() => {
          let cData = record.custom_data;
          if (typeof cData === 'string') { try { cData = JSON.parse(cData); } catch { cData = {}; } }
          const rows = (cData && Array.isArray(cData.drilling)) ? cData.drilling : [];
          return rows.map(row => `
        <tr>
          <td>${row.label || 'Jump Rate'}</td>
          <td class="text-right">${parseFloat(row.feet) || 0}</td>
          <td class="text-right">${fmt(row.rate)}</td>
          <td class="text-right">${fmt(row.amt)}</td>
        </tr>`).join('');
        })()}
        <tr class="total-row">
          <td>Total Drilling</td>
          <td class="text-right">${record.total_drilling_feet} ft</td>
          <td></td>
          <td class="text-right">₹${fmt(record.total_drilling_amt)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Casing & Slotting</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Qty/Feet</th>
          <th class="text-right">Rate (₹)</th>
          <th class="text-right">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${record.cas140_feet > 0 ? `<tr><td>140mm Casing</td><td class="text-right">${record.cas140_feet}</td><td class="text-right">${fmt(record.cas140_rate)}</td><td class="text-right">${fmt(record.cas140_amt)}</td></tr>` : ''}
        ${record.cas180_4g_feet > 0 ? `<tr><td>180mm 4G Casing</td><td class="text-right">${record.cas180_4g_feet}</td><td class="text-right">${fmt(record.cas180_4g_rate)}</td><td class="text-right">${fmt(record.cas180_4g_amt)}</td></tr>` : ''}
        ${record.cas180_6g_feet > 0 ? `<tr><td>180mm 6G Casing</td><td class="text-right">${record.cas180_6g_feet}</td><td class="text-right">${fmt(record.cas180_6g_rate)}</td><td class="text-right">${fmt(record.cas180_6g_amt)}</td></tr>` : ''}
        ${record.cas250_4g_feet > 0 ? `<tr><td>250mm/10 inches 4kg Casing</td><td class="text-right">${record.cas250_4g_feet}</td><td class="text-right">${fmt(record.cas250_4g_rate)}</td><td class="text-right">${fmt(record.cas250_4g_amt)}</td></tr>` : ''}
        ${record.cas250_6g_feet > 0 ? `<tr><td>250mm/10 inches 6kg Casing</td><td class="text-right">${record.cas250_6g_feet}</td><td class="text-right">${fmt(record.cas250_6g_rate)}</td><td class="text-right">${fmt(record.cas250_6g_amt)}</td></tr>` : ''}
        ${record.slotting_pipes > 0 ? `<tr><td>Slotting</td><td class="text-right">${record.slotting_pipes} pipes</td><td class="text-right">${fmt(record.slotting_rate)}</td><td class="text-right">${fmt(record.slotting_amt)}</td></tr>` : ''}
      </tbody>
    </table>
  </div>

  ${(() => {
    let cData = record.custom_data;
    if (typeof cData === 'string') { try { cData = JSON.parse(cData); } catch { cData = {}; } }
    const pipes = (cData && Array.isArray(cData.pipes_tracking)) ? cData.pipes_tracking : [];
    
    // Legacy fallback mapping
    if (pipes.length === 0 && (record.pipes_used_qty > 0 || record.pipes_on_vehicle_before > 0)) {
       let pipeDetails = record.pipe_details;
       if (typeof pipeDetails === 'string') { try { pipeDetails = JSON.parse(pipeDetails); } catch { pipeDetails = {}; } }
       pipes.push({
           source: 'Home Stock (Legacy)',
           company_name: pipeDetails?.company || 'N/A',
           pipe_size: '',
           on_vehicle: record.pipes_on_vehicle_before,
           used_nos: record.pipes_used_qty,
           used_ft: record.pipes_used_pieces_ft,
           left_auto: record.pipes_left_on_vehicle
       });
    }

    if (pipes.length === 0) return '';

    return `
    <div class="section">
      <div class="section-title">Pipes Tracking</div>
      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Details (Company/Size)</th>
            <th class="text-right">On Vehicle</th>
            <th class="text-right">Used (Nos)</th>
            <th class="text-right">Used (Ft)</th>
            <th class="text-right">Left</th>
          </tr>
        </thead>
        <tbody>
          ${pipes.map(p => `
          <tr>
            <td>${p.source || 'N/A'}</td>
            <td>
              ${p.source === 'Borrowed' ? `Borrowed From: ${p.borrowed_from || 'N/A'} <br/>` : ''}
              ${p.company_name || 'N/A'} ${p.pipe_size ? '(' + p.pipe_size + ')' : ''}
              ${p.remarks ? `<br/><span style="font-size: 11px; color: #64748b;">Remarks: ${p.remarks}</span>` : ''}
            </td>
            <td class="text-right">${p.on_vehicle || 0}</td>
            <td class="text-right">${p.used_nos || 0}</td>
            <td class="text-right">${p.used_ft || 0}</td>
            <td class="text-right">${p.left_auto || 0}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  })()}

  <div class="section">
    <div class="section-title">Misc Details</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Labour Charge</div><div class="info-value">₹${fmt(record.labour_charge)}</div></div>
      <div class="info-item"><div class="info-label">RPM</div><div class="info-value">${record.rpm}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Payment Summary</div>
    <div class="payment-summary">
      <table class="payment-table">
        <tbody>
          <tr><td class="font-bold">Total Amount</td><td class="text-right font-bold">₹${fmt(record.total_amount)}</td></tr>
          <tr><td>Amount Paid</td><td class="text-right">₹${fmt(record.amount_paid)}</td></tr>
          <tr><td>Discount</td><td class="text-right">₹${fmt(record.discount)}</td></tr>
          <tr class="total-row bg-blue"><td>Balance Outstanding</td><td class="text-right font-bold">₹${fmt(record.balance)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <p>This is a computer-generated receipt. Thank you for choosing JMJ BORE WELLS!</p>
    <p style="margin-top: 5px;">Printed on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}</p>
  </div>
  <script>window.print();</script>
</body>
</html>`;
  return html;
};

