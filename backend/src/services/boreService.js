import db from '../models/db.js';

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
  const result = await db.query('SELECT * FROM borewell_data WHERE id = $1', [id]);
  return result.rows[0] || null;
};

/**
 * Create a new borewell record
 */
export const createRecord = async (data, userId) => {
  const result = await db.query(
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
            slotting_pipes, slotting_rate, slotting_amt,
            pipes_on_vehicle_before, pipes_used_qty, pipes_used_pieces_ft, pipes_left_on_vehicle,
            pipe_details, labour_charge, rpm,
            start_time, end_time, total_hrs,
            phone_pe_received, phone_pe_receiver_name, cash_paid,
            total_amount, amount_paid, balance, discount,
            created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
            $41, $42, $43, $44, $45, $46, $47, $48, $49, $50,
            $51, $52, $53, $54
        ) RETURNING *`,
    [
      data.date, data.vehicle_name, data.supervisor_name, data.customer_name, data.village, data.phone_number, data.bore_type,
      data.drill_upto_casing_feet || 0, data.drill_upto_casing_rate || 0, data.drill_upto_casing_amt || 0,
      data.empty_drilling_feet || 0, data.empty_drilling_rate || 0, data.empty_drilling_amt || 0,
      data.jump_300_feet || 0, data.jump_300_rate || 0, data.jump_300_amt || 0,
      data.jump_400_feet || 0, data.jump_400_rate || 0, data.jump_400_amt || 0,
      data.total_drilling_feet || 0, data.total_drilling_amt || 0,
      data.cas140_feet || 0, data.cas140_rate || 0, data.cas140_amt || 0,
      data.cas180_4g_feet || 0, data.cas180_4g_rate || 0, data.cas180_4g_amt || 0,
      data.cas180_6g_feet || 0, data.cas180_6g_rate || 0, data.cas180_6g_amt || 0,
      data.cas250_4g_feet || 0, data.cas250_4g_rate || 0, data.cas250_4g_amt || 0,
      data.slotting_pipes || 0, data.slotting_rate || 0, data.slotting_amt || 0,
      data.pipes_on_vehicle_before || 0, data.pipes_used_qty || 0, data.pipes_used_pieces_ft || 0, data.pipes_left_on_vehicle || 0,
      data.pipe_details || {}, data.labour_charge || 0, data.rpm || 0,
      data.start_time, data.end_time, data.total_hrs || 0,
      data.phone_pe_received || 0, data.phone_pe_receiver_name, data.cash_paid || 0,
      data.total_amount || 0, data.amount_paid || 0, data.balance || 0, data.discount || 0,
      userId
    ]
  );
  return result.rows[0];
};

/**
 * Update an existing borewell record
 */
export const updateRecord = async (id, data) => {
  const result = await db.query(
    `UPDATE borewell_data SET
            date = $1, vehicle_name = $2, supervisor_name = $3, customer_name = $4, village = $5,
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
            slotting_pipes = $34, slotting_rate = $35, slotting_amt = $36,
            pipes_on_vehicle_before = $37, pipes_used_qty = $38, pipes_used_pieces_ft = $39, pipes_left_on_vehicle = $40,
            pipe_details = $41, labour_charge = $42, rpm = $43,
            start_time = $44, end_time = $45, total_hrs = $46,
            phone_pe_received = $47, phone_pe_receiver_name = $48, cash_paid = $49,
            total_amount = $50, amount_paid = $51, balance = $52, discount = $53,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $54
        RETURNING *`,
    [
      data.date, data.vehicle_name, data.supervisor_name, data.customer_name, data.village,
      data.phone_number, data.bore_type,
      data.drill_upto_casing_feet || 0, data.drill_upto_casing_rate || 0, data.drill_upto_casing_amt || 0,
      data.empty_drilling_feet || 0, data.empty_drilling_rate || 0, data.empty_drilling_amt || 0,
      data.jump_300_feet || 0, data.jump_300_rate || 0, data.jump_300_amt || 0,
      data.jump_400_feet || 0, data.jump_400_rate || 0, data.jump_400_amt || 0,
      data.total_drilling_feet || 0, data.total_drilling_amt || 0,
      data.cas140_feet || 0, data.cas140_rate || 0, data.cas140_amt || 0,
      data.cas180_4g_feet || 0, data.cas180_4g_rate || 0, data.cas180_4g_amt || 0,
      data.cas180_6g_feet || 0, data.cas180_6g_rate || 0, data.cas180_6g_amt || 0,
      data.cas250_4g_feet || 0, data.cas250_4g_rate || 0, data.cas250_4g_amt || 0,
      data.slotting_pipes || 0, data.slotting_rate || 0, data.slotting_amt || 0,
      data.pipes_on_vehicle_before || 0, data.pipes_used_qty || 0, data.pipes_used_pieces_ft || 0, data.pipes_left_on_vehicle || 0,
      data.pipe_details || {}, data.labour_charge || 0, data.rpm || 0,
      data.start_time, data.end_time, data.total_hrs || 0,
      data.phone_pe_received || 0, data.phone_pe_receiver_name, data.cash_paid || 0,
      data.total_amount || 0, data.amount_paid || 0, data.balance || 0, data.discount || 0,
      id
    ]
  );
  return result.rows[0];
};

/**
 * Delete a borewell record
 */
export const deleteRecord = async (id) => {
  const result = await db.query('DELETE FROM borewell_data WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
};

/**
 * Generate HTML receipt for a borewell record (JMJ Management style)
 */
export const generateBoreReceipt = (record) => {
  const date = record.date
    ? new Date(record.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';

  const fmt = (v) => {
    const n = parseFloat(v) || 0;
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const pipeDetails = typeof record.pipe_details === 'string' ? JSON.parse(record.pipe_details || '{}') : (record.pipe_details || {});
  const pipeDetailsHtml = Object.entries(pipeDetails).map(([key, val]) => `
    <div class="info-item">
      <div class="info-label">${key}</div>
      <div class="info-value">${val}</div>
    </div>
  `).join('');

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
        <tr>
          <td>Jump after 300ft</td>
          <td class="text-right">${record.jump_300_feet}</td>
          <td class="text-right">${fmt(record.jump_300_rate)}</td>
          <td class="text-right">${fmt(record.jump_300_amt)}</td>
        </tr>
        <tr>
          <td>Jump after 400ft</td>
          <td class="text-right">${record.jump_400_feet}</td>
          <td class="text-right">${fmt(record.jump_400_rate)}</td>
          <td class="text-right">${fmt(record.jump_400_amt)}</td>
        </tr>
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
        ${record.cas250_4g_feet > 0 ? `<tr><td>250mm 4G Casing</td><td class="text-right">${record.cas250_4g_feet}</td><td class="text-right">${fmt(record.cas250_4g_rate)}</td><td class="text-right">${fmt(record.cas250_4g_amt)}</td></tr>` : ''}
        ${record.slotting_pipes > 0 ? `<tr><td>Slotting</td><td class="text-right">${record.slotting_pipes} pipes</td><td class="text-right">${fmt(record.slotting_rate)}</td><td class="text-right">${fmt(record.slotting_amt)}</td></tr>` : ''}
      </tbody>
    </table>
  </div>

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
    <p style="margin-top: 5px;">Printed on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>
  <script>window.print();</script>
</body>
</html>`;
  return html;
};

