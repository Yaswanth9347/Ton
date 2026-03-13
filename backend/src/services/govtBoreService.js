/**
 * Govt Bore Service - Flattened Excel Model
 *
 * Resilient to missing pipe_company_id / geologist columns.
 * When columns are absent (e.g. un-migrated production DB), every operation
 * automatically falls back to raw SQL via Prisma's own connection.
 */

import prisma from '../config/prisma.js';
import { ensureGovtBoreSchema, hasPipeCompanyColumn } from '../utils/ensureGovtBoreSchema.js';
import { releaseBorePipeAllocations, syncGovtBorePipeInventory } from './pipeAllocationService.js';
import { releaseBoreSpareAllocations, syncGovtBoreSpareInventory } from './spareAllocationService.js';
import { releaseGovtBoreDieselAllocation, syncGovtBoreDieselInventory } from './dieselSyncService.js';

// Safe numeric parsers: return null for empty/invalid values, undefined for missing keys.
// Prevents NaN from reaching Prisma which would crash the query.
const safeInt = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};
const safeFloat = (v) => {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
};

// =============================================
// ERROR DETECTION
// =============================================
function isMissingColumnError(error) {
  return error?.code === 'P2022';
}

async function tableExists(tableName) {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT 1 AS ok
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = '${tableName}'
      LIMIT 1
    `);
    return rows.length > 0;
  } catch {
    return false;
  }
}

// =============================================
// RAW-SQL FALLBACK QUERIES (use Prisma connection)
// =============================================
async function getAllRecordsFallback() {
  return await prisma.$queryRawUnsafe(`
    SELECT
      bw.*,
      json_build_object('id', m.id, 'name', m.name) AS mandal,
      json_build_object('id', v.id, 'name', v.name, 'mandalId', v."mandalId") AS village,
      NULL::json AS pipe_company_ref
    FROM "BorewellWork" bw
    LEFT JOIN "Mandal" m ON m.id = bw."mandalId"
    LEFT JOIN "Village" v ON v.id = bw."villageId"
    ORDER BY bw.id DESC
  `);
}

async function getRecordByIdFallback(id) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      bw.*,
      json_build_object('id', m.id, 'name', m.name) AS mandal,
      json_build_object('id', v.id, 'name', v.name, 'mandalId', v."mandalId") AS village,
      NULL::json AS pipe_company_ref
    FROM "BorewellWork" bw
    LEFT JOIN "Mandal" m ON m.id = bw."mandalId"
    LEFT JOIN "Village" v ON v.id = bw."villageId"
    WHERE bw.id = $1
    LIMIT 1
  `, parseInt(id));

  return rows[0] || null;
}

async function getAllRecordsLegacyFallback() {
  return await prisma.$queryRawUnsafe(`
    SELECT
      g.id,
      g.s_no AS "sNo",
      g.vehicle,
      g.bore_date AS "date",
      g.location,
      g.grant_name AS grant,
      g.est_cost AS "estCost",
      g.drill_depth AS drilling_depth_mtrs,
      g.drill_rate AS drilling_rate,
      g.drill_amt AS drilling_amount,
      g.cas140_depth AS casing140_qty,
      g.cas140_rate AS casing140_rate,
      g.cas140_amt AS casing140_amount,
      g.cas180_depth AS casing180_qty,
      g.cas180_rate AS casing180_rate,
      g.cas180_amt AS casing180_amount,
      g.slot_qty AS slotting_qty,
      g.slot_rate AS slotting_rate,
      g.slot_amt AS slotting_amount,
      g.gi_qty AS gi_pipes_qty,
      g.gi_rate AS gi_pipes_rate,
      g.gi_amt AS gi_pipes_amount,
      g.total_amt,
      g.status,
      g.m_book_no AS "mBookNo",
      g.total_bill_amt AS total_bill_amount,
      g.first_part AS first_part_amount,
      g.second_part AS second_part_amount,
      g.it AS it_amount,
      g.vat AS vat_amount,
      g.total_recoveries,
      g.net_amount,
      g.voucher_no,
      g.cheque_no_date AS cheque_no,
      g.custom_data,
      g.created_at AS "createdAt",
      g.updated_at AS "updatedAt",
      NULL::json AS mandal,
      json_build_object('id', NULL, 'name', g.village, 'mandalId', NULL) AS village,
      NULL::json AS pipe_company_ref,
      NULL::integer AS pipe_company_id,
      NULL::text AS geologist
    FROM govt_bores g
    ORDER BY g.id DESC
  `);
}

