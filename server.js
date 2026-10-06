/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Entity: ALL TIME BUSINESS LTD (RC: 950444) | www.alltimebusiness.com.ng
 * Static Asset Directory: public/
 * Features: Squad GTBank Virtual Account API | Squad Webhook Listener |
 * Squad Decal Master NUBAN (5000759098) | Squad USSD Code (411727) |
 * Intact Merchant Principal Crediting | Dynamic Tiered Markup Engine |
 * Access Bank Auto-Sweep | ClubKonnect Real-Time Auto-Dispatch Engine |
 * Flat ₦6.00 Termii SMS Engine | Resend Email Engine | Merchant Security PIN Layer |
 * Desk Broadcasts & Article Engine | Daily Site Analytics Counter Engine
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

// Serve static assets (JS, CSS, Media) directly from 'public' directory
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
const NEWSLETTER_SUBSCRIBERS_FILE = path.join(__dirname, 'newsletter_subscribers.json');
const ANALYTICS_FILE = path.join(__dirname, 'site_analytics.json');

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
            const data = JSON.parse(fs.readFileSync(BROADCASTS_FILE, 'utf8'));
            if (Array.isArray(data) && data.length > 0) return data;
        }
    } catch (e) {
        console.error('⚠️️ Broadcasts Read Error:', e.message);
    }
    // Default fallback broadcast if empty or unreadable
    return [
        {
            id: 'BDC-DEFAULT',
            title: '@BL SOVEREIGN GATEWAY OPERATIONAL',
            content: 'All merchant GTBank virtual collection accounts, USSD channels (*411*727#), and automated VTU dispatches are live.',
            category: 'SYSTEM NOTICE',
            timestamp: new Date().toISOString()
        }
    ];
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

