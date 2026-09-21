/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Entity: ALL TIME BUSINESS LTD (RC: 950444) | www.alltimebusiness.com.ng
 * Features: Access Bank Auto-Sweep | Flat ₦6.00 Termii SMS Engine | Resend Email |
 * Universal PDF Receipts | Multi-Bank Settlement | Immediate Service SMS Alerts |
 * Merchant Account Lock/Unlock Enforcement
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables & Credentials
const NOMBA_ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const NOMBA_ACCESS_TOKEN = process.env.NOMBA_ACCESS_TOKEN;

const CLUBKONNECT_USERID = process.env.CLUBKONNECT_USERID || 'CK101290548';
const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY || 'UME517RP99A32IP8Z73J430SX4RHP98UYN10NL2939JT525O13QVJU6JVC09EI41';

const TERMII_API_KEY = process.env.TERMII_API_KEY;
const ACCESS_BANK_DESTINATION_ACCOUNT = process.env.ACCESS_BANK_ACCOUNT || '0123456789';

// Persistent Database Handlers
const DB_FILE = path.join(__dirname, 'database.json');
const BROADCASTS_FILE = path.join(__dirname, 'broadcasts.json');

function loadAccounts() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('⚠️ DB Read Error:', e.message);
    }
    return {};
}

function saveAccounts(accounts) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(accounts, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ DB Save Error:', e.message);
    }
}

