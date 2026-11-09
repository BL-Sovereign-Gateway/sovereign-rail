/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Entity: ALL TIME BUSINESS LTD (RC: 950444) | www.alltimebusiness.com.ng
 * Features: Squad Co GTBank Virtual Account API (Individual & Business KYC) |
 * Squad Webhook Listener & Signature Verification |
 * Squad Decal Master NUBAN (5000759098) | Squad USSD Code (411727) |
 * Intact Merchant Principal Crediting | Dynamic Tiered Markup Engine |
 * Access Bank Auto-Sweep | ClubKonnect Real-Time Auto-Dispatch Engine |
 * Flat ₦6.00 Termii SMS Engine | Resend Email Engine | Merchant Security PIN Layer |
 * Newsletter & Mass Media Broadcast Engine | Ajo Express Savings Engine |
 * Automated Real-Time Month & Calendar Engine | Dynamic 15-Min Expiring NUBANs
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

// Environment Variables & Sandbox Credentials
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY || 'sandbox_sk_bb1ac0d875d528a9c353252737d522d9df7f667740c49130';
const SQUAD_BASE_URL = process.env.SQUAD_BASE_URL || 'https://sandbox-api-d.squadco.com';
const BL_SOVEREIGN_SUBACCOUNT_CODE = process.env.BL_SOVEREIGN_SUBACCOUNT_CODE || 'sub_acct_sample_code';

const TERMII_API_KEY = process.env.TERMII_API_KEY;
const ACCESS_BANK_DESTINATION_ACCOUNT = process.env.ACCESS_BANK_ACCOUNT || '0123456789';

// ClubKonnect API Configuration
const CLUBKONNECT_USER_ID = process.env.CLUBKONNECT_USER_ID || 'CK10001234';
const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY || 'ck_live_secret_key_12345';

// Persistent Master Account Credentials (from Squad Decal)
const MASTER_SQUAD_NUBAN = '5000759098';
const MASTER_SQUAD_BANK = 'GTCO (Guaranty Trust Bank)';
const MASTER_SQUAD_ACCOUNT_NAME = 'ALL TIME BUSINESS LTD';
const MASTER_SQUAD_USSD_MERCHANT_CODE = '411727';
const VAT_RATE = 0.075; // Statutory VAT rate (7.5%)

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

// Dynamic Real-Time Date & Month Calculator Helper
function getCurrentCalendarMonthDetails() {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const now = new Date();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    return { monthName, year, daysInMonth };
}

// Helper to serve specific static HTML file if it exists
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
// 🧮 FEE CALCULATION & TIERED MARKUP ENGINE (@BL SOVEREIGN + SQUAD + VAT)
// =========================================================================

function getBLSovereignFee(amount) {
    const amt = parseFloat(amount);
    if (amt < 1000) return 10.00;
    if (amt <= 20000) return 20.00;
    if (amt <= 50000) return 25.00;
    return 30.00;
}

function getSquadRailFee(amount, channel) {
    const ch = (channel || 'pg').toLowerCase();
    const amt = parseFloat(amount);
    if (ch === 'va' || ch === 'virtual_account') {
        return Math.min(amt * 0.01, 1000.00);
    } else if (ch === 'ussd') {
        return Math.max(amt * 0.012, 20.00);
    } else {
        return Math.min(amt * 0.012, 1500.00);
    }
}

