/**
 * Govt Bore Service - Flattened Excel Model
 * All columns directly on BorewellWork table
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

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
// GET ALL RECORDS
// =============================================
export const getAllRecords = async () => {
  const records = await prisma.borewellWork.findMany({
    include: {
      mandal: true,
      village: true
    },
    orderBy: { id: 'desc' }
  });
  return records;
};

// =============================================
// GET RECORD BY ID
// =============================================
export const getRecordById = async (id) => {
  const record = await prisma.borewellWork.findUnique({
    where: { id: parseInt(id) },
    include: {
      mandal: true,
      village: true,
      bill: true
    }
  });
  return record;
};

// =============================================
// CREATE RECORD
// =============================================
export const createRecord = async (data) => {
  const mandalName = data.mandal || data.mandalName || 'Unknown';
  const villageName = data.village || data.villageName || 'Unknown';

  return await prisma.$transaction(async (tx) => {
    const { mandal, village } = await findOrCreateLocation(tx, mandalName, villageName);

    const work = await tx.borewellWork.create({
      data: {
        // Administrative
        mandalId: mandal.id,
        villageId: village.id,
        sNo: data.sNo ? parseInt(data.sNo) : null,
        vehicle: data.vehicle || null,
        date: data.date ? new Date(data.date) : null,
        location: data.location || null,
        grant: data.grant || null,
        estCost: data.estCost ? parseFloat(data.estCost) : null,
        mBookNo: data.mBookNo || null,
        status: data.status || null,
        remarks: data.remarks || null,

        // Drilling
        drilling_depth_mtrs: data.drilling_depth_mtrs ? parseFloat(data.drilling_depth_mtrs) : null,
        drilling_rate: data.drilling_rate ? parseFloat(data.drilling_rate) : null,
        drilling_amount: data.drilling_amount ? parseFloat(data.drilling_amount) : null,

        // Casing 180
        casing180_qty: data.casing180_qty ? parseInt(data.casing180_qty) : null,
        casing180_rate: data.casing180_rate ? parseFloat(data.casing180_rate) : null,
        casing180_amount: data.casing180_amount ? parseFloat(data.casing180_amount) : null,

        // Casing 140
        casing140_qty: data.casing140_qty ? parseInt(data.casing140_qty) : null,
        casing140_rate: data.casing140_rate ? parseFloat(data.casing140_rate) : null,
        casing140_amount: data.casing140_amount ? parseFloat(data.casing140_amount) : null,

        // Slotting
        slotting_qty: data.slotting_qty ? parseInt(data.slotting_qty) : null,
        slotting_rate: data.slotting_rate ? parseFloat(data.slotting_rate) : null,
        slotting_amount: data.slotting_amount ? parseFloat(data.slotting_amount) : null,

        // Pump Set
        pumpset_qty: data.pumpset_qty ? parseInt(data.pumpset_qty) : null,
        pumpset_rate: data.pumpset_rate ? parseFloat(data.pumpset_rate) : null,
        pumpset_amount: data.pumpset_amount ? parseFloat(data.pumpset_amount) : null,

        // GI Pipes
        gi_pipes_qty: data.gi_pipes_qty ? parseInt(data.gi_pipes_qty) : null,
        gi_pipes_rate: data.gi_pipes_rate ? parseFloat(data.gi_pipes_rate) : null,
        gi_pipes_amount: data.gi_pipes_amount ? parseFloat(data.gi_pipes_amount) : null,

        // Plot/Farm
        plotfarm_qty: data.plotfarm_qty ? parseInt(data.plotfarm_qty) : null,
        plotfarm_rate: data.plotfarm_rate ? parseFloat(data.plotfarm_rate) : null,
        plotfarm_amount: data.plotfarm_amount ? parseFloat(data.plotfarm_amount) : null,

        // Erection
        erection_qty: data.erection_qty ? parseInt(data.erection_qty) : null,
        erection_rate: data.erection_rate ? parseFloat(data.erection_rate) : null,
        erection_amount: data.erection_amount ? parseFloat(data.erection_amount) : null,

        // Bore Cap
        borecap_qty: data.borecap_qty ? parseInt(data.borecap_qty) : null,
        borecap_rate: data.borecap_rate ? parseFloat(data.borecap_rate) : null,
        borecap_amount: data.borecap_amount ? parseFloat(data.borecap_amount) : null,

        // Totals
        total_amount: data.total_amount ? parseFloat(data.total_amount) : null,
        total_bill_amount: data.total_bill_amount ? parseFloat(data.total_bill_amount) : null,
        first_part_amount: data.first_part_amount ? parseFloat(data.first_part_amount) : null,
        second_part_amount: data.second_part_amount ? parseFloat(data.second_part_amount) : null,

        // Recoveries
        it_percent: data.it_percent ? parseFloat(data.it_percent) : null,
        it_amount: data.it_amount ? parseFloat(data.it_amount) : null,
        vat_percent: data.vat_percent ? parseFloat(data.vat_percent) : null,
        vat_amount: data.vat_amount ? parseFloat(data.vat_amount) : null,
        total_recoveries: data.total_recoveries ? parseFloat(data.total_recoveries) : null,

        // Payment
        net_amount: data.net_amount ? parseFloat(data.net_amount) : null,
        voucher_no: data.voucher_no || null,
        cheque_no: data.cheque_no || null,
        cheque_date: data.cheque_date ? new Date(data.cheque_date) : null,
        bank_name: data.bank_name || null,

        // Dates
        received_date: data.received_date ? new Date(data.received_date) : null,
        platform_date: data.platform_date ? new Date(data.platform_date) : null,
        material_date: data.material_date ? new Date(data.material_date) : null,

        // Taxes
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

        // Casing 250 & Type
        casing_type: data.casing_type || null,
        casing250_qty: data.casing250_qty ? parseInt(data.casing250_qty) : null,
        casing250_rate: data.casing250_rate ? parseFloat(data.casing250_rate) : null,
        casing250_amount: data.casing250_amount ? parseFloat(data.casing250_amount) : null,

        // Materials
        cylinders_qty: data.cylinders_qty ? parseInt(data.cylinders_qty) : null,
        cylinders_rate: data.cylinders_rate ? parseFloat(data.cylinders_rate) : null,
        cylinders_amount: data.cylinders_amount ? parseFloat(data.cylinders_amount) : null,

        stand_qty: data.stand_qty ? parseInt(data.stand_qty) : null,
        stand_rate: data.stand_rate ? parseFloat(data.stand_rate) : null,
        stand_amount: data.stand_amount ? parseFloat(data.stand_amount) : null,

        head_handle_qty: data.head_handle_qty ? parseInt(data.head_handle_qty) : null,
        head_handle_rate: data.head_handle_rate ? parseFloat(data.head_handle_rate) : null,
        head_handle_amount: data.head_handle_amount ? parseFloat(data.head_handle_amount) : null,

        // GI Pipes
        pipe_company: data.pipe_company || null,

        // Labour
        labour_type: data.labour_type || null,
        labour_amount: data.labour_amount ? parseFloat(data.labour_amount) : null,

        // Other
        pcs: data.pcs ? parseFloat(data.pcs) : null,
        gross_amount: data.gross_amount ? parseFloat(data.gross_amount) : null,

        // Custom Data
        custom_data: data.custom_data || null,
      }
    });

    // Return the full record with relations for the frontend/sheet sync
    return await tx.borewellWork.findUnique({
      where: { id: work.id },
      include: {
        mandal: true,
        village: true
      }
    });
  });
};

// =============================================
// UPDATE RECORD
// =============================================
export const updateRecord = async (id, data) => {
  return await prisma.$transaction(async (tx) => {
    const workId = parseInt(id);

    let mandalId = undefined;
    let villageId = undefined;

    if (data.mandal || data.village) {
      const mName = data.mandal || data.mandalName || 'Unknown';
      const vName = data.village || data.villageName || 'Unknown';
      const { mandal, village } = await findOrCreateLocation(tx, mName, vName);
      mandalId = mandal.id;
      villageId = village.id;
    }

    const updateData = {
      // Administrative
      sNo: data.sNo !== undefined ? parseInt(data.sNo) : undefined,
      vehicle: data.vehicle,
      date: data.date ? new Date(data.date) : undefined,
      location: data.location,
      grant: data.grant,
      estCost: data.estCost !== undefined ? parseFloat(data.estCost) : undefined,
      mBookNo: data.mBookNo,
      status: data.status,
      remarks: data.remarks,

      // Drilling
      drilling_depth_mtrs: data.drilling_depth_mtrs !== undefined ? parseFloat(data.drilling_depth_mtrs) : undefined,
      drilling_rate: data.drilling_rate !== undefined ? parseFloat(data.drilling_rate) : undefined,
      drilling_amount: data.drilling_amount !== undefined ? parseFloat(data.drilling_amount) : undefined,

      // Casing 180
      casing180_qty: data.casing180_qty !== undefined ? parseInt(data.casing180_qty) : undefined,
      casing180_rate: data.casing180_rate !== undefined ? parseFloat(data.casing180_rate) : undefined,
      casing180_amount: data.casing180_amount !== undefined ? parseFloat(data.casing180_amount) : undefined,

      // Casing 140
      casing140_qty: data.casing140_qty !== undefined ? parseInt(data.casing140_qty) : undefined,
      casing140_rate: data.casing140_rate !== undefined ? parseFloat(data.casing140_rate) : undefined,
      casing140_amount: data.casing140_amount !== undefined ? parseFloat(data.casing140_amount) : undefined,

      // Slotting
      slotting_qty: data.slotting_qty !== undefined ? parseInt(data.slotting_qty) : undefined,
      slotting_rate: data.slotting_rate !== undefined ? parseFloat(data.slotting_rate) : undefined,
      slotting_amount: data.slotting_amount !== undefined ? parseFloat(data.slotting_amount) : undefined,

      // Pump Set
      pumpset_qty: data.pumpset_qty !== undefined ? parseInt(data.pumpset_qty) : undefined,
      pumpset_rate: data.pumpset_rate !== undefined ? parseFloat(data.pumpset_rate) : undefined,
      pumpset_amount: data.pumpset_amount !== undefined ? parseFloat(data.pumpset_amount) : undefined,

      // GI Pipes
      gi_pipes_qty: data.gi_pipes_qty !== undefined ? parseInt(data.gi_pipes_qty) : undefined,
      gi_pipes_rate: data.gi_pipes_rate !== undefined ? parseFloat(data.gi_pipes_rate) : undefined,
      gi_pipes_amount: data.gi_pipes_amount !== undefined ? parseFloat(data.gi_pipes_amount) : undefined,

      // Plot/Farm
      plotfarm_qty: data.plotfarm_qty !== undefined ? parseInt(data.plotfarm_qty) : undefined,
      plotfarm_rate: data.plotfarm_rate !== undefined ? parseFloat(data.plotfarm_rate) : undefined,
      plotfarm_amount: data.plotfarm_amount !== undefined ? parseFloat(data.plotfarm_amount) : undefined,

      // Erection
      erection_qty: data.erection_qty !== undefined ? parseInt(data.erection_qty) : undefined,
      erection_rate: data.erection_rate !== undefined ? parseFloat(data.erection_rate) : undefined,
      erection_amount: data.erection_amount !== undefined ? parseFloat(data.erection_amount) : undefined,

      // Bore Cap
      borecap_qty: data.borecap_qty !== undefined ? parseInt(data.borecap_qty) : undefined,
      borecap_rate: data.borecap_rate !== undefined ? parseFloat(data.borecap_rate) : undefined,
      borecap_amount: data.borecap_amount !== undefined ? parseFloat(data.borecap_amount) : undefined,

      // Totals
      total_amount: data.total_amount !== undefined ? parseFloat(data.total_amount) : undefined,
      total_bill_amount: data.total_bill_amount !== undefined ? parseFloat(data.total_bill_amount) : undefined,
      first_part_amount: data.first_part_amount !== undefined ? parseFloat(data.first_part_amount) : undefined,
      second_part_amount: data.second_part_amount !== undefined ? parseFloat(data.second_part_amount) : undefined,

      // Recoveries
      it_percent: data.it_percent !== undefined ? parseFloat(data.it_percent) : undefined,
      it_amount: data.it_amount !== undefined ? parseFloat(data.it_amount) : undefined,
      vat_percent: data.vat_percent !== undefined ? parseFloat(data.vat_percent) : undefined,
      vat_amount: data.vat_amount !== undefined ? parseFloat(data.vat_amount) : undefined,
      total_recoveries: data.total_recoveries !== undefined ? parseFloat(data.total_recoveries) : undefined,

      // Payment
      net_amount: data.net_amount !== undefined ? parseFloat(data.net_amount) : undefined,
      voucher_no: data.voucher_no,
      cheque_no: data.cheque_no,
      cheque_date: data.cheque_date ? new Date(data.cheque_date) : undefined,
      bank_name: data.bank_name,

      // Dates
      received_date: data.received_date ? new Date(data.received_date) : undefined,
      platform_date: data.platform_date ? new Date(data.platform_date) : undefined,
      material_date: data.material_date ? new Date(data.material_date) : undefined,

      // Taxes
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

      // Casing 250 & Type
      casing_type: data.casing_type,
      casing250_qty: data.casing250_qty !== undefined ? parseInt(data.casing250_qty) : undefined,
      casing250_rate: data.casing250_rate !== undefined ? parseFloat(data.casing250_rate) : undefined,
      casing250_amount: data.casing250_amount !== undefined ? parseFloat(data.casing250_amount) : undefined,

      // Materials
      cylinders_qty: data.cylinders_qty !== undefined ? parseInt(data.cylinders_qty) : undefined,
      cylinders_rate: data.cylinders_rate !== undefined ? parseFloat(data.cylinders_rate) : undefined,
      cylinders_amount: data.cylinders_amount !== undefined ? parseFloat(data.cylinders_amount) : undefined,

      stand_qty: data.stand_qty !== undefined ? parseInt(data.stand_qty) : undefined,
      stand_rate: data.stand_rate !== undefined ? parseFloat(data.stand_rate) : undefined,
      stand_amount: data.stand_amount !== undefined ? parseFloat(data.stand_amount) : undefined,

      head_handle_qty: data.head_handle_qty !== undefined ? parseInt(data.head_handle_qty) : undefined,
      head_handle_rate: data.head_handle_rate !== undefined ? parseFloat(data.head_handle_rate) : undefined,
      head_handle_amount: data.head_handle_amount !== undefined ? parseFloat(data.head_handle_amount) : undefined,

      // GI Pipes
      pipe_company: data.pipe_company,

      // Labour
      labour_type: data.labour_type,
      labour_amount: data.labour_amount !== undefined ? parseFloat(data.labour_amount) : undefined,

      // Other
      pcs: data.pcs !== undefined ? parseFloat(data.pcs) : undefined,
      gross_amount: data.gross_amount !== undefined ? parseFloat(data.gross_amount) : undefined,

      // Custom Data
      custom_data: data.custom_data,
    };

    if (mandalId) updateData.mandalId = mandalId;
    if (villageId) updateData.villageId = villageId;

    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updatedWork = await tx.borewellWork.update({
      where: { id: workId },
      data: updateData,
      include: { mandal: true, village: true }
    });

    return updatedWork;
  });
};

// =============================================
// DELETE RECORD
// =============================================
export const deleteRecord = async (id) => {
  return await prisma.$transaction(async (tx) => {
    const workId = parseInt(id);

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
  return await prisma.mandal.findMany({
    orderBy: { name: 'asc' }
  });
};

// =============================================
// GET VILLAGES BY MANDAL
// =============================================
export const getVillagesByMandal = async (mandalId) => {
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
