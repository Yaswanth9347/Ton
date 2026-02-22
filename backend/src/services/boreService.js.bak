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
            WHERE client_name ILIKE $1
               OR village ILIKE $1
               OR point_name ILIKE $1
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
            date, client_name, village, total_feet, fell_feet, pipes,
            amount, cash, phone_pe, pending,
            point_name, diesel, diesel_amount, commission, profit,
            created_by
        ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13, $14, $15,
            $16
        ) RETURNING *`,
        [
            data.date,
            data.client_name,
            data.village,
            data.total_feet || 0,
            data.fell_feet || 0,
            data.pipes || 0,
            data.amount || 0,
            data.cash || 0,
            data.phone_pe || 0,
            data.pending || 0,
            data.point_name,
            data.diesel || 0,
            data.diesel_amount || 0,
            data.commission || 0,
            data.profit || 0,
            userId,
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
            date = $1,
            client_name = $2,
            village = $3,
            total_feet = $4,
            fell_feet = $5,
            pipes = $6,
            amount = $7,
            cash = $8,
            phone_pe = $9,
            pending = $10,
            point_name = $11,
            diesel = $12,
            diesel_amount = $13,
            commission = $14,
            profit = $15,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $16
        RETURNING *`,
        [
            data.date,
            data.client_name,
            data.village,
            data.total_feet || 0,
            data.fell_feet || 0,
            data.pipes || 0,
            data.amount || 0,
            data.cash || 0,
            data.phone_pe || 0,
            data.pending || 0,
            data.point_name,
            data.diesel || 0,
            data.diesel_amount || 0,
            data.commission || 0,
            data.profit || 0,
            id,
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
        return n.toLocaleString('en-IN');
    };

    const amount = parseFloat(record.amount) || 0;
    const cash = parseFloat(record.cash) || 0;
    const phonePe = parseFloat(record.phone_pe) || 0;
    const totalPaid = cash + phonePe;
    const pending = parseFloat(record.pending) || 0;
    const diesel = parseFloat(record.diesel) || 0;
    const dieselAmount = parseFloat(record.diesel_amount) || 0;
    const commission = parseFloat(record.commission) || 0;
    const profit = parseFloat(record.profit) || 0;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${record.client_name || 'Bore'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #1e40af; font-size: 28px; }
    .header p { color: #64748b; margin-top: 5px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: 600; color: #1e40af; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.5px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .info-item { }
    .info-label { font-size: 12px; color: #64748b; }
    .info-value { font-size: 15px; color: #0f172a; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
    th { background: #f1f5f9; font-size: 12px; text-transform: uppercase; color: #64748b; }
    td { font-size: 14px; }
    .text-right { text-align: right; }
    .total-row { background: #f1f5f9; font-weight: 600; }
    .grand-total { background: #1e40af; color: white; }
    .paid-row { background: #059669; color: white; font-weight: 600; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .badge-paid { background: #d1fae5; color: #059669; }
    .badge-pending { background: #fee2e2; color: #dc2626; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>JMJ Bore Wells</h1>
    <p>Borewell Drilling Services</p>
  </div>

  <div class="section">
    <div class="section-title">Customer Details</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Customer Name</div>
        <div class="info-value">${record.client_name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Village</div>
        <div class="info-value">${record.village || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Point / Supervisor</div>
        <div class="info-value">${record.point_name || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Date</div>
        <div class="info-value">${date}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Drilling Details</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Total Feet</div>
        <div class="info-value">${fmt(record.total_feet)} ft</div>
      </div>
      <div class="info-item">
        <div class="info-label">Fell Feet</div>
        <div class="info-value">${fmt(record.fell_feet)} ft</div>
      </div>
      <div class="info-item">
        <div class="info-label">Pipes Used</div>
        <div class="info-value">${fmt(record.pipes)} nos</div>
      </div>
      <div class="info-item">
        <div class="info-label">Status</div>
        <div class="info-value">
          <span class="badge ${pending <= 0 ? 'badge-paid' : 'badge-pending'}">
            ${pending <= 0 ? 'FULLY PAID' : 'PENDING'}
          </span>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Billing Summary</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Total Amount</td>
          <td class="text-right">₹${fmt(amount)}</td>
        </tr>
        <tr>
          <td>Cash Payment</td>
          <td class="text-right">₹${fmt(cash)}</td>
        </tr>
        <tr>
          <td>PhonePe Payment</td>
          <td class="text-right">₹${fmt(phonePe)}</td>
        </tr>
        <tr class="total-row">
          <td>Total Paid</td>
          <td class="text-right">₹${fmt(totalPaid)}</td>
        </tr>
        <tr class="grand-total">
          <td>Pending</td>
          <td class="text-right">₹${fmt(pending)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Expenses & Profit</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Diesel (${fmt(diesel)} L)</td>
          <td class="text-right">₹${fmt(dieselAmount)}</td>
        </tr>
        <tr>
          <td>Commission</td>
          <td class="text-right">₹${fmt(commission)}</td>
        </tr>
        <tr class="paid-row">
          <td>Profit</td>
          <td class="text-right">₹${fmt(profit)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>Thank you for choosing JMJ Bore Wells!</p>
    <p style="margin-top: 5px;">Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>

  <script>window.print();</script>
</body>
</html>
    `;

    return html;
};