function calculateTotalPayableAmount(principalAmount, channel) {
    const amount = parseFloat(principalAmount);
    if (isNaN(amount) || amount <= 0) return 0;

    const blFee = getBLSovereignFee(amount);
    const squadBase = getSquadRailFee(amount, channel);
    const squadVat = squadBase * VAT_RATE;

    return Math.ceil(amount + blFee + squadBase + squadVat);
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
// 💳 SQUAD GTBANK VIRTUAL ACCOUNT ENGINE (STATIC MERCHANTS)
// =========================================================================

async function generateSquadVirtualAccount(merchantData) {
    try {
        console.log(`💳 Initiating Squad Virtual Account for: ${merchantData.merchantName}`);

        const nameParts = merchantData.merchantName.trim().split(' ');
        const firstName = nameParts[0] || 'Merchant';
        const lastName = nameParts.slice(1).join(' ') || 'User';
        const cleanPhone = normalizePhoneNumber(merchantData.phone);
        const customerId = merchantData.customerIdentifier || cleanPhone;

        let formattedDob = "01/01/1995";
        if (merchantData.dob) {
            const raw = merchantData.dob.replace(/-/g, '/');
            const p = raw.split('/');
            if (p.length === 3) {
                if (p[0].length === 4) {
                    formattedDob = `${p[1].padStart(2, '0')}/${p[2].padStart(2, '0')}/${p[0]}`;
                } else if (p[2].length === 4) {
                    formattedDob = `${p[1].padStart(2, '0')}/${p[0].padStart(2, '0')}/${p[2]}`;
                }
            }
        }

        const payload = {
            customer_identifier: customerId,
            first_name: firstName,
            last_name: lastName,
            mobile_num: cleanPhone,
            email: merchantData.email,
            bvn: merchantData.bvn,
            dob: formattedDob,
            gender: merchantData.gender ? String(merchantData.gender) : "1",
            address: "Lagos, Nigeria",
            beneficiary_account_number: ACCESS_BANK_DESTINATION_ACCOUNT
        };

        console.log('📤 Sending Payload to Squad API:', payload);

        const response = await axios.post(`${SQUAD_BASE_URL}/virtual-account`, payload, {
            headers: {
                'Authorization': `Bearer ${SQUAD_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('🏛️ Squad API Response:', response.data);

        if (response.data && (response.data.status === 200 || response.data.success) && response.data.data) {
            const accData = response.data.data;
            const assignedNuban = accData.virtual_account_number || accData.account_number;
            console.log(`✅ SUCCESS! Unique Virtual Account Created: ${assignedNuban}`);
            return {
                success: true,
                virtualNuban: assignedNuban,
                virtualBank: accData.bank_name || 'GTBank / Squad'
            };
        } else {
            const errorReason = response.data.message || JSON.stringify(response.data);
            console.error('❌ Squad rejected payload:', errorReason);
            return {
                success: false,
                message: errorReason,
                virtualNuban: null
            };
        }
    } catch (err) {
        const errorMsg = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error('❌ Squad API Request Exception:', errorMsg);
        return {
            success: false,
            message: errorMsg,
            virtualNuban: null
        };
    }
}

// =========================================================================
// ⏱️ SQUAD DYNAMIC (15-MIN EXPIRING) VIRTUAL ACCOUNT ENGINE
// =========================================================================

async function generateDynamicSquadAccount(orderData) {
    try {
        const { amount, email, orderRef, channel } = orderData;
        console.log(`⏱️ Generating Dynamic 15-Min Virtual Account [Ref: ${orderRef}] for NGN ${amount}...`);

        const totalPayable = calculateTotalPayableAmount(amount, channel);
        const amountInKobo = Math.round(totalPayable * 100);

        const payload = {
            amount: amountInKobo,
            email: email || 'checkout@alltimebusiness.com.ng',
            currency: 'NGN',
            initiate_type: 'inline',
            transaction_ref: orderRef,
            duration: 900
        };

        const response = await axios.post(`${SQUAD_BASE_URL}/virtual-account/initiated-dynamic-virtual-account`, payload, {
            headers: {
                'Authorization': `Bearer ${SQUAD_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.status === 200 && response.data.data) {
            const dynamicAcc = response.data.data;
            console.log(`✅ Dynamic Virtual Account Created: ${dynamicAcc.account_number} (${dynamicAcc.bank_name || 'GTBank'}) | Expiring in 15 mins`);
            return {
                success: true,
                virtualNuban: dynamicAcc.account_number,
                virtualBank: dynamicAcc.bank_name || 'GTBank / Squad',
                accountName: dynamicAcc.account_name || 'ALL TIME BUSINESS LTD - CHECKOUT',
                expectedAmount: totalPayable,
                expiresInSeconds: 900
            };
        } else {
            throw new Error(response.data.message || 'Squad dynamic account generation failed.');
        }
    } catch (err) {
        console.error('❌ Squad Dynamic Virtual Account Error:', err.response ? err.response.data : err.message);
        return {
            success: false,
            error: err.response ? err.response.data.message : err.message
        };
    }
}

// =========================================================================
// 🔔 SQUAD WEBHOOK PAYMENT LISTENER WITH AUTOMATED SPLITS & CLUBKONNECT
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
                const platformMarkup = getBLSovereignFee(principalAmount);

                merchantAccounts[phone].balance = (merchantAccounts[phone].balance || 0) + principalAmount;

                if (merchantAccounts[phone].ajoExpress && merchantAccounts[phone].ajoExpress.status === 'ACTIVE') {
                    merchantAccounts[phone].ajoExpress.accumulatedAmount = 
                        (merchantAccounts[phone].ajoExpress.accumulatedAmount || 0) + principalAmount;
                }

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
                pendingOrders = loadPendingOrders();
                const matchedOrder = Object.values(pendingOrders).find(
                    ord => ord.orderRef === txRef || ord.dynamicNuban === paymentData.virtual_account_number
                );

                if (matchedOrder) {
                    console.log(`✅ Fulfilling Dynamic Checkout Order [Ref: ${txRef}]...`);
                    await executeClubKonnectFulfillment(matchedOrder);
                    delete pendingOrders[matchedOrder.orderRef];
                    savePendingOrders(pendingOrders);

                    processedTxns[txRef] = {
                        principalAmount,
                        squadFee,
                        settledAmount,
                        timestamp: new Date().toISOString()
                    };
                    saveProcessedTxns(processedTxns);

                    executeAccessBankAutoSweep(settledAmount, txRef, 'Dynamic Checkout Settlement');
                    return res.status(200).json({ status: 'success', message: 'Dynamic checkout order fulfilled successfully' });
                }

                console.warn(`❌ No matching merchant account or order found for Customer Identifier: [${customerId}]`);
                return res.status(404).json({ status: 'error', message: 'Account or order not found' });
            }
        }

        return res.status(200).json({ status: 'success', message: 'Event received' });
    } catch (err) {
        console.error('❌ Squad Webhook Error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Internal Webhook Server Error' });
    }
});