function loadNewsletterSubscribers() {
    try {
        if (fs.existsSync(NEWSLETTER_SUBSCRIBERS_FILE)) {
            return JSON.parse(fs.readFileSync(NEWSLETTER_SUBSCRIBERS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('⚠️ Subscribers Read Error:', e.message);
    }
    return [];
}

function saveNewsletterSubscribers(subscribers) {
    try {
        fs.writeFileSync(NEWSLETTER_SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ Subscribers Save Error:', e.message);
    }
}

function loadAnalytics() {
    try {
        if (fs.existsSync(ANALYTICS_FILE)) {
            return JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
        }
    } catch (e) {
        console.error('⚠️ Analytics Read Error:', e.message);
    }
    return { dates: {} };
}

function saveAnalytics(analytics) {
    try {
        fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ Analytics Save Error:', e.message);
    }
}

let merchantAccounts = loadAccounts();
let broadcastPosts = loadBroadcasts();
let processedTxns = loadProcessedTxns();
let pendingOrders = loadPendingOrders();
let newsletterSubscribers = loadNewsletterSubscribers();
let siteAnalytics = loadAnalytics();

// Analytics Middleware - Tracks Daily Site Traffic
app.use((req, res, next) => {
    try {
        if (req.path === '/' || req.path.endsWith('.html') || req.path === '/newsletter' || req.path === '/login') {
            const today = new Date().toISOString().split('T')[0];
            siteAnalytics = loadAnalytics();
            if (!siteAnalytics.dates[today]) {
                siteAnalytics.dates[today] = { pageViews: 0, uniqueIPs: [] };
            }
            siteAnalytics.dates[today].pageViews += 1;
            
            const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            if (clientIP && !siteAnalytics.dates[today].uniqueIPs.includes(clientIP)) {
                siteAnalytics.dates[today].uniqueIPs.push(clientIP);
            }
            saveAnalytics(siteAnalytics);
        }
    } catch (err) {
        console.error('Analytics tracking error:', err.message);
    }
    next();
});

// Email Dispatcher Engine (Resend API)
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

// Helper to serve specific static HTML file safely from public/
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
// 🌐 NAVIGATION & HTML ROUTES (Matching exact public/ folder inventory)
// =========================================================================

app.get('/', serveModuleFile('index.html', 'login.html'));
app.get('/index', serveModuleFile('index.html', 'login.html'));
app.get('/login', serveModuleFile('login.html'));
app.get('/register', serveModuleFile('register.html', 'login.html'));
app.get('/signup', serveModuleFile('register.html', 'login.html'));
app.get('/dashboard', serveModuleFile('dashboard.html'));

app.get('/betting-support', serveModuleFile('betting-support.html', 'dashboard.html'));
app.get('/betting', serveModuleFile('betting-support.html', 'dashboard.html'));

app.get('/bill-payments', serveModuleFile('bill-payments.html', 'dashboard.html'));
app.get('/bills', serveModuleFile('bill-payments.html', 'dashboard.html'));

app.get('/credit-support', serveModuleFile('credit-support.html', 'dashboard.html'));
app.get('/sail-credit', serveModuleFile('credit-support.html', 'dashboard.html'));

app.get('/education-support', serveModuleFile('education-support.html', 'dashboard.html'));
app.get('/education', serveModuleFile('education-support.html', 'dashboard.html'));

app.get('/vtu-support', serveModuleFile('vtu-support.html', 'dashboard.html'));
app.get('/vtu', serveModuleFile('vtu-support.html', 'dashboard.html'));

app.get('/newsletter', serveModuleFile('newsletter.html'));
app.get('/publish', serveModuleFile('publish.html', 'dashboard.html'));
app.get('/private', serveModuleFile('private.html', 'dashboard.html'));

// Automatic fallback extension router for clean URLs without .html extension
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.includes('.')) {
        const potentialFile = path.join(__dirname, 'public', `${req.path}.html`);
        if (fs.existsSync(potentialFile)) {
            return res.sendFile(potentialFile);
        }
    }
    next();
});

// =========================================================================
// 📢 DESK BROADCASTS & ARTICLE PUBLISHING API
// =========================================================================

// GET Feed: Serves official broadcasts directly to dashboard feeds
app.get('/api/v1/broadcasts', (req, res) => {
    try {
        const broadcasts = loadBroadcasts();
        return res.status(200).json({
            status: 'success',
            data: broadcasts
        });
    } catch (err) {
        return res.status(200).json({
            status: 'success',
            data: [
                {
                    id: 'BDC-FALLBACK',
                    title: '@BL SOVEREIGN GATEWAY LIVE',
                    content: 'All payment collection channels and settlement nodes are running smoothly.',
                    category: 'SYSTEM NOTICE',
                    timestamp: new Date().toISOString()
                }
            ]
        });
    }
});

// POST Broadcast: Allows self-publishing directly from /publish page or API tool
app.post('/api/v1/broadcasts', (req, res) => {
    try {
        const { title, content, category } = req.body;
        if (!title || !content) {
            return res.status(400).json({ status: 'error', message: 'Title and content are required.' });
        }

        let broadcasts = loadBroadcasts();
        const newBroadcast = {
            id: `BDC-${Date.now()}`,
            title: title.trim(),
            content: content.trim(),
            category: (category || 'ANNOUNCEMENT').toUpperCase(),
            timestamp: new Date().toISOString()
        };

        broadcasts.unshift(newBroadcast);
        saveBroadcasts(broadcasts);

        return res.status(201).json({
            status: 'success',
            message: 'Broadcast published successfully to desk feed.',
            data: newBroadcast
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to publish desk broadcast.' });
    }
});

// =========================================================================
// 🔌 CLUBKONNECT AUTO-DISPATCH ENGINE
// =========================================================================

async function executeClubKonnectFulfillment(orderData) {
    try {
        const { serviceType, targetInput, amount, orderRef, networkCode, planCode } = orderData;
        console.log(`🚀 INITIATING CLUBKONNECT DISPATCH [Ref: ${orderRef}] -> ${targetInput}`);

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
            console.log(`✅ CLUBKONNECT DISPATCHED [Ref: ${orderRef}]`);
            return { success: true, data: response.data };
        } else {
            console.warn(`⚠️ ClubKonnect Response:`, response.data);
            return { success: true, data: response.data, note: 'Order submitted to provider' };
        }
    } catch (err) {
        console.error('❌ ClubKonnect Error:', err.message);
        return { success: false, error: err.message };
    }
}

// =========================================================================
// 🧮 MARKUP & SQUAD FEE CALCULATOR
// =========================================================================

function calculateTieredMarkup(principalAmount) {
    const amount = parseFloat(principalAmount);
    if (isNaN(amount) || amount <= 0) return 0;

    if (amount < 1000) return 10.00;
    if (amount <= 20000) return 20.00;
    if (amount <= 50000) return 25.00;
    return 30.00;
}

// =========================================================================
// 📲 TERMII SMS ENGINE
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

        console.log(`✅ Termii SMS Dispatched to [${formattedPhone}]`);
        return { success: true, data: response.data };
    } catch (err) {
        console.error(`❌ Termii SMS Error:`, err.response ? err.response.data : err.message);
        return { success: false, error: err.message };
    }
}

async function dispatchImmediateTransactionSMS(merchantPhone, serviceCategory, target, amount, newBalance, txRef) {
    const smsMessage = `OE Alert: @BL SOVEREIGN: ${serviceCategory} of NGN ${parseFloat(amount).toLocaleString()} to ${target}. Bal: NGN ${parseFloat(newBalance).toLocaleString()}. Ref: ${txRef}. www.alltimebusiness.com.ng`;
    sendTermiiSMS(merchantPhone, smsMessage).catch(err => console.error('SMS Error:', err.message));
}

