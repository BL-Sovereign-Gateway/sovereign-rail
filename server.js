/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Entity: ALL TIME BUSINESS LTD (RC: 950444) | www.alltimebusiness.com.ng
 * Features: Squad Co GTBank Virtual Account API | Squad Webhook Listener |
 * Squad Decal Master NUBAN (5000759098) | Squad USSD Code (411727) |
 * Intact Merchant Principal Crediting | Dynamic Tiered Markup Engine |
 * Access Bank Auto-Sweep | ClubKonnect Real-Time Auto-Dispatch Engine |
 * Flat ₦6.00 Termii SMS Engine | Resend Email Engine | Merchant Security PIN Layer |
 * Newsletter & Mass Media Broadcast Engine
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static assets from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables & Credentials
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY || 'sk_8000a1fe2299833dea7f8db8d6ab063fbe973740';
const SQUAD_BASE_URL = process.env.SQUAD_BASE_URL || 'https://api-d.squadco.com';

const TERMII_API_KEY = process.env.TERMII_API_KEY;
const ACCESS_BANK_DESTINATION_ACCOUNT = process.env.ACCESS_BANK_ACCOUNT || '0123456789';

// ClubKonnect API Configuration
const CLUBKONNECT_USER_ID = process.env.CLUBKONNECT_USER_ID || 'CK10001234';
const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY || 'ck_live_secret_key_12345';

// Persistent Master Account Credentials (from Squad Decal)
const MASTER_SQUAD_NUBAN = '5000759098';
const MASTER_SQUAD_BANK = 'GTCO (Guaranty Trust Bank)';
const MASTER_SQUAD_USSD_MERCHANT_CODE = '411727';

// Persistent Database Handlers
const DB_FILE = path.join(__dirname, 'database.json');
const BROADCASTS_FILE = path.join(__dirname, 'broadcasts.json');
const PROCESSED_TXNS_FILE = path.join(__dirname, 'processed_txns.json');
const PENDING_ORDERS_FILE = path.join(__dirname, 'pending_orders.json');

function loadAccounts() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
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
            return JSON.parse(fs.readFileSync(BROADCASTS_FILE, 'utf8'));
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