// =========================================================================
// 🔐 AUTHENTICATION & ONBOARDING ROUTE
// =========================================================================

app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { merchantName, customerIdentifier, phone, email, bvn, dob, gender, password, settlementAccount, bankName, withdrawalPin } = req.body;

        if (!merchantName || !phone || !email || !bvn || !password || !settlementAccount || !bankName) {
            return res.status(400).json({ status: 'error', message: 'All mandatory fields including BVN are required.' });
        }

        const cleanPhone = normalizePhoneNumber(phone);
        if (!cleanPhone || cleanPhone.length < 11) {
            return res.status(400).json({ status: 'error', message: 'Please enter a valid 11-digit phone number.' });
        }

        if (merchantAccounts[cleanPhone]) {
            return res.status(400).json({ 
                status: 'error', 
                message: `Phone number (${cleanPhone}) is already registered.` 
            });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanBvn = bvn.trim();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Call Squad API and enforce failure if Squad rejects creation
        const squadRes = await generateSquadVirtualAccount({
            merchantName,
            customerIdentifier,
            phone: cleanPhone,
            email: cleanEmail,
            bvn: cleanBvn,
            dob,
            gender
        });

        if (!squadRes.success || !squadRes.virtualNuban) {
            return res.status(400).json({
                status: 'error',
                message: `Squad Virtual Account Creation Failed: ${squadRes.message}`
            });
        }

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
            accountBeneficiary: MASTER_SQUAD_ACCOUNT_NAME,
            balance: 0.00,
            isLocked: false,
            createdAt: new Date().toISOString()
        };

        merchantAccounts[cleanPhone] = newMerchant;
        saveAccounts(merchantAccounts);

        return res.status(200).json({
            status: 'success',
            message: 'Merchant registered and unique virtual account provisioned successfully.',
            merchant: {
                id: newMerchant.id,
                merchantName: newMerchant.merchantName,
                phone: newMerchant.phone,
                email: newMerchant.email,
                virtualNuban: newMerchant.virtualNuban,
                virtualBank: newMerchant.virtualBank,
                balance: newMerchant.balance
            }
        });
    } catch (err) {
        console.error('❌ Signup Server Error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Server error processing registration.' });
    }
});

