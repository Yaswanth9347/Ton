import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

/**
 * Format number in Indian locale — plain Rs. prefix
 */
const formatINR = (amount) => {
   const num = parseFloat(amount) || 0;
   return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

/**
 * Generate a payslip PDF — strict minimal text-based layout, single page
 */
export const generatePayslipPDF = async (payslipData) => {
   return new Promise((resolve, reject) => {
      try {
         const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            bufferPages: true,
            info: {
               Title: `Payslip - ${payslipData.monthName} ${payslipData.year}`,
               Author: 'JMJ Borewells'
            }
         });

         const buffers = [];
         doc.on('data', buffers.push.bind(buffers));
         doc.on('end', () => resolve(Buffer.concat(buffers)));

         const m = 50;
         const cw = doc.page.width - m * 2;
         const black = '#000000';
         const lightGray = '#b8b8b8';
         const reservedFooterSpace = 50;

         // Column positions for detail rows
         const leftLabel = m;
         const leftVal = m + 115;
         const rightLabel = m + 275;
         const rightVal = m + 380;

         const drawSectionTitle = (title) => {
            doc.moveDown(0.55);
            doc.fontSize(10).font('Helvetica-Bold').fillColor(black)
               .text(title, m, doc.y, { align: 'left', width: cw });
            const lineY = doc.y + 4;
            doc.moveTo(m, lineY)
               .lineTo(m + cw, lineY)
               .lineWidth(0.5)
               .strokeColor(lightGray)
               .stroke();
            doc.lineWidth(1);
            doc.y = lineY + 7;
         };

         // Detail row: bold label, normal value (two pairs per row)
         const detailRow = (l1, v1, l2, v2) => {
            const y = doc.y;
            doc.fontSize(9).font('Helvetica-Bold').fillColor(black).text(l1, leftLabel, y);
            doc.font('Helvetica').text(v1 || 'N/A', leftVal, y);
            if (l2) {
               doc.font('Helvetica-Bold').text(l2, rightLabel, y);
               doc.font('Helvetica').text(v2 || 'N/A', rightVal, y);
            }
            doc.y = y + 14;
         };

         // ── HEADER (center) ──
         doc.fontSize(16).font('Helvetica-Bold').fillColor(black)
            .text('JMJ BOREWELLS', m, 45, { align: 'center', width: cw });
         doc.fontSize(9).font('Helvetica').fillColor(black)
            .text('Near RCM Church, Chodavaram, Anakapalle - 531036', { align: 'center', width: cw });
         doc.moveDown(0.5);
         doc.fontSize(12).font('Helvetica-Bold').fillColor(black)
            .text('PAYSLIP', { align: 'center', width: cw });

         // ── EMPLOYEE DETAILS ──
         doc.moveDown(0.55);
         drawSectionTitle('Employee Details');

         detailRow('Employee Name:', payslipData.employeeName, 'Employee ID:', payslipData.employeeId);
         detailRow('Designation:', payslipData.designation || 'Employee', 'Pay Period:', `${payslipData.monthName} ${payslipData.year}`);
         detailRow('Pay Date:', payslipData.payDate || new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }), '', '');

         // ── ATTENDANCE SUMMARY ──
         drawSectionTitle('Attendance Summary');

         detailRow('Working Days:', (payslipData.workingDays || 0).toString(), 'Days Present:', (payslipData.presentDays || 0).toString());
         detailRow('Days Absent:', (payslipData.absentDays || 0).toString(), 'Public Holidays:', (payslipData.publicHolidays || 0).toString());
         detailRow('Overtime Hours:', (payslipData.overtimeHours || 0).toString(), 'LOP Per Day:', formatINR(payslipData.lopRate || 0));

         // ── SALARY BREAKDOWN ──
         drawSectionTitle('Salary Breakdown');

         const half = cw / 2;
         const eLeft = m;
         const dLeft = m + half;

         // Sub-headers
         const subY = doc.y;
         doc.fontSize(9).font('Helvetica-Bold').fillColor(black);
         doc.text('Earnings', eLeft, subY);
         doc.text('Deductions', dLeft, subY);
         doc.y = subY + 14;

         // Earnings list
         let ey = doc.y;
         doc.font('Helvetica').fontSize(9).fillColor(black);
         const earnings = [
            { label: 'Basic Salary', amount: payslipData.baseSalary || 0 },
            { label: 'Overtime Pay', amount: payslipData.overtimeAmount || 0 },
         ];
         for (const e of earnings) {
            doc.font('Helvetica').text(e.label, eLeft, ey);
            doc.text(formatINR(e.amount), eLeft + half - 110, ey, { align: 'right', width: 100 });
            ey += 13;
         }
         ey += 2;
         doc.font('Helvetica-Bold').text('Total Earnings', eLeft, ey);
         doc.font('Helvetica').text(formatINR(payslipData.grossSalary || 0), eLeft + half - 110, ey, { align: 'right', width: 100 });

         // Deductions list
         let dy = subY + 14;
         doc.font('Helvetica').fontSize(9).fillColor(black);
         const deductions = [
            { label: `LOP (${payslipData.absentDays || 0}d x ${formatINR(payslipData.lopRate || 0)})`, amount: payslipData.lopDeduction || payslipData.attendanceDeduction || 0 },
            { label: 'Tax (TDS)', amount: payslipData.taxDeduction || 0 },
            { label: 'Other Deductions', amount: payslipData.otherDeductions || 0 },
         ];
         for (const d of deductions) {
            doc.font('Helvetica').text(d.label, dLeft, dy);
            doc.text(formatINR(d.amount), dLeft + half - 110, dy, { align: 'right', width: 100 });
            dy += 13;
         }
         dy += 2;
         const totalDed = (payslipData.lopDeduction || payslipData.attendanceDeduction || 0) +
            (payslipData.taxDeduction || 0) + (payslipData.otherDeductions || 0);
         doc.font('Helvetica-Bold').text('Total Deductions', dLeft, dy);
         doc.font('Helvetica').text(formatINR(totalDed), dLeft + half - 110, dy, { align: 'right', width: 100 });

         doc.y = Math.max(ey, dy) + 10;

         // ── NET PAY (right aligned, with separator above) ──
         const netLineY = doc.y;
         doc.moveTo(m, netLineY)
            .lineTo(m + cw, netLineY)
            .lineWidth(0.5)
            .strokeColor(lightGray)
            .stroke();
         doc.lineWidth(1);
         doc.y = netLineY + 8;

         doc.fontSize(11).font('Helvetica-Bold').fillColor(black)
            .text(`Net Pay: ${formatINR(payslipData.netSalary || 0)}`, m, doc.y, { align: 'right', width: cw });

         doc.moveDown(1.1);

         // ── AUTHORIZED SIGNATORY (right side) ──
         const sigWidth = 160;
         const imageWidth = 90;
         const imageHeight = 28;
         const sigX = m + cw - sigWidth;
         const maxSignatureTop = doc.page.height - reservedFooterSpace - imageHeight - 18;
         const sigY = Math.min(doc.y, maxSignatureTop);

         // Try to load a default signature image
         const sigPath = path.join(process.cwd(), 'uploads', 'signature.png');
         if (fs.existsSync(sigPath)) {
            doc.image(sigPath, sigX + (sigWidth - imageWidth), sigY, { width: imageWidth, height: imageHeight });
            doc.y = sigY + imageHeight + 4;
         } else {
            // Leave blank space for signature
            doc.y = sigY + imageHeight + 4;
         }

         doc.fontSize(9).font('Helvetica-Bold').fillColor(black)
            .text('Authorized Signatory', sigX, doc.y, { align: 'right', width: sigWidth });

         // ── FOOTER: pinned to last two lines of page 1 ──
         // Temporarily disable bottom margin guard so PDFKit doesn't push footer to page 2
         doc.page.margins.bottom = 0;
         const line1Y = doc.page.height - 28;
         const line2Y = doc.page.height - 16;
         doc.fontSize(7).font('Helvetica').fillColor(lightGray)
            .text('This is a computer-generated document. No signature is required.', m, line1Y, { align: 'center', width: cw, lineBreak: false });
         doc.text(`Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, m, line2Y, { align: 'center', width: cw, lineBreak: false });

         doc.end();
      } catch (error) {
         reject(error);
      }
   });
};

/**
 * Get month name from month number
 */
export const getMonthName = (month) => {
   const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
   ];
   return months[month - 1] || 'Unknown';
};