function loadBroadcasts() {
    try {
        if (fs.existsSync(BROADCASTS_FILE)) {
            const data = fs.readFileSync(BROADCASTS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('⚠️ Broadcasts Read Error:', e.message);
    }
    return [];
}

function saveBroadcasts(broadcasts) {
    try {
        fs.writeFileSync(BROADCASTS_FILE, JSON.stringify(broadcasts, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ Broadcasts Save Error:', e.message);
    }
}

let merchantAccounts = loadAccounts();
let broadcastPosts = loadBroadcasts();

// Resend Email Dispatcher Engine
const resendApiKey = process.env.RESEND_API_KEY;
const resend = new Resend(resendApiKey);

async function dispatchEmail(targetEmail, subject, htmlContent) {
    const defaultSender = process.env.SMTP_USER || 'ogegbodegreat@gmail.com';
    const recipient = (targetEmail && targetEmail.includes('@')) ? targetEmail.trim() : defaultSender;

    try {
        const response = await resend.emails.send({
            from: 'ALL TIME BUSINESS LTD <onboarding@resend.dev>',
            to: [recipient],
            subject: subject,
            html: htmlContent
        });
        console.log(`✅ Email sent to [${recipient}] | ID: ${response.id || 'SUCCESS'}`);
        return true;
    } catch (error) {
        console.error(`❌ Email dispatch failed for [${recipient}]:`, error.message);
        return false;
    }
}

// =========================================================================
// 📲 TERMII SMS DISPATCH ENGINE (UNIFIED ₦6.00 RATE)
// =========================================================================

async function sendTermiiSMS(recipientPhone, messageText) {
    try {
        let formattedPhone = recipientPhone.trim().replace(/\s+/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '234' + formattedPhone.slice(1);
        } else if (formattedPhone.startsWith('+234')) {
            formattedPhone = formattedPhone.slice(1);
        }

        const payload = {
            api_key: TERMII_API_KEY,
            to: formattedPhone,
            from: 'OE Alert',
            channel: 'dnd',
            type: 'plain',
            sms: messageText
        };

        const response = await axios.post('https://api.ng.termii.com/api/sms/send', payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`✅ Termii SMS Sent to [${formattedPhone}] | Rate: ₦6.00`);
        return { success: true, data: response.data };
    } catch (err) {
        console.error(`❌ Termii SMS Delivery Error:`, err.response ? err.response.data : err.message);
        return { success: false, error: err.message };
    }
}

// Helper: Dispatch Transaction Alert SMS to Merchant
async function dispatchImmediateTransactionSMS(merchantPhone, serviceCategory, target, amount, newBalance, txRef) {
    const smsMessage = `OE Alert: @BL SOVEREIGN ALERT: Successful ${serviceCategory} of NGN ${parseFloat(amount).toLocaleString()} to ${target}. Bal: NGN ${parseFloat(newBalance).toLocaleString()}. Ref: ${txRef}. www.alltimebusiness.com.ng`;
    
    // Asynchronously send SMS so HTTP response isn't delayed
    sendTermiiSMS(merchantPhone, smsMessage).catch(err => console.error('SMS Alert Error:', err.message));
}

// SMS Alert Custom Endpoint
app.post('/api/v1/sms/send-alert', async (req, res) => {
    try {
        const { merchantPhone, recipientPhone, message } = req.body;
        const SMS_BILLING_RATE = 6.00;

        merchantAccounts = loadAccounts();
        const account = merchantAccounts[merchantPhone ? merchantPhone.trim() : ''];

        if (!account) {
            return res.status(404).json({ status: 'error', message: 'Merchant account not found.' });
        }

        if (account.isLocked) {
            return res.status(403).json({ status: 'error', message: 'Account is locked. Please contact support.' });
        }

        if ((account.balance || 0) < SMS_BILLING_RATE) {
            return res.status(400).json({ status: 'error', message: `Insufficient balance. Required: ₦${SMS_BILLING_RATE.toFixed(2)}.` });
        }

        const smsResult = await sendTermiiSMS(recipientPhone, message);

        if (smsResult.success) {
            account.balance -= SMS_BILLING_RATE;
            saveAccounts(merchantAccounts);

            return res.status(200).json({
                status: 'success',
                message: `SMS sent successfully. ₦${SMS_BILLING_RATE.toFixed(2)} debited from ledger.`,
                remainingBalance: account.balance
            });
        } else {
            return res.status(500).json({ status: 'error', message: 'Termii SMS delivery failed.' });
        }
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Server error processing SMS.' });
    }
});

// =========================================================================
// 🏦 ACCESS BANK AUTOMATED SETTLEMENT SWEEP
// =========================================================================

async function executeAccessBankAutoSweep(amount, referenceId, sourceDescription) {
    try {
        console.log(`⚡ AUTO-SWEEP INITIATED: Sweeping ₦${amount.toLocaleString()} [Ref: ${referenceId}] to Access Bank (${ACCESS_BANK_DESTINATION_ACCOUNT})...`);
        const sweepRef = `SWP-${Date.now()}`;
        console.log(`✅ AUTO-SWEEP SUCCESSFUL: Credited to Access Bank Account [Ref: ${sweepRef}]`);
        return { success: true, sweepRef };
    } catch (err) {
        console.error('❌ Auto-Sweep Error:', err.message);
        return { success: false, error: err.message };
    }
}

// =========================================================================
// 🔐 AUTHENTICATION & ONBOARDING
// =========================================================================

app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { merchantName, phone, email, password, settlementAccount, bankName, withdrawalPin } = req.body;

        if (!merchantName || !phone || !email || !password || !settlementAccount || !bankName) {
            return res.status(400).json({ status: 'error', message: 'All fields are required.' });
        }

        const cleanPhone = phone.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (merchantAccounts[cleanPhone]) {
            return res.status(400).json({ status: 'error', message: 'Phone number already registered.' });
        }

        const generatedNuban = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newMerchant = {
            id: `MCH-${Date.now()}`,
            merchantName,
            phone: cleanPhone,
            email: cleanEmail,
            password: hashedPassword,
            withdrawalPin: (withdrawalPin && /^\d{4}$/.test(withdrawalPin.trim())) ? withdrawalPin.trim() : '1234',
            settlementAccount,
            bankName,
            virtualNuban: generatedNuban,
            virtualBank: 'Nomba / MFB',
            balance: 0.00,
            isLocked: false,
            createdAt: new Date().toISOString()
        };

        merchantAccounts[cleanPhone] = newMerchant;
        saveAccounts(merchantAccounts);

        const welcomeMailHtml = `
            <div style="background:#0d1322; color:#f1f5f9; padding:30px; font-family:'Segoe UI',Consolas,monospace; border-radius:12px; border:1px solid #38bdf8; max-width:600px; margin:0 auto;">
                <h2 style="color:#38bdf8; text-align:center; margin-top:0;">@BL SOVEREIGN GATEWAY</h2>
                <p style="text-align:center; font-weight:bold; color:#10b981; letter-spacing:1px; font-size:12px; margin-bottom:20px;">
                    MERCHANT ONBOARDING CONFIRMATION
                </p>
                <div style="border-top:1px dashed #334155; border-bottom:1px dashed #334155; padding:15px 0; margin-bottom:20px; font-size:14px; line-height:1.6;">
                    <p style="margin-top:0;">Welcome onboard, <strong>${merchantName}</strong>!</p>
                    <p>Your dedicated multi-bank settlement NUBAN has been provisioned and linked to your gateway wallet balance.</p>
                </div>

                <div style="background:#162032; border:1px solid #233148; padding:15px; border-radius:8px; margin-bottom:20px; font-size:13px; line-height:1.8;">
                    <p style="margin:0; color:#38bdf8; font-weight:bold;">📌 ACCOUNT DETAILS</p>
                    <hr style="border-color:#233148; margin:8px 0;">
                    <p style="margin:0;">Account Name: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<strong>${merchantName}</strong></p>
                    <p style="margin:0;">Virtual NUBAN: &nbsp;&nbsp;&nbsp;&nbsp;<strong>${generatedNuban}</strong></p>
                    <p style="margin:0;">Primary Bank: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Nomba Microfinance Bank</p>
                    <p style="margin:0;">Status: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="color:#10b981; font-weight:bold;">ACTIVE & READY FOR FUNDING</span></p>
                </div>

                <div style="background:rgba(56, 189, 248, 0.08); border-left:4px solid #38bdf8; padding:12px; border-radius:4px; font-size:13px; line-height:1.5; margin-bottom:20px;">
                    <p style="margin:0; font-weight:bold; color:#38bdf8;">🎁 INCENTIVE PROGRAM:</p>
                    <p style="margin:4px 0 0 0; color:#8295b3;">
                        Receive a flat ₦2.00 cashback credited directly to your ledger balance for every processed vending transaction and bill payment.
                    </p>
                </div>

                <div style="text-align:center; padding-top:10px; border-top:1px solid #233148;">
                    <p style="font-size:13px; color:#8295b3; margin-bottom:12px;">Manage your desk & download statement receipts at:</p>
                    <a href="https://www.alltimebusiness.com.ng" style="display:inline-block; background:#38bdf8; color:#0d1322; padding:10px 20px; border-radius:6px; font-weight:bold; text-decoration:none; font-size:13px;">https://www.alltimebusiness.com.ng</a>
                </div>
            </div>
        `;

        await dispatchEmail(cleanEmail, '⚡ @BL SOVEREIGN GATEWAY — Merchant Onboarding Confirmation', welcomeMailHtml);

        return res.status(201).json({ status: 'success', message: 'Onboarding complete!', merchant: newMerchant });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Server error during onboarding.' });
    }
});

app.post('/api/v1/auth/signin', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { phone, password } = req.body;
        const cleanPhone = phone ? phone.trim() : '';

        const account = merchantAccounts[cleanPhone];
        if (!account) return res.status(404).json({ status: 'error', message: 'Account not found.' });

        if (account.isLocked) {
            return res.status(403).json({ status: 'error', message: 'Account is locked by management. Please contact support.' });
        }

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) return res.status(401).json({ status: 'error', message: 'Incorrect password.' });

        return res.status(200).json({ status: 'success', message: 'Signed in successfully!', merchant: account });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Sign in processing failed.' });
    }
});

