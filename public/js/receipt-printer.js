/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY
 * Universal Transaction Receipt Generator & Printable PDF Modal
 * ============================================================================
 */

function triggerPrintableReceipt(txData) {
    const {
        orderRef,
        serviceTitle,
        beneficiary,
        cleanAmount,
        feeAmount = 20.00,
        totalCharged,
        tokenOrPin = 'N/A',
        serialNo = 'N/A',
        paymentMethod,
        timestamp = new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' })
    } = txData;

    const receiptHtml = `
        <div id="printableReceiptArea" style="background:#ffffff; color:#0f172a; padding:30px; border-radius:12px; font-family:'Segoe UI', sans-serif; text-align:left; border:1px solid #cbd5e1; max-width:400px; margin:0 auto;">
            
            <!-- Header -->
            <div style="text-align:center; border-bottom:2px dashed #0284c7; padding-bottom:15px; margin-bottom:15px;">
                <h2 style="color:#0284c7; font-size:1.3rem; font-weight:800; margin:0;">ALL TIME BUSINESS LTD</h2>
                <p style="font-size:0.75rem; color:#64748b; font-weight:700; letter-spacing:1px; margin-top:2px;">@BL SOVEREIGN GATEWAY</p>
                <small style="font-size:0.7rem; color:#94a3b8;">Primary Banker: Access Bank Plc | Account: 0037323182</small>
            </div>

            <!-- Status Banner -->
            <div style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:10px; text-align:center; margin-bottom:15px;">
                <span style="color:#047857; font-weight:800; font-size:0.9rem;">✅ TRANSACTION SUCCESSFUL</span>
            </div>

            <!-- Transaction Details Table -->
            <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:15px;">
                <tr>
                    <td style="padding:6px 0; color:#64748b;">Reference Ref:</td>
                    <td style="padding:6px 0; text-align:right; font-weight:700; color:#0f172a;">${orderRef}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0; color:#64748b;">Service Category:</td>
                    <td style="padding:6px 0; text-align:right; font-weight:700; color:#0f172a;">${serviceTitle}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0; color:#64748b;">Target / Account:</td>
                    <td style="padding:6px 0; text-align:right; font-weight:700; color:#0f172a;">${beneficiary}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0; color:#64748b;">Payment Method:</td>
                    <td style="padding:6px 0; text-align:right; font-weight:700; color:#0f172a;">${paymentMethod}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0; color:#64748b;">Date & Time:</td>
                    <td style="padding:6px 0; text-align:right; font-weight:600; color:#475569;">${timestamp}</td>
                </tr>
            </table>

            <!-- Value / Token Box (e-PINs, Electricity Meters, Recharges) -->
            ${tokenOrPin !== 'N/A' ? `
            <div style="background:#f8fafc; border:1px dashed #0284c7; border-radius:8px; padding:12px; margin-bottom:15px; text-align:center;">
                <div style="font-size:0.75rem; color:#64748b; font-weight:700;">TOKEN / e-PIN CODE:</div>
                <div style="font-size:1.2rem; font-weight:800; color:#0284c7; letter-spacing:2px; margin:4px 0;">${tokenOrPin}</div>
                ${serialNo !== 'N/A' ? `<small style="font-size:0.75rem; color:#475569;">Serial No: <strong>${serialNo}</strong></small>` : ''}
            </div>
            ` : ''}

            <!-- Financial Breakdown -->
            <div style="border-top:1px solid #e2e8f0; padding-top:10px; font-size:0.85rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#64748b;">
                    <span>Base Value:</span>
                    <span>₦${parseFloat(cleanAmount).toLocaleString('en-NG', {minimumFractionDigits:2})}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; color:#64748b;">
                    <span>Gateway Processing Fee:</span>
                    <span>₦${parseFloat(feeAmount).toLocaleString('en-NG', {minimumFractionDigits:2})}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:1rem; font-weight:800; color:#0f172a; border-top:1px solid #cbd5e1; padding-top:6px;">
                    <span>Total Amount Paid:</span>
                    <span>₦${parseFloat(totalCharged).toLocaleString('en-NG', {minimumFractionDigits:2})}</span>
                </div>
            </div>

            <!-- Footer Stamp -->
            <div style="text-align:center; margin-top:20px; border-top:1px dashed #cbd5e1; padding-top:10px;">
                <p style="font-size:0.7rem; color:#94a3b8; margin:0;">Automated Digital Settlement Invoice</p>
                <p style="font-size:0.7rem; color:#0284c7; font-weight:700; margin-top:2px;">www.alltimebusiness.com.ng</p>
            </div>
        </div>

        <!-- Print Action Button -->
        <button onclick="printReceiptContent()" style="width:100%; margin-top:15px; padding:12px; background:#10b981; color:#fff; font-weight:800; border:none; border-radius:8px; cursor:pointer; font-size:0.95rem;">🖨 Print / Download PDF Receipt</button>
    `;

    document.getElementById('modalBody').innerHTML = receiptHtml;
    document.getElementById('customModal').style.display = 'flex';
}

// Function to print ONLY the receipt card directly as PDF/Paper
function printReceiptContent() {
    const printWindow = window.open('', '', 'width=600,height=700');
    const content = document.getElementById('printableReceiptArea').outerHTML;
    printWindow.document.write(`
        <html>
            <head>
                <title>Receipt - @BL SOVEREIGN GATEWAY</title>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; background: #fff; padding: 20px; display:flex; justify-content:center; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                ${content}
            </body>
        </html>
    `);
    printWindow.document.close();
}
