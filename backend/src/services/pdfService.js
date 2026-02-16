import PDFDocument from 'pdfkit';

/**
 * Generate a payslip PDF
 */
export const generatePayslipPDF = async (payslipData) => {
   return new Promise((resolve, reject) => {
      try {
         const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            info: {
               Title: `Payslip - ${payslipData.monthName} ${payslipData.year}`,
               Author: 'JMJ Attendance System'
            }
         });

         const buffers = [];
         doc.on('data', buffers.push.bind(buffers));
         doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            resolve(pdfData);
         });

         // Company Header
         doc.fontSize(20)
            .font('Helvetica-Bold')
            .text('JMJ ENTERPRISES', { align: 'center' });

         doc.fontSize(10)
            .font('Helvetica')
            .text('123 Business Park, Tech City, India - 500001', { align: 'center' });

         doc.moveDown(0.5);
         doc.fontSize(12)
            .font('Helvetica-Bold')
            .text('PAYSLIP', { align: 'center' });

         doc.moveDown();

         // Draw line
         doc.moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();

         doc.moveDown();

         // Employee Details Section
         const startY = doc.y;

         doc.fontSize(10)
            .font('Helvetica-Bold')
            .text('Employee Details', 50, startY);

         doc.font('Helvetica')
            .fontSize(9);

         const leftCol = 50;
         const leftValCol = 140;
         const rightCol = 320;
         const rightValCol = 420;

         let y = startY + 20;

         doc.text('Employee Name:', leftCol, y);
         doc.text(payslipData.employeeName, leftValCol, y);
         doc.text('Employee ID:', rightCol, y);
         doc.text(payslipData.employeeId || 'N/A', rightValCol, y);

         y += 15;
         doc.text('Department:', leftCol, y);
         doc.text(payslipData.department || 'General', leftValCol, y);
         doc.text('Designation:', rightCol, y);
         doc.text(payslipData.designation || 'Employee', rightValCol, y);

         y += 15;
         doc.text('Pay Period:', leftCol, y);
         doc.text(`${payslipData.monthName} ${payslipData.year}`, leftValCol, y);
         doc.text('Pay Date:', rightCol, y);
         doc.text(payslipData.payDate || new Date().toLocaleDateString('en-IN'), rightValCol, y);

         doc.moveDown(3);

         // Draw line
         doc.moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();

         doc.moveDown();

         // Attendance Summary Section
         doc.fontSize(10)
            .font('Helvetica-Bold')
            .text('Attendance Summary', 50);

         doc.moveDown(0.5);
         doc.font('Helvetica')
            .fontSize(9);

         y = doc.y;
         doc.text('Working Days:', leftCol, y);
         doc.text(payslipData.workingDays?.toString() || '0', leftValCol, y);
         doc.text('Days Present:', rightCol, y);
         doc.text(payslipData.presentDays?.toString() || '0', rightValCol, y);

         y += 15;
         doc.text('Days Absent:', leftCol, y);
         doc.text(payslipData.absentDays?.toString() || '0', leftValCol, y);
         doc.text('Public Holidays:', rightCol, y);
         doc.text((payslipData.publicHolidays || 0).toString(), rightValCol, y);

         y += 15;
         doc.text('Overtime Hours:', leftCol, y);
         doc.text(payslipData.overtimeHours?.toString() || '0', leftValCol, y);
         doc.text('LOP Per Day:', rightCol, y);
         doc.text(`₹${(payslipData.lopRate || 0).toLocaleString('en-IN')}`, rightValCol, y);

         doc.moveDown(3);

         // Draw line
         doc.moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();

         doc.moveDown();

         // Earnings & Deductions Section
         const tableTop = doc.y;
         const colWidth = 247.5;

         // Earnings Header
         doc.fontSize(10)
            .font('Helvetica-Bold')
            .text('Earnings', 50, tableTop);

         // Deductions Header
         doc.text('Deductions', 300, tableTop);

         doc.moveDown(0.5);

         // Draw headers
         doc.fontSize(9)
            .font('Helvetica-Bold');

         let earningsY = doc.y;
         let deductionsY = doc.y;

         // Earnings
         doc.font('Helvetica')
            .fontSize(9);

         const earnings = [
            { label: 'Basic Salary', amount: payslipData.baseSalary || 0 },
            { label: 'Overtime Pay', amount: payslipData.overtimeAmount || 0 },
            // { label: 'Expense Reimbursement', amount: payslipData.expenseReimbursement || 0 },
         ];

         for (const earning of earnings) {
            doc.text(earning.label, 50, earningsY);
            doc.text(`₹${earning.amount.toLocaleString('en-IN')}`, 200, earningsY, { align: 'right', width: 90 });
            earningsY += 15;
         }

         // Total Earnings
         doc.font('Helvetica-Bold');
         doc.text('Total Earnings', 50, earningsY + 5);
         doc.text(`₹${(payslipData.grossSalary || 0).toLocaleString('en-IN')}`, 200, earningsY + 5, { align: 'right', width: 90 });

         // Deductions
         doc.font('Helvetica');
         const deductions = [
            { label: `LOP Deduction (${payslipData.absentDays || 0} days × ₹${(payslipData.lopRate || 0).toLocaleString('en-IN')})`, amount: payslipData.lopDeduction || payslipData.attendanceDeduction || 0 },
            { label: 'Tax (TDS)', amount: payslipData.taxDeduction || 0 },
            { label: 'Other Deductions', amount: payslipData.otherDeductions || 0 },
         ];

         for (const deduction of deductions) {
            doc.text(deduction.label, 300, deductionsY);
            doc.text(`₹${deduction.amount.toLocaleString('en-IN')}`, 450, deductionsY, { align: 'right', width: 90 });
            deductionsY += 15;
         }

         // Total Deductions
         const totalDeductions = (payslipData.lopDeduction || payslipData.attendanceDeduction || 0) +
            (payslipData.taxDeduction || 0) +
            (payslipData.otherDeductions || 0);
         doc.font('Helvetica-Bold');
         doc.text('Total Deductions', 300, deductionsY + 5);
         doc.text(`₹${totalDeductions.toLocaleString('en-IN')}`, 450, deductionsY + 5, { align: 'right', width: 90 });

         // Move to after earnings/deductions
         doc.y = Math.max(earningsY, deductionsY) + 40;

         // Draw line
         doc.moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();

         doc.moveDown();

         // Net Pay Section
         doc.fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#006400')
            .text(`Net Pay: ₹${(payslipData.netSalary || 0).toLocaleString('en-IN')}`, { align: 'center' });

         doc.fillColor('#000000');

         doc.moveDown(2);

         // Draw line
         doc.moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .stroke();

         doc.moveDown();

         // Footer
         doc.fontSize(8)
            .font('Helvetica')
            .fillColor('#666666')
            .text('This is a computer-generated document. No signature is required.', { align: 'center' });

         doc.moveDown(0.5);
         doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });

         doc.moveDown(2);

         // Signature lines
         doc.fillColor('#000000')
            .fontSize(9);

         doc.moveTo(50, doc.y + 30)
            .lineTo(200, doc.y + 30)
            .stroke();
         doc.text('Employee Signature', 50, doc.y + 35);

         doc.moveTo(395, doc.y - 20)
            .lineTo(545, doc.y - 20)
            .stroke();
         doc.text('Authorized Signatory', 395, doc.y);

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