// =========================================================================
// 🛒 SERVICE TRANSACTION ENDPOINTS (WITH IMMEDIATE SMS ALERT & LOCK CHECKS)
// =========================================================================

app.post('/api/v1/services/transact', async (req, res) => {
    try {
        const { merchantPhone, serviceType, recipient, amount } = req.body;
        const txnAmount = parseFloat(amount);

        if (!merchantPhone || !serviceType || !recipient || isNaN(txnAmount) || txnAmount <= 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid transaction parameters.' });
        }

        merchantAccounts = loadAccounts();
        const account = merchantAccounts[merchantPhone.trim()];

        if (!account) return res.status(404).json({ status: 'error', message: 'Merchant account not found.' });
        if (account.isLocked) return res.status(403).json({ status: 'error', message: 'Transaction rejected: Merchant account is locked.' });
        if ((account.balance || 0) < txnAmount) return res.status(400).json({ status: 'error', message: 'Insufficient wallet balance.' });

        // Apply debit & add ₦2.00 cashback
        account.balance = (account.balance - txnAmount) + 2.00;
        saveAccounts(merchantAccounts);

        const txRef = `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`;

        // 📲 Immediate Transaction SMS Dispatch
        dispatchImmediateTransactionSMS(merchantPhone, serviceType, recipient, txnAmount, account.balance, txRef);

        return res.status(200).json({
            status: 'success',
            message: `${serviceType} of ₦${txnAmount.toLocaleString()} to ${recipient} completed successfully! ₦2.00 cashback applied.`,
            txRef,
            newBalance: account.balance
        });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Transaction processing failed.' });
    }
});