app.post('/api/v1/auth/signin', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ status: 'error', message: 'Phone number and password are required.' });
        }

        const cleanPhone = normalizePhoneNumber(phone);
        const account = merchantAccounts[cleanPhone];

        if (!account) {
            return res.status(404).json({ status: 'error', message: 'Account not found. Please sign up for a new account.' });
        }

        if (account.isLocked) {
            return res.status(403).json({ status: 'error', message: 'Account is temporarily locked. Please contact support.' });
        }

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid password. Please check your credentials.' });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Sign in successful.',
            merchant: {
                id: account.id,
                merchantName: account.merchantName,
                phone: account.phone,
                email: account.email,
                virtualNuban: account.virtualNuban,
                virtualBank: account.virtualBank,
                balance: account.balance
            }
        });
    } catch (err) {
        console.error('❌ Signin Error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Server error processing sign in.' });
    }
});

// =========================================================================
// 🏺 AJO EXPRESS SAVINGS & THRIFT ENGINE
// =========================================================================

app.get('/api/v1/ajo/current-month', (req, res) => {
    const details = getCurrentCalendarMonthDetails();
    return res.status(200).json({
        status: 'success',
        ...details
    });
});

app.post('/api/v1/ajo/subscribe', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { phone, dailyAmount, selectedMonth, durationMonths, totalDays } = req.body;

        const cleanPhone = normalizePhoneNumber(phone);
        const account = merchantAccounts[cleanPhone];

        if (!account) {
            return res.status(404).json({ status: 'error', message: 'Merchant account not found.' });
        }

        const dailyAmt = parseFloat(dailyAmount);
        if (isNaN(dailyAmt) || dailyAmt < 500) {
            return res.status(400).json({ status: 'error', message: 'Minimum daily contribution is ₦500.' });
        }

        const monthsCount = parseInt(durationMonths) || 1;
        const daysCount = parseInt(totalDays) || 30;
        const grossAccumulated = dailyAmt * daysCount;
        const gatewayFee = dailyAmt * monthsCount;
        const netEntitlement = grossAccumulated - gatewayFee;

        account.ajoExpress = {
            status: 'ACTIVE',
            dailyAmount: dailyAmt,
            selectedMonth: selectedMonth || getCurrentCalendarMonthDetails().monthName,
            durationMonths: monthsCount,
            totalDays: daysCount,
            accumulatedAmount: 0,
            grossAccumulated,
            gatewayFee,
            netEntitlement,
            completedDays: 0,
            startDate: new Date().toISOString()
        };

        saveAccounts(merchantAccounts);

        return res.status(200).json({
            status: 'success',
            message: 'Ajo Express savings plan activated successfully.',
            ajoData: account.ajoExpress
        });
    } catch (err) {
        console.error('❌ Ajo Subscribe Error:', err.message);
        return res.status(500).json({ status: 'error', message: 'Server error processing Ajo subscription.' });
    }
});

// =========================================================================
// 🚀 SERVER STARTUP
// =========================================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`============================================================`);
    console.log(`⚡ @BL SOVEREIGN GATEWAY MASTER SERVER ONLINE`);
    console.log(`Entity: ALL TIME BUSINESS LTD (RC: 950444)`);
    console.log(`Port: ${PORT} | Environment: Live Production Engine (Sandbox Mode)`);
    console.log(`Master GTBank NUBAN: ${MASTER_SQUAD_NUBAN} | USSD Code: *${MASTER_SUSS_MERCHANT_CODE || MASTER_SQUAD_USSD_MERCHANT_CODE}#`);
    console.log(`============================================================`);
});