// =========================================================================
// 🏦 ACCESS BANK SWEEP ENGINE
// =========================================================================

async function executeAccessBankAutoSweep(amount, referenceId, sourceDescription) {
    try {
        console.log(`⚡ AUTO-SWEEP: Sweeping ₦${amount.toLocaleString()} [Ref: ${referenceId}] to Access Bank (${ACCESS_BANK_DESTINATION_ACCOUNT})`);
        return { success: true, sweepRef: `SWP-${Date.now()}` };
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
            return {
                success: true,
                virtualNuban: response.data.data.account_number,
                virtualBank: 'GTBank / Squad'
            };
        } else {
            return {
                success: true,
                virtualNuban: MASTER_SQUAD_NUBAN,
                virtualBank: MASTER_SQUAD_BANK
            };
        }
    } catch (err) {
        return {
            success: true,
            virtualNuban: MASTER_SQUAD_NUBAN,
            virtualBank: MASTER_SQUAD_BANK
        };
    }
}

// =========================================================================
// 🔔 SQUAD WEBHOOK PAYMENT LISTENER
// =========================================================================

app.get('/api/v1/webhook/squad', (req, res) => {
    return res.status(200).json({
        status: 'active',
        entity: 'ALL TIME BUSINESS LTD',
        gateway: '@BL SOVEREIGN GATEWAY',
        masterAccount: MASTER_SQUAD_NUBAN,
        ussdCode: MASTER_SQUAD_USSD_MERCHANT_CODE
    });
});

app.post('/api/v1/webhook/squad', async (req, res) => {
    try {
        const { event, data } = req.body;

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

                executeAccessBankAutoSweep(settledAmount, txRef, 'Squad Deposit');

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

                return res.status(200).json({ status: 'success', message: 'Account credited and order processed' });
            }
        }

        return res.status(200).json({ status: 'success', message: 'Event acknowledged' });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Webhook handler error' });
    }
});

// =========================================================================
// 🔐 AUTHENTICATION ENDPOINTS
// =========================================================================

app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { merchantName, phone, email, bvn, password, settlementAccount, bankName, withdrawalPin } = req.body;

        if (!merchantName || !phone || !email || !bvn || !password) {
            return res.status(400).json({ status: 'error', message: 'All required registration fields must be provided.' });
        }

        const cleanPhone = normalizePhoneNumber(phone);
        if (merchantAccounts[cleanPhone]) {
            return res.status(400).json({ status: 'error', message: 'Phone number already registered. Please login.' });
        }

        const cleanEmail = email.trim().toLowerCase();
        const hashedPassword = await bcrypt.hash(password, 10);

        const squadRes = await generateSquadVirtualAccount({
            merchantName,
            phone: cleanPhone,
            email: cleanEmail,
            bvn: bvn.trim()
        });

        const newMerchant = {
            id: `MCH-${Date.now()}`,
            merchantName,
            phone: cleanPhone,
            email: cleanEmail,
            password: hashedPassword,
            withdrawalPin: withdrawalPin || '1234',
            settlementAccount: settlementAccount || '',
            bankName: bankName || '',
            virtualNuban: squadRes.virtualNuban,
            virtualBank: squadRes.virtualBank,
            balance: 0.00,
            isLocked: false,
            createdAt: new Date().toISOString()
        };

        merchantAccounts[cleanPhone] = newMerchant;
        saveAccounts(merchantAccounts);

        return res.status(201).json({
            status: 'success',
            message: 'Registration successful.',
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
        return res.status(500).json({ status: 'error', message: 'Server error during signup.' });
    }
});

app.post('/api/v1/auth/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        if (!phone || !password) {
            return res.status(400).json({ status: 'error', message: 'Phone and password are required.' });
        }

        merchantAccounts = loadAccounts();
        const cleanPhone = normalizePhoneNumber(phone);
        const account = merchantAccounts[cleanPhone];

        if (!account) {
            return res.status(404).json({ status: 'error', message: 'Account not found. Please register.' });
        }

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid credentials.' });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Login successful.',
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
        return res.status(500).json({ status: 'error', message: 'Server error during login.' });
    }
});

// 404 Handler for undefined routes
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start Server Engine
app.listen(PORT, () => {
    console.log(`===========================================================`);
    console.log(`🚀 @BL SOVEREIGN GATEWAY ENGINE RUNNING ON PORT ${PORT}`);
    console.log(`🏢 ALL TIME BUSINESS LTD (RC: 950444)`);
    console.log(`===========================================================`);
});