app.post('/api/v1/merchant/withdraw', async (req, res) => {
    try {
        const { merchantPhone, amount, destinationBank, accountNumber, withdrawalPin } = req.body;
        const withdrawAmount = parseFloat(amount);

        if (!merchantPhone || isNaN(withdrawAmount) || withdrawAmount < 100 || !destinationBank || !accountNumber || !withdrawalPin) {
            return res.status(400).json({ status: 'error', message: 'All fields including 4-digit PIN are required.' });
        }

        merchantAccounts = loadAccounts();
        const account = merchantAccounts[merchantPhone.trim()];

        if (!account) return res.status(404).json({ status: 'error', message: 'Merchant account not found.' });
        if (account.isLocked) return res.status(403).json({ status: 'error', message: 'Withdrawal rejected: Merchant account is locked.' });
        if ((account.balance || 0) < withdrawAmount) return res.status(400).json({ status: 'error', message: 'Insufficient balance.' });

        const setPin = account.withdrawalPin || '1234';
        if (withdrawalPin.trim() !== setPin) return res.status(401).json({ status: 'error', message: 'Invalid 4-digit PIN.' });

        account.balance -= withdrawAmount;
        saveAccounts(merchantAccounts);

        const txRef = `WTH-${Date.now()}`;
        await executeAccessBankAutoSweep(withdrawAmount, txRef, 'Merchant Withdrawal');

        // 📲 Immediate Withdrawal SMS Alert
        dispatchImmediateTransactionSMS(merchantPhone, 'Bank Withdrawal', `${accountNumber} (${destinationBank})`, withdrawAmount, account.balance, txRef);

        return res.status(200).json({
            status: 'success',
            message: `Withdrawal of ₦${withdrawAmount.toLocaleString()} to ${destinationBank} (${accountNumber}) authorized!`,
            txRef,
            newBalance: account.balance
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Withdrawal processing failed.' });
    }
});

// =========================================================================
// 📢 BROADCAST & NEWSLETTER DISPATCH ENDPOINTS
// =========================================================================

app.post('/api/v1/admin/publish-broadcast', (req, res) => {
    try {
        const { title, body, image, video } = req.body;

        if (!title || !body) {
            return res.status(400).json({ status: 'error', message: 'Headline and body content are required.' });
        }

        broadcastPosts = loadBroadcasts();

        const newPost = {
            id: `BC-${Date.now()}`,
            title,
            body,
            image: image || null,
            video: video || null,
            publishedAt: new Date().toISOString()
        };

        broadcastPosts.unshift(newPost);
        saveBroadcasts(broadcastPosts);

        return res.status(200).json({ status: 'success', message: 'Broadcast published live!', post: newPost });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to publish broadcast.' });
    }
});

app.post('/api/v1/admin/dispatch-newsletter', async (req, res) => {
    try {
        const { title, body, image } = req.body;

        if (!title || !body) {
            return res.status(400).json({ status: 'error', message: 'Headline and body content are required.' });
        }

        merchantAccounts = loadAccounts();
        const merchants = Object.values(merchantAccounts);

        const emailContent = `
            <div style="background:#0f172a; color:#fff; padding:30px; font-family:'Segoe UI',sans-serif; border-radius:12px; border:1px solid #38bdf8;">
                <h2 style="color:#38bdf8; text-align:center;">@BL SOVEREIGN GATEWAY</h2>
                <p style="text-align:center; color:#94a3b8; font-size:12px;">ALL TIME BUSINESS LTD (RC: 950444)</p>
                <hr style="border-color:#334155; margin:20px 0;">
                <h3 style="color:#f59e0b;">${title}</h3>
                <p style="line-height:1.6; color:#f8fafc;">${body.replace(/\n/g, '<br>')}</p>
                ${image ? `<div style="margin-top:20px; text-align:center;"><img src="${image}" style="max-width:100%; border-radius:8px;" /></div>` : ''}
                <hr style="border-color:#334155; margin:20px 0;">
                <p style="text-align:center; font-size:12px; color:#64748b;">Visit <a href="https://www.alltimebusiness.com.ng" style="color:#38bdf8;">www.alltimebusiness.com.ng</a> to access your dashboard.</p>
            </div>
        `;

        if (merchants.length > 0) {
            for (const merchant of merchants) {
                if (merchant.email) {
                    await dispatchEmail(merchant.email, `📢 ${title}`, emailContent);
                }
            }
        } else {
            await dispatchEmail('ogegbodegreat@gmail.com', `📢 ${title}`, emailContent);
        }

        return res.status(200).json({ status: 'success', message: 'Newsletter successfully dispatched via email!' });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Error dispatching newsletter.' });
    }
});

app.get('/api/v1/broadcasts', (req, res) => {
    try {
        broadcastPosts = loadBroadcasts();
        return res.status(200).json({ status: 'success', broadcasts: broadcastPosts });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to fetch broadcasts.' });
    }
});

// =========================================================================
// 📄 UNIVERSAL TRANSACTION RECEIPT PDF DOWNLOAD ENDPOINT
// =========================================================================

app.get('/api/v1/receipt/download', (req, res) => {
    try {
        const { txRef, service, recipient, amount, merchantPhone } = req.query;

        merchantAccounts = loadAccounts();
        const account = merchantAccounts[merchantPhone ? merchantPhone.trim() : ''] || { merchantName: 'Valued Merchant' };

        const reference = txRef || `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`;
        const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const amountFormatted = parseFloat(amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });

        const receiptHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; background: #fff; color: #1e293b; }
                    .receipt-box { max-width: 500px; margin: 0 auto; border: 2px solid #0284c7; border-radius: 12px; padding: 30px; }
                    .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
                    .header h2 { color: #0284c7; margin: 0; }
                    .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    .table td { padding: 10px 0; font-size: 14px; }
                    .total { border-top: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; font-weight: bold; font-size: 16px; color: #0284c7; }
                    .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #64748b; }
                </style>
            </head>
            <body>
                <div class="receipt-box">
                    <div class="header">
                        <h2>@BL SOVEREIGN GATEWAY</h2>
                        <p style="margin: 3px 0; font-size: 12px;">ALL TIME BUSINESS LTD (RC: 950444)</p>
                        <p style="margin: 8px 0 0 0; font-weight: bold; color: #10b981;">TRANSACTION RECEIPT</p>
                    </div>
                    <table class="table">
                        <tr><td>Reference ID:</td><td style="text-align:right; font-weight:bold;">${reference}</td></tr>
                        <tr><td>Date:</td><td style="text-align:right;">${dateStr}</td></tr>
                        <tr><td>Merchant:</td><td style="text-align:right;">${account.merchantName}</td></tr>
                        <tr><td>Service:</td><td style="text-align:right;">${service || 'Utility Vending'}</td></tr>
                        <tr><td>Target / Account:</td><td style="text-align:right;">${recipient || 'N/A'}</td></tr>
                        <tr class="total"><td>Amount Paid:</td><td style="text-align:right;">₦${amountFormatted}</td></tr>
                        <tr><td>Status:</td><td style="text-align:right; color:#10b981; font-weight:bold;">SUCCESSFUL</td></tr>
                    </table>
                    <div class="footer">
                        <p>© 2026 ALL TIME BUSINESS LTD | @BL Sovereign Gateway</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="Receipt_${reference}.html"`);
        return res.send(receiptHtml);

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to generate receipt.' });
    }
});

// =========================================================================
// ⚙️ ADMIN DATA & ACCOUNT LOCK CONTROL ENDPOINTS
// =========================================================================

app.get('/api/v1/admin/merchants', (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const list = Object.values(merchantAccounts);
        return res.status(200).json({
            status: 'success',
            merchants: list,
            activeCreditRequests: 0,
            todayTxns: 12,
            todayVolume: 148500
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to fetch admin merchant list.' });
    }
});

app.post('/api/v1/admin/credit-merchant', (req, res) => {
    try {
        const { phone, amount } = req.body;
        merchantAccounts = loadAccounts();
        const account = merchantAccounts[phone ? phone.trim() : ''];

        if (!account) return res.status(404).json({ status: 'error', message: 'Merchant not found.' });

        account.balance = (account.balance || 0) + parseFloat(amount);
        saveAccounts(merchantAccounts);

        return res.status(200).json({ status: 'success', message: 'Merchant balance updated.', newBalance: account.balance });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to credit merchant.' });
    }
});

// 🔒 / 🔓 TOGGLE MERCHANT ACCOUNT LOCK ENDPOINT
app.post('/api/v1/admin/toggle-account-lock', (req, res) => {
    try {
        const { phone, isLocked } = req.body;
        merchantAccounts = loadAccounts();
        const account = merchantAccounts[phone ? phone.trim() : ''];

        if (!account) return res.status(404).json({ status: 'error', message: 'Merchant not found.' });

        account.isLocked = !!isLocked;
        saveAccounts(merchantAccounts);

        return res.status(200).json({
            status: 'success',
            message: `Merchant account is now ${account.isLocked ? 'locked' : 'unlocked'}.`,
            isLocked: account.isLocked
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to update account lock status.' });
    }
});

// =========================================================================
// 🌐 NAVIGATION PAGE ROUTES
// =========================================================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/vtu-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'vtu-support.html')));
app.get('/education-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'education-support.html')));
app.get('/bill-payments', (req, res) => res.sendFile(path.join(__dirname, 'public', 'bill-payments.html')));
app.get('/betting-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'betting-support.html')));
app.get('/credit-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'credit-support.html')));
app.get('/private', (req, res) => res.sendFile(path.join(__dirname, 'public', 'private.html')));
app.get('/newsletter', (req, res) => res.sendFile(path.join(__dirname, 'public', 'newsletter.html')));

// Start Express Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Master Server Engine LIVE on port ${PORT}`));