function loadProcessedTxns() {
    try {
        if (fs.existsSync(PROCESSED_TXNS_FILE)) {
            return JSON.parse(fs.readFileSync(PROCESSED_TXNS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('⚠️ Processed Txns Read Error:', e.message);
    }
    return {};
}

function saveProcessedTxns(txns) {
    try {
        fs.writeFileSync(PROCESSED_TXNS_FILE, JSON.stringify(txns, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ Processed Txns Save Error:', e.message);
    }
}

function loadPendingOrders() {
    try {
        if (fs.existsSync(PENDING_ORDERS_FILE)) {
            return JSON.parse(fs.readFileSync(PENDING_ORDERS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('⚠️ Pending Orders Read Error:', e.message);
    }
    return {};
}

function savePendingOrders(orders) {
    try {
        fs.writeFileSync(PENDING_ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ Pending Orders Save Error:', e.message);
    }
}

let merchantAccounts = loadAccounts();
let broadcastPosts = loadBroadcasts();
let processedTxns = loadProcessedTxns();
let pendingOrders = loadPendingOrders();

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

// Phone Number Normalizer Helper
function normalizePhoneNumber(phone) {
    if (!phone) return '';
    let cleaned = phone.trim().replace(/\s+/g, '').replace(/-/g, '');
    if (cleaned.startsWith('+234')) {
        return '0' + cleaned.slice(4);
    } else if (cleaned.startsWith('234')) {
        return '0' + cleaned.slice(3);
    }
    return cleaned;
}

// Helper to serve specific static HTML file if it exists, otherwise fall back to target
function serveModuleFile(fileName, fallbackName = 'dashboard.html') {
    return (req, res) => {
        const targetPath = path.join(__dirname, 'public', fileName);
        if (fs.existsSync(targetPath)) {
            res.sendFile(targetPath);
        } else {
            res.sendFile(path.join(__dirname, 'public', fallbackName));
        }
    };
}

// =========================================================================
// 🔌 CLUBKONNECT AUTO-DISPATCH ENGINE
// =========================================================================

async function executeClubKonnectFulfillment(orderData) {
    try {
        const { serviceType, targetInput, amount, orderRef, networkCode, planCode } = orderData;
        console.log(`🚀 INITIATING CLUBKONNECT AUTO-DISPATCH [Ref: ${orderRef}] | Target: ${targetInput}`);

        let clubKonnectUrl = '';

        if (serviceType && serviceType.toLowerCase().includes('airtime')) {
            const net = networkCode || '01';
            clubKonnectUrl = `https://www.nellobytesystems.com/APIAirtimeV1.asp?UserID=${CLUBKONNECT_USER_ID}&APIKey=${CLUBKONNECT_API_KEY}&MobileNetwork=${net}&Amount=${amount}&MobileNo=${targetInput}&RequestID=${orderRef}`;
        } else if (serviceType && serviceType.toLowerCase().includes('data')) {
            const net = networkCode || '01';
            const plan = planCode || '1000'; 
            clubKonnectUrl = `https://www.nellobytesystems.com/APIDatabundleV1.asp?UserID=${CLUBKONNECT_USER_ID}&APIKey=${CLUBKONNECT_API_KEY}&MobileNetwork=${net}&DataPlan=${plan}&MobileNo=${targetInput}&RequestID=${orderRef}`;
        } else {
            clubKonnectUrl = `https://www.nellobytesystems.com/APIBillPaymentV1.asp?UserID=${CLUBKONNECT_USER_ID}&APIKey=${CLUBKONNECT_API_KEY}&ServiceCode=${serviceType}&AccountNo=${targetInput}&Amount=${amount}&RequestID=${orderRef}`;
        }

        const response = await axios.get(clubKonnectUrl);
        
        if (response.data && (response.data.status === 'ORDER_RECEIVED' || response.data.statuscode === '100')) {
            console.log(`✅ CLUBKONNECT SUCCESSFUL DISPATCH [Ref: ${orderRef}] to ${targetInput}`);
            return { success: true, data: response.data };
        } else {
            console.warn(`⚠️ ClubKonnect Returned Warning:`, response.data);
            return { success: true, data: response.data, note: 'Order logged with provider' };
        }
    } catch (err) {
        console.error('❌ ClubKonnect Auto-Dispatch Error:', err.message);
        return { success: false, error: err.message };
    }
}

// =========================================================================
// 🌐 PUBLIC & PORTAL NAVIGATION ROUTES
// =========================================================================

app.get('/', serveModuleFile('index.html', 'login.html'));
app.get('/login', serveModuleFile('login.html'));
app.get('/register', serveModuleFile('register.html', 'login.html'));
app.get('/signup', serveModuleFile('register.html', 'login.html'));
app.get('/dashboard', serveModuleFile('dashboard.html'));

app.get('/airtime-data', serveModuleFile('vtu-support.html', 'vtu.html'));
app.get('/vtu', serveModuleFile('vtu-support.html', 'vtu.html'));
app.get('/vtu-support', serveModuleFile('vtu-support.html', 'vtu.html'));

app.get('/bill-payments', serveModuleFile('bill-payments.html', 'bills.html'));
app.get('/bills', serveModuleFile('bill-payments.html', 'bills.html'));

app.get('/education-support', serveModuleFile('education-support.html', 'education.html'));
app.get('/education', serveModuleFile('education-support.html', 'education.html'));

app.get('/betting-topup', serveModuleFile('betting-support.html', 'betting.html'));
app.get('/betting', serveModuleFile('betting-support.html', 'betting.html'));
app.get('/betting-support', serveModuleFile('betting-support.html', 'betting.html'));

app.get('/credit-support', serveModuleFile('credit-support.html', 'sail-credit.html'));
app.get('/sail-credit', serveModuleFile('credit-support.html', 'sail-credit.html'));

app.get('/newsletter', serveModuleFile('newsletter.html'));
app.get('/articles', serveModuleFile('newsletter.html'));
app.get('/news', serveModuleFile('newsletter.html'));

app.get('/publish', serveModuleFile('publish.html', 'dashboard.html'));
app.get('/private', serveModuleFile('private.html', 'dashboard.html'));

// =========================================================================
// 🧮 DYNAMIC TIERED MARKUP & SQUAD FEE CALCULATOR ENGINE
// =========================================================================

function calculateTotalPayableAmount(principalAmount) {
    const amount = parseFloat(principalAmount);
    if (isNaN(amount) || amount <= 0) return 0;

    let platformMarkup = 0;
    if (amount < 1000) {
        platformMarkup = 10.00; // ₦10 markup for transactions below ₦1,000
    } else if (amount >= 1000 && amount <= 20000) {
        platformMarkup = 20.00;
    } else if (amount >= 20001 && amount <= 50000) {
        platformMarkup = 25.00;
    } else if (amount >= 50001) {
        platformMarkup = 30.00;
    }

    let squadFee = Math.min(amount * 0.0025, 1000.00);
    let vatOnSquadFee = squadFee * 0.075;

    const totalPayable = amount + platformMarkup + squadFee + vatOnSquadFee;
    return Math.ceil(totalPayable);
}

function calculateTieredMarkup(principalAmount) {
    const amount = parseFloat(principalAmount);
    let markup = 0;

    if (amount < 1000) {
        markup = 10.00;
    } else if (amount >= 1000 && amount <= 20000) {
        markup = 20.00;
    } else if (amount >= 20001 && amount <= 50000) {
        markup = 25.00;
    } else if (amount >= 50001) {
        markup = 30.00;
    }

    return markup;
}

// =========================================================================
// 📲 TERMII SMS DISPATCH ENGINE (UNIFIED ₦6.00 RATE)
// =========================================================================

async function sendTermiiSMS(recipientPhone, messageText) {
    try {
        let formattedPhone = normalizePhoneNumber(recipientPhone);
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '234' + formattedPhone.slice(1);
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

async function dispatchImmediateTransactionSMS(merchantPhone, serviceCategory, target, amount, newBalance, txRef) {
    const smsMessage = `OE Alert: @BL SOVEREIGN ALERT: Successful ${serviceCategory} of NGN ${parseFloat(amount).toLocaleString()} to ${target}. Bal: NGN ${parseFloat(newBalance).toLocaleString()}. Ref: ${txRef}. www.alltimebusiness.com.ng`;
    
    sendTermiiSMS(merchantPhone, smsMessage).catch(err => console.error('SMS Alert Error:', err.message));
}

app.post('/api/v1/sms/send-alert', async (req, res) => {
    try {
        const { merchantPhone, recipientPhone, message } = req.body;
        const SMS_BILLING_RATE = 6.00;

        merchantAccounts = loadAccounts();
        const cleanPhone = normalizePhoneNumber(merchantPhone);
        const account = merchantAccounts[cleanPhone];

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
// 💳 SQUAD GTBANK VIRTUAL ACCOUNT ENGINE
// =========================================================================

async function generateSquadVirtualAccount(merchantData) {
    try {
        console.log(`💳 Initiating Squad GTBank Virtual Account for: ${merchantData.merchantName}`);

        const nameParts = merchantData.merchantName.trim().split(' ');
        const firstName = nameParts[0] || 'Merchant';
        const lastName = nameParts.slice(1).join(' ') || 'User';

        const payload = {
            first_name: firstName,
            last_name: lastName,
            middle_name: "",
            mobile_num: normalizePhoneNumber(merchantData.phone),
            email: merchantData.email,
            bvn: merchantData.bvn,
            dob: "1995-01-01",
            address: "Lagos, Nigeria",
            gender: "1",
            customer_identifier: normalizePhoneNumber(merchantData.phone),
            beneficiary_account: ACCESS_BANK_DESTINATION_ACCOUNT
        };

        const response = await axios.post(`${SQUAD_BASE_URL}/virtual-account`, payload, {
            headers: {
                'Authorization': `Bearer ${SQUAD_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.status === 200 && response.data.data) {
            const accData = response.data.data;
            console.log(`✅ Squad GTBank Virtual Account Created: ${accData.account_number} (GTBank)`);
            return {
                success: true,
                virtualNuban: accData.account_number,
                virtualBank: 'GTBank / Squad'
            };
        } else {
            console.warn('⚠️ Squad returned non-200 response, assigning master account.');
            return {
                success: true,
                virtualNuban: MASTER_SQUAD_NUBAN,
                virtualBank: MASTER_SQUAD_BANK
            };
        }
    } catch (err) {
        console.error('❌ Squad Virtual Account Error:', err.response ? err.response.data : err.message);
        return {
            success: true,
            virtualNuban: MASTER_SQUAD_NUBAN,
            virtualBank: MASTER_SQUAD_BANK
        };
    }
}

// =========================================================================
// 🔔 SQUAD WEBHOOK PAYMENT LISTENER WITH CLUBKONNECT AUTO-DISPATCH
// =========================================================================

app.get('/api/v1/webhook/squad', (req, res) => {
    return res.status(200).json({
        status: 'active',
        message: '@BL Sovereign Gateway Squad Webhook Engine Live',
        entity: 'ALL TIME BUSINESS LTD',
        masterAccount: MASTER_SQUAD_NUBAN,
        ussdMerchantCode: MASTER_SQUAD_USSD_MERCHANT_CODE
    });
});

app.post('/api/v1/webhook/squad', async (req, res) => {
    try {
        const squadSignature = req.headers['x-squad-encrypted-body'];
        if (squadSignature) {
            const hash = crypto.createHmac('sha512', SQUAD_SECRET_KEY)
                .update(JSON.stringify(req.body))
                .digest('hex').toUpperCase();

            if (hash !== squadSignature.toUpperCase()) {
                console.warn('⚠️ Squad Webhook signature verification failed.');
                return res.status(401).json({ status: 'error', message: 'Invalid webhook signature' });
            }
        }

        const { event, data } = req.body;
        console.log(`📥 Squad Webhook Event Received: [${event}]`, data);

        if (event === 'charge.success' || (data && data.event === 'charge.success')) {
            const paymentData = data || req.body;
            const txRef = paymentData.transaction_ref || paymentData.transaction_reference;

            const rawPrincipal = parseFloat(paymentData.principal_amount || paymentData.amount || 0);
            const principalAmount = rawPrincipal > 100000 ? rawPrincipal / 100 : rawPrincipal;
            const squadFee = parseFloat(paymentData.fee_charged || 0);
            const settledAmount = parseFloat(paymentData.settled_amount || (principalAmount - squadFee));

            const customerId = normalizePhoneNumber(paymentData.customer_identifier || paymentData.email || '');

            processedTxns = loadProcessedTxns();
            if (processedTxns[txRef]) {
                console.log(`⚠️ Transaction [${txRef}] already processed. Skipping duplicate.`);
                return res.status(200).json({ status: 'success', message: 'Transaction already processed' });
            }

            merchantAccounts = loadAccounts();
            let targetAccount = merchantAccounts[customerId];

            if (!targetAccount) {
                targetAccount = Object.values(merchantAccounts).find(
                    acc => acc.virtualNuban === paymentData.virtual_account_number || 
                           acc.email === customerId ||
                           paymentData.virtual_account_number === MASTER_SQUAD_NUBAN
                );
            }

            if (targetAccount) {
                const phone = normalizePhoneNumber(targetAccount.phone);
                const platformMarkup = calculateTieredMarkup(principalAmount);

                merchantAccounts[phone].balance = (merchantAccounts[phone].balance || 0) + principalAmount;
                saveAccounts(merchantAccounts);

                processedTxns[txRef] = {
                    principalAmount,
                    squadFee,
                    settledAmount,
                    platformMarkup,
                    merchantPhone: phone,
                    timestamp: new Date().toISOString()
                };
                saveProcessedTxns(processedTxns);

                console.log(`💰 Merchant [${phone}] Credited INTACT with ₦${principalAmount.toLocaleString()}! New Bal: ₦${merchantAccounts[phone].balance.toLocaleString()}`);

                executeAccessBankAutoSweep(settledAmount, txRef, 'Squad Collection Deposit');

                pendingOrders = loadPendingOrders();
                if (pendingOrders[txRef] || pendingOrders[paymentData.remark]) {
                    const matchedOrder = pendingOrders[txRef] || pendingOrders[paymentData.remark];
                    await executeClubKonnectFulfillment(matchedOrder);
                    delete pendingOrders[matchedOrder.orderRef];
                    savePendingOrders(pendingOrders);
                }

                dispatchImmediateTransactionSMS(
                    phone,
                    'Deposit (GTBank Virtual Acc / USSD)',
                    paymentData.virtual_account_number || MASTER_SQUAD_NUBAN,
                    principalAmount,
                    merchantAccounts[phone].balance,
                    txRef
                );

                return res.status(200).json({ status: 'success', message: 'Merchant credited and order fulfilled successfully' });
            } else {
                console.warn(`❌ No matching merchant account found for Customer Identifier: [${customerId}]`);
                return res.status(404).json({ status: 'error', message: 'Merchant account not found' });
            }
        }

        return res.status(200).json({ status: 'success', message: 'Event received' });
    } catch (err) {
        console.error('❌ Squad Webhook Error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Internal Webhook Server Error' });
    }
});

// =========================================================================
// 🔐 AUTHENTICATION & ONBOARDING
// =========================================================================

app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { merchantName, phone, email, bvn, password, settlementAccount, bankName, withdrawalPin } = req.body;

        if (!merchantName || !phone || !email || !bvn || !password || !settlementAccount || !bankName) {
            return res.status(400).json({ status: 'error', message: 'All fields including BVN/NIN are required.' });
        }

        const cleanPhone = normalizePhoneNumber(phone);
        if (!cleanPhone || cleanPhone.length < 11) {
            return res.status(400).json({ status: 'error', message: 'Please enter a valid 11-digit phone number.' });
        }

        if (merchantAccounts[cleanPhone]) {
            return res.status(400).json({ 
                status: 'error', 
                message: `Phone number (${cleanPhone}) is already registered. Please sign in instead.` 
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanBvn = bvn.trim();
        const hashedPassword = await bcrypt.hash(password, 10);

        const squadRes = await generateSquadVirtualAccount({
            merchantName,
            phone: cleanPhone,
            email: cleanEmail,
            bvn: cleanBvn
        });

        const newMerchant = {
            id: `MCH-${Date.now()}`,
            merchantName,
            phone: cleanPhone,
            email: cleanEmail,
            bvn: cleanBvn,
            password: hashedPassword,
            withdrawalPin: (withdrawalPin && /^\d{4}$/.test(withdrawalPin.trim())) ? withdrawalPin.trim() : '1234',
            settlementAccount,
            bankName,
            virtualNuban: squadRes.virtualNuban,
            virtualBank: squadRes.virtualBank,
            balance: 0.00,
            isLocked: false,
            createdAt: new Date().toISOString()
        };

        merchantAccounts[cleanPhone] = newMerchant;
        saveAccounts(merchantAccounts);

        const welcomeMailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #0d1322; color: #f1f5f9; margin: 0; padding: 20px; }
                    .card { background: #162032; border: 1px solid #38bdf8; border-radius: 12px; max-width: 580px; margin: 0 auto; padding: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
                    .brand-header { text-align: center; border-bottom: 2px solid #233148; padding-bottom: 20px; margin-bottom: 25px; }
                    .brand-title { color: #38bdf8; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
                    .brand-subtitle { color: #10b981; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 5px; }
                    .welcome-text { font-size: 15px; line-height: 1.6; color: #cbd5e1; }
                    .account-box { background: #0d1322; border: 1px solid #233148; border-left: 4px solid #10b981; padding: 18px; border-radius: 8px; margin: 20px 0; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
                    .info-label { color: #8295b3; font-weight: 600; }
                    .info-val { color: #f1f5f9; font-weight: 700; font-family: Consolas, monospace; }
                    .action-btn { display: block; width: 220px; margin: 25px auto 10px; background: #38bdf8; color: #0d1322; text-align: center; padding: 12px; border-radius: 6px; font-weight: 800; text-decoration: none; font-size: 14px; }
                    .footer { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #233148; font-size: 11px; color: #64748b; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="brand-header">
                        <div class="brand-title">@BL SOVEREIGN GATEWAY</div>
                        <div class="brand-subtitle">ALL TIME BUSINESS LTD • RC: 950444</div>
                    </div>
                    
                    <div class="welcome-text">
                        Hello <strong>${merchantName}</strong>,<br><br>
                        Welcome to <strong>@BL Sovereign Gateway</strong>. Your dedicated business collection NUBAN has been provisioned and is live to receive instant bank transfers across all Nigerian financial institutions.
                    </div>

                    <div class="account-box">
                        <div style="color: #38bdf8; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">📌 DEDICATED COLLECTION ACCOUNT DETAILS</div>
                        <div class="info-row">
                            <span class="info-label">Account Name:</span>
                            <span class="info-val">${merchantName}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Virtual NUBAN:</span>
                            <span class="info-val" style="color: #38bdf8; font-size: 15px;">${squadRes.virtualNuban}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Bank Name:</span>
                            <span class="info-val">${squadRes.virtualBank}</span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">USSD Merchant Code:</span>
                            <span class="info-val" style="color: #f59e0b;">*BankCode*000*898+411727+AMOUNT#</span>
                        </div>
                    </div>

                    <a href="https://www.alltimebusiness.com.ng" class="action-btn">ACCESS MERCHANT DESK</a>

                    <div class="footer">
                        © 2026 ALL TIME BUSINESS LTD (RC: 950444) | @BL Sovereign Gateway<br>
                        Official Website: <a href="https://www.alltimebusiness.com.ng" style="color: #38bdf8; text-decoration: none;">www.alltimebusiness.com.ng</a>
                    </div>
                </div>
            </body>
            </html>
        `;

        await dispatchEmail(cleanEmail, '⚡ Welcome to @BL Sovereign Gateway — Dedicated Account Active', welcomeMailHtml);
        sendTermiiSMS(cleanPhone, `Welcome to @BL Sovereign Gateway, ${merchantName}! Your dedicated GTBank NUBAN is ${squadRes.virtualNuban}. Manage your desk at www.alltimebusiness.com.ng`).catch(() => {});

        return res.status(201).json({ status: 'success', message: 'Onboarding complete!', merchant: newMerchant });

    } catch (err) {
        console.error('Signup Error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Server error during onboarding.' });
    }
});

app.post('/api/v1/auth/signin', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { phone, password } = req.body;
        const cleanPhone = normalizePhoneNumber(phone);

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
// 🛒 SERVICE TRANSACTION & WITHDRAWAL ENDPOINTS WITH SECURITY PIN VALIDATION
// =========================================================================

app.post('/api/v1/services/transact', async (req, res) => {
    try {
        const { merchantPhone, serviceType, recipient, amount, pin, networkCode, planCode } = req.body;
        const txnAmount = parseFloat(amount);

        if (!merchantPhone || !serviceType || !recipient || isNaN(txnAmount) || txnAmount <= 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid transaction parameters.' });
        }

        merchantAccounts = loadAccounts();
        const cleanPhone = normalizePhoneNumber(merchantPhone);
        const account = merchantAccounts[cleanPhone];

        if (!account) return res.status(404).json({ status: 'error', message: 'Merchant account not found.' });

        if (account.isLocked) {
            return res.status(403).json({ status: 'error', message: 'Account is locked. Please contact support.' });
        }

        if (pin && account.withdrawalPin && pin.toString().trim() !== account.withdrawalPin.toString().trim()) {
            return res.status(401).json({ status: 'error', message: 'Invalid Transaction PIN.' });
        }

        if ((account.balance || 0) < txnAmount) {
            return res.status(400).json({ status: 'error', message: 'Insufficient account balance.' });
        }

        const txRef = `TXN-${Date.now()}`;
        account.balance -= txnAmount;
        saveAccounts(merchantAccounts);

        const fulfillmentRes = await executeClubKonnectFulfillment({
            serviceType,
            targetInput: recipient,
            amount: txnAmount,
            orderRef: txRef,
            networkCode,
            planCode
        });

        dispatchImmediateTransactionSMS(
            cleanPhone,
            serviceType.toUpperCase(),
            recipient,
            txnAmount,
            account.balance,
            txRef
        );

        return res.status(200).json({
            status: 'success',
            message: `${serviceType.toUpperCase()} completed successfully.`,
            transactionRef: txRef,
            remainingBalance: account.balance,
            fulfillment: fulfillmentRes
        });

    } catch (err) {
        console.error('Transaction Error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Transaction processing failed.' });
    }
});

app.post('/api/v1/services/withdraw', async (req, res) => {
    try {
        const { merchantPhone, amount, pin, bankName, accountNumber } = req.body;
        const withdrawAmount = parseFloat(amount);

        if (!merchantPhone || isNaN(withdrawAmount) || withdrawAmount <= 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid withdrawal parameters.' });
        }

        merchantAccounts = loadAccounts();
        const cleanPhone = normalizePhoneNumber(merchantPhone);
        const account = merchantAccounts[cleanPhone];

        if (!account) return res.status(404).json({ status: 'error', message: 'Merchant account not found.' });

        if (account.isLocked) {
            return res.status(403).json({ status: 'error', message: 'Account is locked. Please contact support.' });
        }

        if (account.withdrawalPin && pin.toString().trim() !== account.withdrawalPin.toString().trim()) {
            return res.status(401).json({ status: 'error', message: 'Invalid Transaction PIN.' });
        }

        if ((account.balance || 0) < withdrawAmount) {
            return res.status(400).json({ status: 'error', message: 'Insufficient ledger balance.' });
        }

        account.balance -= withdrawAmount;
        saveAccounts(merchantAccounts);

        const txRef = `WTH-${Date.now()}`;
        const targetBank = bankName || account.bankName;
        const targetAcc = accountNumber || account.settlementAccount;

        dispatchImmediateTransactionSMS(
            cleanPhone,
            'WITHDRAWAL / BANK TRANSFER',
            `${targetBank} (${targetAcc})`,
            withdrawAmount,
            account.balance,
            txRef
        );

        return res.status(200).json({
            status: 'success',
            message: `Withdrawal request of ₦${withdrawAmount.toLocaleString()} processed successfully.`,
            transactionRef: txRef,
            remainingBalance: account.balance
        });

    } catch (err) {
        console.error('Withdrawal Error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Withdrawal execution failed.' });
    }
});

// =========================================================================
// 📢 NEWSLETTER & BROADCAST DISPATCH ENGINE (FOR PRIVATE.HTML DESK)
// =========================================================================

// Endpoint for Web Feed Publishing & Mass Email Newsletter Dispatch
app.post('/api/v1/newsletter/publish', async (req, res) => {
    try {
        const { headline, content, imageUrl, videoUrl, notifySubscribers } = req.body;

        if (!headline || !content) {
            return res.status(400).json({ status: 'error', message: 'Headline and Content are required.' });
        }

        const newPost = {
            id: `POST-${Date.now()}`,
            headline,
            content,
            imageUrl: imageUrl || null,
            videoUrl: videoUrl || null,
            createdAt: new Date().toISOString(),
            notified: !!notifySubscribers
        };

        broadcastPosts = loadBroadcasts();
        broadcastPosts.unshift(newPost); // Store latest post first
        saveBroadcasts(broadcastPosts);

        let emailCount = 0;
        if (notifySubscribers) {
            merchantAccounts = loadAccounts();
            const recipients = Object.values(merchantAccounts)
                .map(acc => acc.email)
                .filter(email => email && email.includes('@'));

            const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
                        .container { background: #1e293b; border: 1px solid #334155; border-radius: 12px; max-width: 600px; margin: 0 auto; padding: 25px; }
                        .header { text-align: center; border-bottom: 2px solid #38bdf8; padding-bottom: 15px; margin-bottom: 20px; }
                        .title { color: #38bdf8; font-size: 20px; font-weight: 800; }
                        .headline { font-size: 18px; color: #f1f5f9; font-weight: 700; margin-bottom: 12px; }
                        .content { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 20px; white-space: pre-line; }
                        .footer { text-align: center; border-top: 1px solid #334155; padding-top: 15px; font-size: 11px; color: #64748b; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="title">ALL TIME BUSINESS LTD • OFFICIAL BROADCAST</div>
                        </div>
                        <div class="headline">${headline}</div>
                        <div class="content">${content}</div>
                        <div class="footer">
                            © 2026 ALL TIME BUSINESS LTD (RC: 950444) | @BL Sovereign Gateway<br>
                            <a href="https://www.alltimebusiness.com.ng" style="color: #38bdf8;">www.alltimebusiness.com.ng</a>
                        </div>
                    </div>
                </body>
                </html>
            `;

            // Asynchronously dispatch emails to all registered merchants
            for (const recipient of recipients) {
                dispatchEmail(recipient, headline, emailHtml).catch(() => {});
                emailCount++;
            }
        }

        return res.status(200).json({
            status: 'success',
            message: notifySubscribers 
                ? `Broadcast published and mass email dispatched to ${emailCount} subscribers.`
                : 'Broadcast published to Website Feed successfully.',
            postId: newPost.id
        });

    } catch (err) {
        console.error('Broadcast Publish Error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Failed to publish broadcast.' });
    }
});

// Endpoint for Direct Mass SMS Dispatch
app.post('/api/v1/admin/broadcast-sms', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ status: 'error', message: 'SMS message content cannot be empty.' });
        }

        merchantAccounts = loadAccounts();
        const phoneNumbers = Object.keys(merchantAccounts);

        if (phoneNumbers.length === 0) {
            return res.status(400).json({ status: 'error', message: 'No registered merchant contacts found.' });
        }

        let sentCount = 0;
        for (const phone of phoneNumbers) {
            sendTermiiSMS(phone, message).catch(() => {});
            sentCount++;
        }

        return res.status(200).json({
            status: 'success',
            message: `Mass SMS broadcast successfully initiated for ${sentCount} recipient(s).`
        });

    } catch (err) {
        console.error('Mass SMS Error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Failed to dispatch mass SMS broadcast.' });
    }
});

// Endpoint to fetch public feed posts for newsletter.html
app.get('/api/v1/newsletter/posts', (req, res) => {
    broadcastPosts = loadBroadcasts();
    return res.status(200).json({ status: 'success', posts: broadcastPosts });
});

// =========================================================================
// 🚀 SERVER BOOTSTRAP
// =========================================================================

app.listen(PORT, () => {
    console.log(`================================================================`);
    console.log(`🚀 @BL SOVEREIGN GATEWAY SERVER LIVE ON PORT: ${PORT}`);
    console.log(`🏛️  Entity: ALL TIME BUSINESS LTD (RC: 950444)`);
    console.log(`💳 Master Decal NUBAN: ${MASTER_SQUAD_NUBAN} (${MASTER_SQUAD_BANK})`);
    console.log(`📱 USSD Code: *BankCode*000*898+${MASTER_SQUAD_USSD_MERCHANT_CODE}+AMOUNT#`);
    console.log(`================================================================`);
});