async function getRecordByIdLegacyFallback(id) {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      g.id,
      g.s_no AS "sNo",
      g.vehicle,
      g.bore_date AS "date",
      g.location,
      g.grant_name AS grant,
      g.est_cost AS "estCost",
      g.drill_depth AS drilling_depth_mtrs,
      g.drill_rate AS drilling_rate,
      g.drill_amt AS drilling_amount,
      g.cas140_depth AS casing140_qty,
      g.cas140_rate AS casing140_rate,
      g.cas140_amt AS casing140_amount,
      g.cas180_depth AS casing180_qty,
      g.cas180_rate AS casing180_rate,
      g.cas180_amt AS casing180_amount,
      g.slot_qty AS slotting_qty,
      g.slot_rate AS slotting_rate,
      g.slot_amt AS slotting_amount,
      g.gi_qty AS gi_pipes_qty,
      g.gi_rate AS gi_pipes_rate,
      g.gi_amt AS gi_pipes_amount,
      g.total_amt,
      g.status,
      g.m_book_no AS "mBookNo",
      g.total_bill_amt AS total_bill_amount,
      g.first_part AS first_part_amount,
      g.second_part AS second_part_amount,
      g.it AS it_amount,
      g.vat AS vat_amount,
      g.total_recoveries,
      g.net_amount,
      g.voucher_no,
      g.cheque_no_date AS cheque_no,
      g.custom_data,
      g.created_at AS "createdAt",
      g.updated_at AS "updatedAt",
      NULL::json AS mandal,
      json_build_object('id', NULL, 'name', g.village, 'mandalId', NULL) AS village,
      NULL::json AS pipe_company_ref,
      NULL::integer AS pipe_company_id,
      NULL::text AS geologist
    FROM govt_bores g
    WHERE g.id = $1
    LIMIT 1
  `, parseInt(id));

  return rows[0] || null;
}

// Helper: Find or create Mandal and Village
async function findOrCreateLocation(tx, mandalName, villageName) {
  let mandal = await tx.mandal.findUnique({ where: { name: mandalName } });
  if (!mandal) {
    mandal = await tx.mandal.create({ data: { name: mandalName } });
  }

  let village = await tx.village.findFirst({
    where: { name: villageName, mandalId: mandal.id }
  });
  if (!village) {
    village = await tx.village.create({
      data: { name: villageName, mandalId: mandal.id }
    });
  }

  return { mandal, village };
}

// =============================================
// DATA BUILDERS (shared by Prisma & raw-SQL paths)
// =============================================

/**
 * Build the column→value map for CREATE.
 * When includePipeCols=false, pipe_company_id & geologist are omitted.
 */
function buildCreateData(data, mandalId, villageId, includePipeCols) {
  const d = {
    mandalId,
    villageId,
    sNo: data.sNo ? parseInt(data.sNo) : null,
    vehicle: data.vehicle || null,
    date: data.date ? new Date(data.date) : null,
    location: data.location || null,
    grant: data.grant || null,
    estCost: data.estCost ? parseFloat(data.estCost) : null,
    mBookNo: data.mBookNo || null,
    status: data.status || null,
    remarks: data.remarks || null,

    drilling_depth_mtrs: data.drilling_depth_mtrs ? parseFloat(data.drilling_depth_mtrs) : null,
    drilling_rate: data.drilling_rate ? parseFloat(data.drilling_rate) : null,
    drilling_amount: data.drilling_amount ? parseFloat(data.drilling_amount) : null,

    casing180_qty: data.casing180_qty ? parseInt(data.casing180_qty) : null,
    casing180_rate: data.casing180_rate ? parseFloat(data.casing180_rate) : null,
    casing180_amount: data.casing180_amount ? parseFloat(data.casing180_amount) : null,

    casing140_qty: data.casing140_qty ? parseInt(data.casing140_qty) : null,
    casing140_rate: data.casing140_rate ? parseFloat(data.casing140_rate) : null,
    casing140_amount: data.casing140_amount ? parseFloat(data.casing140_amount) : null,

    slotting_qty: data.slotting_qty ? parseInt(data.slotting_qty) : null,
    slotting_rate: data.slotting_rate ? parseFloat(data.slotting_rate) : null,
    slotting_amount: data.slotting_amount ? parseFloat(data.slotting_amount) : null,

    pumpset_qty: data.pumpset_qty ? parseInt(data.pumpset_qty) : null,
    pumpset_rate: data.pumpset_rate ? parseFloat(data.pumpset_rate) : null,
    pumpset_amount: data.pumpset_amount ? parseFloat(data.pumpset_amount) : null,

    gi_pipes_qty: data.gi_pipes_qty ? parseInt(data.gi_pipes_qty) : null,
    gi_pipes_rate: data.gi_pipes_rate ? parseFloat(data.gi_pipes_rate) : null,
    gi_pipes_amount: data.gi_pipes_amount ? parseFloat(data.gi_pipes_amount) : null,
    gi_pipes_returned_qty: data.gi_pipes_returned_qty ? parseInt(data.gi_pipes_returned_qty) : 0,

    plotfarm_qty: data.plotfarm_qty ? parseInt(data.plotfarm_qty) : null,
    plotfarm_rate: data.plotfarm_rate ? parseFloat(data.plotfarm_rate) : null,
    plotfarm_amount: data.plotfarm_amount ? parseFloat(data.plotfarm_amount) : null,

    erection_qty: data.erection_qty ? parseInt(data.erection_qty) : null,
    erection_rate: data.erection_rate ? parseFloat(data.erection_rate) : null,
    erection_amount: data.erection_amount ? parseFloat(data.erection_amount) : null,

    borecap_qty: data.borecap_qty ? parseInt(data.borecap_qty) : null,
    borecap_rate: data.borecap_rate ? parseFloat(data.borecap_rate) : null,
    borecap_amount: data.borecap_amount ? parseFloat(data.borecap_amount) : null,

    total_amount: data.total_amount ? parseFloat(data.total_amount) : null,
    total_bill_amount: data.total_bill_amount ? parseFloat(data.total_bill_amount) : null,
    first_part_amount: data.first_part_amount ? parseFloat(data.first_part_amount) : null,
    second_part_amount: data.second_part_amount ? parseFloat(data.second_part_amount) : null,

    it_percent: data.it_percent ? parseFloat(data.it_percent) : null,
    it_amount: data.it_amount ? parseFloat(data.it_amount) : null,
    vat_percent: data.vat_percent ? parseFloat(data.vat_percent) : null,
    vat_amount: data.vat_amount ? parseFloat(data.vat_amount) : null,
    total_recoveries: data.total_recoveries ? parseFloat(data.total_recoveries) : null,

    net_amount: data.net_amount ? parseFloat(data.net_amount) : null,
    voucher_no: data.voucher_no || null,
    cheque_no: data.cheque_no || null,
    cheque_date: data.cheque_date ? new Date(data.cheque_date) : null,
    bank_name: data.bank_name || null,

    received_date: data.received_date ? new Date(data.received_date) : null,
    platform_date: data.platform_date ? new Date(data.platform_date) : null,
    material_date: data.material_date ? new Date(data.material_date) : null,

    cgst_percent: data.cgst_percent ? parseFloat(data.cgst_percent) : null,
    cgst_amt: data.cgst_amt ? parseFloat(data.cgst_amt) : null,
    sgst_percent: data.sgst_percent ? parseFloat(data.sgst_percent) : null,
    sgst_amt: data.sgst_amt ? parseFloat(data.sgst_amt) : null,
    igst_percent: data.igst_percent ? parseFloat(data.igst_percent) : null,
    igst_amt: data.igst_amt ? parseFloat(data.igst_amt) : null,
    gst_percent: data.gst_percent ? parseFloat(data.gst_percent) : null,
    gst_amt: data.gst_amt ? parseFloat(data.gst_amt) : null,
    sas_percent: data.sas_percent ? parseFloat(data.sas_percent) : null,
    sas_amt: data.sas_amt ? parseFloat(data.sas_amt) : null,

    casing_type: data.casing_type || null,
    casing250_qty: data.casing250_qty ? parseInt(data.casing250_qty) : null,
    casing250_rate: data.casing250_rate ? parseFloat(data.casing250_rate) : null,
    casing250_amount: data.casing250_amount ? parseFloat(data.casing250_amount) : null,

    cylinders_qty: data.cylinders_qty ? parseInt(data.cylinders_qty) : null,
    cylinders_rate: data.cylinders_rate ? parseFloat(data.cylinders_rate) : null,
    cylinders_amount: data.cylinders_amount ? parseFloat(data.cylinders_amount) : null,

    stand_qty: data.stand_qty ? parseInt(data.stand_qty) : null,
    stand_rate: data.stand_rate ? parseFloat(data.stand_rate) : null,
    stand_amount: data.stand_amount ? parseFloat(data.stand_amount) : null,

    diesel_liters: data.diesel_liters ? parseFloat(data.diesel_liters) : null,
    diesel_rate: data.diesel_rate ? parseFloat(data.diesel_rate) : null,
    diesel_amount: data.diesel_amount ? parseFloat(data.diesel_amount) : null,

    head_handle_qty: data.head_handle_qty ? parseInt(data.head_handle_qty) : null,
    head_handle_rate: data.head_handle_rate ? parseFloat(data.head_handle_rate) : null,
    head_handle_amount: data.head_handle_amount ? parseFloat(data.head_handle_amount) : null,

    pipe_company: data.pipe_company || null,
    pipe_inventory_id: data.pipe_inventory_id ? parseInt(data.pipe_inventory_id) : null,
    labour_type: data.labour_type || null,
    labour_amount: data.labour_amount ? parseFloat(data.labour_amount) : null,
    pcs: data.pcs ? parseFloat(data.pcs) : null,
    gross_amount: data.gross_amount ? parseFloat(data.gross_amount) : null,
    custom_data: data.custom_data ? (typeof data.custom_data === 'string' ? data.custom_data : JSON.stringify(data.custom_data)) : null,
  };

  if (includePipeCols) {
    d.pipe_company_id = data.pipe_company_id ? parseInt(data.pipe_company_id) : null;
    d.geologist = data.geologist || null;
  }

  return d;
}

/**
 * Build the column→value map for UPDATE.
 * When includePipeCols=false, pipe_company_id & geologist are omitted.
 * Uses `undefined` for unset values (stripped later).
 */
function buildUpdateData(data, includePipeCols) {
  const d = {
    sNo: data.sNo !== undefined ? parseInt(data.sNo) : undefined,
    vehicle: data.vehicle,
    date: data.date ? new Date(data.date) : undefined,
    location: data.location,
    grant: data.grant,
    estCost: data.estCost !== undefined ? parseFloat(data.estCost) : undefined,
    mBookNo: data.mBookNo,
    status: data.status,
    remarks: data.remarks,

    drilling_depth_mtrs: data.drilling_depth_mtrs !== undefined ? parseFloat(data.drilling_depth_mtrs) : undefined,
    drilling_rate: data.drilling_rate !== undefined ? parseFloat(data.drilling_rate) : undefined,
    drilling_amount: data.drilling_amount !== undefined ? parseFloat(data.drilling_amount) : undefined,

    casing180_qty: data.casing180_qty !== undefined ? parseInt(data.casing180_qty) : undefined,
    casing180_rate: data.casing180_rate !== undefined ? parseFloat(data.casing180_rate) : undefined,
    casing180_amount: data.casing180_amount !== undefined ? parseFloat(data.casing180_amount) : undefined,

    casing140_qty: data.casing140_qty !== undefined ? parseInt(data.casing140_qty) : undefined,
    casing140_rate: data.casing140_rate !== undefined ? parseFloat(data.casing140_rate) : undefined,
    casing140_amount: data.casing140_amount !== undefined ? parseFloat(data.casing140_amount) : undefined,

    slotting_qty: data.slotting_qty !== undefined ? parseInt(data.slotting_qty) : undefined,
    slotting_rate: data.slotting_rate !== undefined ? parseFloat(data.slotting_rate) : undefined,
    slotting_amount: data.slotting_amount !== undefined ? parseFloat(data.slotting_amount) : undefined,

    pumpset_qty: data.pumpset_qty !== undefined ? parseInt(data.pumpset_qty) : undefined,
    pumpset_rate: data.pumpset_rate !== undefined ? parseFloat(data.pumpset_rate) : undefined,
    pumpset_amount: data.pumpset_amount !== undefined ? parseFloat(data.pumpset_amount) : undefined,

    gi_pipes_qty: safeInt(data.gi_pipes_qty),
    gi_pipes_rate: safeFloat(data.gi_pipes_rate),
    gi_pipes_amount: safeFloat(data.gi_pipes_amount),
    gi_pipes_returned_qty: safeInt(data.gi_pipes_returned_qty),

    plotfarm_qty: data.plotfarm_qty !== undefined ? parseInt(data.plotfarm_qty) : undefined,
    plotfarm_rate: data.plotfarm_rate !== undefined ? parseFloat(data.plotfarm_rate) : undefined,
    plotfarm_amount: data.plotfarm_amount !== undefined ? parseFloat(data.plotfarm_amount) : undefined,

    erection_qty: data.erection_qty !== undefined ? parseInt(data.erection_qty) : undefined,
    erection_rate: data.erection_rate !== undefined ? parseFloat(data.erection_rate) : undefined,
    erection_amount: data.erection_amount !== undefined ? parseFloat(data.erection_amount) : undefined,

    borecap_qty: data.borecap_qty !== undefined ? parseInt(data.borecap_qty) : undefined,
    borecap_rate: data.borecap_rate !== undefined ? parseFloat(data.borecap_rate) : undefined,
    borecap_amount: data.borecap_amount !== undefined ? parseFloat(data.borecap_amount) : undefined,

    total_amount: data.total_amount !== undefined ? parseFloat(data.total_amount) : undefined,
    total_bill_amount: data.total_bill_amount !== undefined ? parseFloat(data.total_bill_amount) : undefined,
    first_part_amount: data.first_part_amount !== undefined ? parseFloat(data.first_part_amount) : undefined,
    second_part_amount: data.second_part_amount !== undefined ? parseFloat(data.second_part_amount) : undefined,

    it_percent: data.it_percent !== undefined ? parseFloat(data.it_percent) : undefined,
    it_amount: data.it_amount !== undefined ? parseFloat(data.it_amount) : undefined,
    vat_percent: data.vat_percent !== undefined ? parseFloat(data.vat_percent) : undefined,
    vat_amount: data.vat_amount !== undefined ? parseFloat(data.vat_amount) : undefined,
    total_recoveries: data.total_recoveries !== undefined ? parseFloat(data.total_recoveries) : undefined,

    net_amount: data.net_amount !== undefined ? parseFloat(data.net_amount) : undefined,
    voucher_no: data.voucher_no,
    cheque_no: data.cheque_no,
    cheque_date: data.cheque_date ? new Date(data.cheque_date) : undefined,
    bank_name: data.bank_name,

    received_date: data.received_date ? new Date(data.received_date) : undefined,
    platform_date: data.platform_date ? new Date(data.platform_date) : undefined,
    material_date: data.material_date ? new Date(data.material_date) : undefined,

    cgst_percent: data.cgst_percent !== undefined ? parseFloat(data.cgst_percent) : undefined,
    cgst_amt: data.cgst_amt !== undefined ? parseFloat(data.cgst_amt) : undefined,
    sgst_percent: data.sgst_percent !== undefined ? parseFloat(data.sgst_percent) : undefined,
    sgst_amt: data.sgst_amt !== undefined ? parseFloat(data.sgst_amt) : undefined,
    igst_percent: data.igst_percent !== undefined ? parseFloat(data.igst_percent) : undefined,
    igst_amt: data.igst_amt !== undefined ? parseFloat(data.igst_amt) : undefined,
    gst_percent: data.gst_percent !== undefined ? parseFloat(data.gst_percent) : undefined,
    gst_amt: data.gst_amt !== undefined ? parseFloat(data.gst_amt) : undefined,
    sas_percent: data.sas_percent !== undefined ? parseFloat(data.sas_percent) : undefined,
    sas_amt: data.sas_amt !== undefined ? parseFloat(data.sas_amt) : undefined,

    casing_type: data.casing_type,
    casing250_qty: data.casing250_qty !== undefined ? parseInt(data.casing250_qty) : undefined,
    casing250_rate: data.casing250_rate !== undefined ? parseFloat(data.casing250_rate) : undefined,
    casing250_amount: data.casing250_amount !== undefined ? parseFloat(data.casing250_amount) : undefined,

    cylinders_qty: data.cylinders_qty !== undefined ? parseInt(data.cylinders_qty) : undefined,
    cylinders_rate: data.cylinders_rate !== undefined ? parseFloat(data.cylinders_rate) : undefined,
    cylinders_amount: data.cylinders_amount !== undefined ? parseFloat(data.cylinders_amount) : undefined,

    stand_qty: data.stand_qty !== undefined ? parseInt(data.stand_qty) : undefined,
    stand_rate: data.stand_rate !== undefined ? parseFloat(data.stand_rate) : undefined,
    stand_amount: data.stand_amount !== undefined ? parseFloat(data.stand_amount) : undefined,

    diesel_liters: safeFloat(data.diesel_liters),
    diesel_rate: safeFloat(data.diesel_rate),
    diesel_amount: safeFloat(data.diesel_amount),

    head_handle_qty: data.head_handle_qty !== undefined ? parseInt(data.head_handle_qty) : undefined,
    head_handle_rate: data.head_handle_rate !== undefined ? parseFloat(data.head_handle_rate) : undefined,
    head_handle_amount: data.head_handle_amount !== undefined ? parseFloat(data.head_handle_amount) : undefined,

    pipe_company: data.pipe_company,
    pipe_inventory_id: data.pipe_inventory_id !== undefined ? (data.pipe_inventory_id ? parseInt(data.pipe_inventory_id) : null) : undefined,
    labour_type: data.labour_type,
    labour_amount: data.labour_amount !== undefined ? parseFloat(data.labour_amount) : undefined,
    pcs: data.pcs !== undefined ? parseFloat(data.pcs) : undefined,
    gross_amount: data.gross_amount !== undefined ? parseFloat(data.gross_amount) : undefined,
    custom_data: data.custom_data,
  };

  if (includePipeCols) {
    d.pipe_company_id = data.pipe_company_id ? parseInt(data.pipe_company_id) : undefined;
    d.geologist = data.geologist;
  }

  return d;
}

// =============================================
// GET ALL RECORDS
// =============================================
export const getAllRecords = async () => {
  const hasBorewellWork = await tableExists('BorewellWork');
  if (!hasBorewellWork) {
    const hasLegacyGovtBores = await tableExists('govt_bores');
    if (hasLegacyGovtBores) {
      console.warn('Govt bores: BorewellWork missing — using legacy govt_bores fallback');
      return await getAllRecordsLegacyFallback();
    }
    throw new Error('Govt bore tables are missing in database (BorewellWork / govt_bores)');
  }

  await ensureGovtBoreSchema();

  // If we know the column is missing, skip Prisma entirely
  const colReady = await hasPipeCompanyColumn();
  if (!colReady) {
    console.warn('Govt bores: pipe_company_id column missing — using raw SQL');
    return await getAllRecordsFallback();
  }

  try {
    const records = await prisma.borewellWork.findMany({
      include: {
        mandal: true,
        village: true,
        pipe_company_ref: true,
        pipe_inventory_ref: true
      },
      orderBy: { id: 'desc' }
    });
    return records;
  } catch (error) {
    if (isMissingColumnError(error)) {
      console.warn('Govt bores fallback (P2022): using raw SQL for getAll');
      return await getAllRecordsFallback();
    }
    throw error;
  }
};

// =============================================
// GET RECORD BY ID
// =============================================
export const getRecordById = async (id) => {
  const hasBorewellWork = await tableExists('BorewellWork');
  if (!hasBorewellWork) {
    const hasLegacyGovtBores = await tableExists('govt_bores');
    if (hasLegacyGovtBores) {
      console.warn('Govt bores: BorewellWork missing — using legacy govt_bores fallback (getById)');
      return await getRecordByIdLegacyFallback(id);
    }
    throw new Error('Govt bore tables are missing in database (BorewellWork / govt_bores)');
  }

  await ensureGovtBoreSchema();

  const colReady = await hasPipeCompanyColumn();
  if (!colReady) {
    return await getRecordByIdFallback(id);
  }

  try {
    const record = await prisma.borewellWork.findUnique({
      where: { id: parseInt(id) },
      include: {
        mandal: true,
        village: true,
        bill: true,
        pipe_company_ref: true,
        pipe_inventory_ref: true
      }
    });
    return record;
  } catch (error) {
    if (isMissingColumnError(error)) {
      console.warn('Govt bores fallback (P2022): using raw SQL for getById');
      return await getRecordByIdFallback(id);
    }
    throw error;
  }
};

// =============================================
// CREATE RECORD
// =============================================
export const createRecord = async (data, userId = null) => {
  await ensureGovtBoreSchema();
  const mandalName = data.mandal || data.mandalName || 'Unknown';
  const villageName = data.village || data.villageName || 'Unknown';

  const colReady = await hasPipeCompanyColumn();

  // --- Fast path: all columns exist, use Prisma ---
  if (colReady) {
    try {
      const workId = await prisma.$transaction(async (tx) => {
        const { mandal, village } = await findOrCreateLocation(tx, mandalName, villageName);
        const work = await tx.borewellWork.create({ data: buildCreateData(data, mandal.id, village.id, true) });
        const record = await tx.borewellWork.findUnique({
          where: { id: work.id },
          include: { mandal: true, village: true, pipe_company_ref: true, pipe_inventory_ref: true }
        });
        await syncGovtBorePipeInventory({ tx, currentRecord: record, createdBy: userId });
        await syncGovtBoreSpareInventory({ tx, currentRecord: record, createdBy: userId });
        await syncGovtBoreDieselInventory({ tx, currentRecord: record, createdBy: userId });
        return work.id;
      });

      return await getRecordById(workId);
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      console.warn('Govt bores create fallback (P2022): falling back to raw SQL');
      // Fall through to raw-SQL path
    }
  }

  // --- Fallback: raw SQL (skips pipe_company_id & geologist) ---
  const { mandal, village } = await findOrCreateLocation(prisma, mandalName, villageName);
  const d = buildCreateData(data, mandal.id, village.id, false);

  // Build parameterised INSERT dynamically (strip nulls to keep it clean)
  const cols = Object.keys(d).filter(k => d[k] !== null && d[k] !== undefined);
  const vals = cols.map(k => {
    const v = d[k];
    // Stringify JSON objects for raw SQL
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
    return v;
  });
  const placeholders = cols.map((_, i) => `$${i + 1}`);

  const inserted = await prisma.$queryRawUnsafe(
    `INSERT INTO "BorewellWork" (${cols.map(c => `"${c}"`).join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING id`,
    ...vals
  );

  const record = await getRecordByIdFallback(inserted[0].id);
  await syncGovtBorePipeInventory({ currentRecord: record, createdBy: userId });
  await syncGovtBoreSpareInventory({ currentRecord: record, createdBy: userId });
  await syncGovtBoreDieselInventory({ currentRecord: record, createdBy: userId });
  return record;
};

// =============================================
// UPDATE RECORD
// =============================================
export const updateRecord = async (id, data, userId = null) => {
  await ensureGovtBoreSchema();
  const workId = parseInt(id);
  const colReady = await hasPipeCompanyColumn();
  const previousRecord = await getRecordById(workId);

  // --- Fast path: all columns exist, use Prisma ---
  if (colReady) {
    try {
      const updatedId = await prisma.$transaction(async (tx) => {
        let mandalId, villageId;
        if (data.mandal || data.village) {
          const mName = data.mandal || data.mandalName || 'Unknown';
          const vName = data.village || data.villageName || 'Unknown';
          const { mandal, village } = await findOrCreateLocation(tx, mName, vName);
          mandalId = mandal.id;
          villageId = village.id;
        }

        const updateData = buildUpdateData(data, true);
        if (mandalId) updateData.mandalId = mandalId;
        if (villageId) updateData.villageId = villageId;
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const record = await tx.borewellWork.update({
          where: { id: workId },
          data: updateData,
          include: { mandal: true, village: true, pipe_company_ref: true, pipe_inventory_ref: true }
        });

        await syncGovtBorePipeInventory({ tx, currentRecord: record, previousRecord, createdBy: userId });
        await syncGovtBoreSpareInventory({ tx, currentRecord: record, previousRecord, createdBy: userId });
        await syncGovtBoreDieselInventory({ tx, currentRecord: record, previousRecord, createdBy: userId });

        return record.id;
      });

      return await getRecordById(updatedId);
    } catch (error) {
      if (!isMissingColumnError(error)) throw error;
      console.warn('Govt bores update fallback (P2022): falling back to raw SQL');
      // Fall through to raw-SQL path
    }
  }

  // --- Fallback: raw SQL (skips pipe_company_id & geologist) ---
  let mandalId, villageId;
  if (data.mandal || data.village) {
    const mName = data.mandal || data.mandalName || 'Unknown';
    const vName = data.village || data.villageName || 'Unknown';
    const { mandal, village } = await findOrCreateLocation(prisma, mName, vName);
    mandalId = mandal.id;
    villageId = village.id;
  }

  const updateData = buildUpdateData(data, false);
  if (mandalId) updateData.mandalId = mandalId;
  if (villageId) updateData.villageId = villageId;
  Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

  if (Object.keys(updateData).length === 0) {
    const record = await getRecordByIdFallback(workId);
    await syncGovtBorePipeInventory({ currentRecord: record, previousRecord, createdBy: userId });
    await syncGovtBoreSpareInventory({ currentRecord: record, previousRecord, createdBy: userId });
    await syncGovtBoreDieselInventory({ currentRecord: record, previousRecord, createdBy: userId });
    return record;
  }

  // Build parameterised UPDATE
  const entries = Object.entries(updateData);
  const setClauses = entries.map(([col], i) => `"${col}" = $${i + 1}`);
  const values = entries.map(([, v]) => {
    if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
    return v;
  });
  values.push(workId);

  await prisma.$executeRawUnsafe(
    `UPDATE "BorewellWork" SET ${setClauses.join(', ')}, "updatedAt" = NOW() WHERE id = $${values.length}`,
    ...values
  );

  const record = await getRecordByIdFallback(workId);
  await syncGovtBorePipeInventory({ currentRecord: record, previousRecord, createdBy: userId });
  await syncGovtBoreSpareInventory({ currentRecord: record, previousRecord, createdBy: userId });
  await syncGovtBoreDieselInventory({ currentRecord: record, previousRecord, createdBy: userId });
  return record;
};

// =============================================
// DELETE RECORD
// =============================================
export const deleteRecord = async (id, userId = null) => {
  return await prisma.$transaction(async (tx) => {
    const workId = parseInt(id);
    await releaseBorePipeAllocations({
      tx,
      boreType: 'govt',
      boreId: workId,
      createdBy: userId,
      remarks: `Auto-returned to store after deleting govt bore #${workId}`
    });
    await releaseBoreSpareAllocations({
      tx,
      boreType: 'govt',
      boreId: workId,
      createdBy: userId,
      remarks: `Auto-restored spare stock after deleting govt bore #${workId}`
    });
    await releaseGovtBoreDieselAllocation({
      tx,
      boreId: workId,
      createdBy: userId,
      remarks: `Auto-restored diesel stock after deleting govt bore #${workId}`
    });

    // Delete related bill if exists
    await tx.borewellBill.deleteMany({ where: { workId } });

    // Delete audit logs
    await tx.borewellAuditLog.deleteMany({ where: { workId } });

    // Delete work record
    await tx.borewellWork.delete({ where: { id: workId } });

    return { success: true };
  });
};

// =============================================
// GET MANDALS
// =============================================
export const getMandals = async () => {
  const hasMandalTable = await tableExists('Mandal');
  if (!hasMandalTable) return [];

  return await prisma.mandal.findMany({
    orderBy: { name: 'asc' }
  });
};

// =============================================
// GET VILLAGES BY MANDAL
// =============================================
export const getVillagesByMandal = async (mandalId) => {
  const hasVillageTable = await tableExists('Village');
  if (!hasVillageTable) return [];

  return await prisma.village.findMany({
    where: { mandalId: parseInt(mandalId) },
    orderBy: { name: 'asc' }
  });
};

// =============================================
// BULK IMPORT
// =============================================
export const bulkImport = async (records) => {
  let success = 0;
  let failed = 0;
  const errors = [];

  for (const record of records) {
    try {
      await createRecord(record);
      success++;
    } catch (err) {
      failed++;
      errors.push({ row: record.sNo || 'unknown', error: err.message });
    }
  }

  return { success, failed, errors };
};

export default {
  getAllRecords,
  getRecordById,
  createRecord,
  updateRecord,
  deleteRecord,
  getMandals,
  getVillagesByMandal,
  bulkImport
};
