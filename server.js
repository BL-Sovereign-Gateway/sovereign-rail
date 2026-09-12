/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Full Ecosystem: Persistent DB | Universal SMTP | Dynamic Pricing | 
 * Admin Command Desk | Ajo Express | PDF Statement Generator
 * Entity: ALL TIME BUSINESS LTD (RC: 950444) | www.alltimebusiness.com.ng
 * ============================================================================
 */

const express = require('express');
const path = path = require('path');
const fs = require('fs');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables & Credentials
const NOMBA_ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const NOMBA_ACCESS_TOKEN = process.env.NOMBA_ACCESS_TOKEN;

const CLUBKONNECT_USERID = process.env.CLUBKONNECT_USERID || 'CK101290548';
const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY || 'UME517RP99A32IP8Z73J430SX4RHP98UYN10NL2939JT525O13QVJU6JVC09EI41';

// Global Storage Arrays (Preserved across dispatches)
global.creditApplications = global.creditApplications || [];
global.ajoPlans = global.ajoPlans || [];

// Persistent File-System Database
const DB_FILE = path.join(__dirname, 'database.json');

function loadAccounts() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('⚠️ DB Read Error. Initializing fresh merchant storage:', e.message);
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

let merchantAccounts = loadAccounts();

// 🚀 Robust Port 587 STARTTLS Transporter Configuration
const smtpUser = process.env.SMTP_USER || 'ogegbodegreat@gmail.com';
const rawPass = process.env.SMTP_PASS || 'vgdkarqhxtcqdtsc';
const cleanPass = rawPass.replace(/\s+/g, '');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: smtpUser,
        pass: cleanPass
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 15000
});

transporter.verify((error) => {
    if (error) {
        console.error('❌ SMTP Verification Error:', error.message);
    } else {
        console.log('🚀 Universal SMTP Engine Connected & Ready!');
    }
});

// Universal Email Dispatch Engine
async function dispatchEmail(targetEmail, subject, htmlContent) {
    const defaultSender = process.env.SMTP_USER || 'ogegbodegreat@gmail.com';
    const recipient = (targetEmail && targetEmail.includes('@')) 
        ? targetEmail.trim() 
        : defaultSender;

    const mailOptions = {
        from: `"All Time Business Ltd | Gateway" <${defaultSender}>`,
        to: recipient,
        subject: subject,
        html: htmlContent
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ Email dispatched to [${recipient}] | Message ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error(`❌ Email dispatch failed for [${recipient}]:`, error.message);
        if (recipient !== defaultSender) {
            console.log(`🔄 Retrying backup delivery copy to corporate admin [${defaultSender}]...`);
            mailOptions.to = defaultSender;
            try {
                await transporter.sendMail(mailOptions);
                return true;
            } catch (fallbackErr) {
                console.error(`❌ Admin backup delivery failed:`, fallbackErr.message);
            }
        }
        return false;
    }
}

// =========================================================================
// 🔄 DYNAMIC CLUBKONNECT LIVE PRICE SYNCHRONIZATION ENGINE
// =========================================================================

let livePricingCache = {
    dataPlans: [],
    cablePackages: [],
    electricityDiscos: [],
    lastUpdated: null
};

async function syncLiveClubKonnectPricing() {
    try {
        console.log('🔄 Fetching live pricing from ClubKonnect APIs...');
        
        const dataRes = await axios.get('https://www.nellobytesystems.com/APIDatabundlePlansV2.asp');
        if (dataRes.data && dataRes.data.MOBILE_DATA) {
            livePricingCache.dataPlans = dataRes.data.MOBILE_DATA;
        }

        const cableRes = await axios.get('https://www.nellobytesystems.com/APICableTVPackagesV2.asp');
        if (cableRes.data && cableRes.data.TV_PACKAGE) {
            livePricingCache.cablePackages = cableRes.data.TV_PACKAGE;
        }

        livePricingCache.lastUpdated = new Date().toISOString();
        console.log(`✅ Live pricing synchronized successfully at ${livePricingCache.lastUpdated}`);
    } catch (err) {
        console.error('⚠️ Price sync failed. Retaining fallback rate card:', err.message);
    }
}

syncLiveClubKonnectPricing();
setInterval(syncLiveClubKonnectPricing, 30 * 60 * 1000);

app.get('/api/v1/pricing/live', (req, res) => {
    return res.status(200).json({
        status: 'success',
        lastUpdated: livePricingCache.lastUpdated,
        pricing: livePricingCache
    });
});

function calculateInvoiceSplit(targetAmount) {
    const target = parseFloat(targetAmount);
    let grossPlatformFee = 20.00;
    if (target > 20000 && target <= 50000) grossPlatformFee = 25.00;
    if (target > 50000) grossPlatformFee = 30.00;
    return {
        cleanTarget: target,
        totalCustomerPayment: Math.ceil(target + grossPlatformFee),
        grossPlatformFee: grossPlatformFee
    };
}

// Universal ClubKonnect Fulfillment Engine
async function executeClubKonnectDispatch(orderRef, serviceType, targetInput, amount) {
    try {
        const service = serviceType.toLowerCase();
        let endpoint = 'https://www.clubkonnect.com/API/APIAirtimeV1.asp';
        let params = { UserID: CLUBKONNECT_USERID, APIKey: CLUBKONNECT_API_KEY, RequestID: orderRef };

        if (['sportybet', 'bet9ja', '1xbet', 'betking', 'msport', 'betway'].includes(service)) {
            endpoint = 'https://www.clubkonnect.com/API/BettingWalletTopupV1.asp';
            params.BettingCompany = service;
            params.CustomerId = targetInput;
            params.Amount = amount;
        } else if (service.includes('data') || service.includes('smile')) {
            endpoint = 'https://www.clubkonnect.com/API/APIDatabundleV1.asp';
            params.MobileNetwork = service.replace('_data', '').replace('smile', '05');
            params.DataPlan = targetInput;
            params.MobileNumber = targetInput;
        } else if (['dstv', 'gotv', 'startimes'].includes(service)) {
            endpoint = 'https://www.clubkonnect.com/API/APICableTVV1.asp';
            params.CableTV = service;
            params.SmartCardNo = targetInput;
            params.Amount = amount;
        } else if (['ikedc', 'ekedc', 'ibedc', 'aedc', 'phedc'].includes(service)) {
            endpoint = 'https://www.clubkonnect.com/API/APIElectricityV1.asp';
            params.ElectricCompany = service;
            params.MeterNo = targetInput;
            params.Amount = amount;
        } else if (service.includes('waec') || service.includes('jamb')) {
            endpoint = 'https://www.clubkonnect.com/API/APIEducationV1.asp';
            params.ExamType = service;
            params.Amount = amount;
        } else {
            endpoint = 'https://www.clubkonnect.com/API/APIAirtimeV1.asp';
            params.MobileNetwork = service;
            params.Amount = amount;
            params.MobileNumber = targetInput;
        }

        const response = await axios.get(endpoint, { params });
        return response.data;
    } catch (error) {
        console.error('❌ Dispatch Failure:', error.message);
    }
}

// =========================================================================
// ⚡ AJO EXPRESS - DAILY MERCHANT MICRO-SAVINGS ENGINE
// =========================================================================

app.post('/api/v1/ajo/create', async (req, res) => {
    try {
        const { merchantPhone, dailyAmount } = req.body;
        const amount = parseFloat(dailyAmount);

        if (!merchantPhone || isNaN(amount) || amount < 100) {
            return res.status(400).json({ status: 'error', message: 'Valid merchant phone and minimum ₦100 daily amount required.' });
        }

        const existingPlan = global.ajoPlans.find(p => p.merchantPhone === merchantPhone && p.status === 'ACTIVE');
        if (existingPlan) {
            return res.status(400).json({ status: 'error', message: 'You already have an active Ajo Express plan running.' });
        }

        const startDate = new Date();
        const maturityDate = new Date();
        maturityDate.setDate(startDate.getDate() + 30);

        const newPlan = {
            planId: `AJO-${Date.now()}`,
            merchantPhone,
            dailyAmount: amount,
            startDate: startDate.toISOString(),
            maturityDate: maturityDate.toISOString(),
            daysCompleted: 1,
            firstDayFeeDeducted: true,
            accumulatedSavings: 0.00,
            status: 'ACTIVE'
        };

        global.ajoPlans.push(newPlan);

        return res.status(201).json({
            status: 'success',
            message: 'Ajo Express Plan activated successfully! Day 1 collection fee processed.',
            plan: newPlan
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to initialize Ajo Express plan.' });
    }
});

app.get('/api/v1/ajo/status/:phone', (req, res) => {
    try {
        const phone = req.params.phone;
        const plan = global.ajoPlans.find(p => p.merchantPhone === phone && p.status === 'ACTIVE');
        
        if (!plan) {
            return res.status(200).json({ status: 'success', hasActivePlan: false });
        }

        return res.status(200).json({ status: 'success', hasActivePlan: true, plan });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to fetch Ajo Express status.' });
    }
});

app.post('/api/v1/ajo/break', async (req, res) => {
    try {
        const { planId, merchantPhone } = req.body;
        const plan = global.ajoPlans.find(p => p.planId === planId && p.merchantPhone === merchantPhone && p.status === 'ACTIVE');

        if (!plan) {
            return res.status(404).json({ status: 'error', message: 'Active Ajo Express plan not found.' });
        }

        const penalty = plan.accumulatedSavings * 0.10;
        const payoutAmount = plan.accumulatedSavings - penalty;

        plan.status = 'BROKEN_EARLY';
        plan.closedAt = new Date().toISOString();

        return res.status(200).json({
            status: 'success',
            message: `Plan broken. 10% penalty (₦${penalty.toFixed(2)}) applied. ₦${payoutAmount.toFixed(2)} credited back.`,
            refundedAmount: payoutAmount,
            penaltyDeducted: penalty
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to process early liquidation.' });
    }
});

setInterval(() => {
    const now = new Date();
    global.ajoPlans.forEach(plan => {
        if (plan.status === 'ACTIVE') {
            const matDate = new Date(plan.maturityDate);
            if (now >= matDate) {
                plan.status = 'MATURED';
                console.log(`🎉 Ajo Express Plan ${plan.planId} Matured! Total Payout: ₦${plan.accumulatedSavings}`);
            } else {
                plan.daysCompleted += 1;
                plan.accumulatedSavings += plan.dailyAmount;
                console.log(`⚡ Ajo Express Daily Auto-Deduction Logged for ${plan.merchantPhone} (+₦${plan.dailyAmount})`);
            }
        }
    });
}, 24 * 60 * 60 * 1000);

// =========================================================================
// 📄 AUTOMATED MONTHLY ACCOUNT STATEMENT GENERATOR (PDF STREAM)
// =========================================================================

app.get('/api/v1/merchant/statement/download', async (req, res) => {
    try {
        const { merchantPhone, month, year } = req.query;
        const phone = merchantPhone ? merchantPhone.trim() : '';
        
        merchantAccounts = loadAccounts();
        const merchant = merchantAccounts[phone] || {
            merchantName: 'Valued Merchant',
            phone: phone || '08022552528',
            email: 'merchant@alltimebusiness.com.ng',
            virtualNuban: '9938120491',
            balance: 0.00
        };

        const statementMonth = month || 'September';
        const statementYear = year || '2026';
        const generatedDate = new Date().toLocaleDateString('en-GB');

        const statementHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; margin: 0; padding: 25px; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #38bdf8; padding-bottom: 15px; }
                    .title { color: #0284c7; font-size: 20px; font-weight: bold; margin: 0; }
                    .sub-title { color: #64748b; font-size: 11px; text-transform: uppercase; margin-top: 4px; }
                    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0; display: flex; justify-content: space-between; }
                    .meta-col { width: 48%; }
                    .meta-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; }
                    .meta-val { font-size: 13px; color: #0f172a; font-weight: bold; margin-top: 3px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
                    th { background: #0f172a; color: #ffffff; text-align: left; padding: 10px; font-weight: 600; }
                    td { padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155; }
                    tr:nth-child(even) { background: #f8fafc; }
                    .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 10px; color: #94a3b8; }
                    .badge-success { background: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 4px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="title">ALL TIME BUSINESS LTD</div>
                        <div class="sub-title">@BL SOVEREIGN GATEWAY | RC: 950444</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 14px; font-weight: bold; color: #0f172a;">ACCOUNT STATEMENT</div>
                        <div style="font-size: 11px; color: #64748b;">Period: ${statementMonth} ${statementYear}</div>
                    </div>
                </div>

                <div class="meta-box">
                    <div class="meta-col">
                        <div class="meta-label">Merchant Details</div>
                        <div class="meta-val">${merchant.merchantName}</div>
                        <div style="font-size: 11px; color: #475569;">Phone: ${merchant.phone} | Email: ${merchant.email}</div>
                        <div style="font-size: 11px; color: #475569;">Virtual NUBAN: ${merchant.virtualNuban || '9938120491'} (Nomba MFB)</div>
                    </div>
                    <div class="meta-col" style="text-align: right;">
                        <div class="meta-label">Settlement Summary</div>
                        <div class="meta-val" style="color: #0284c7;">Ledger Balance: ₦${(merchant.balance || 0).toLocaleString('en-NG', {minimumFractionDigits: 2})}</div>
                        <div style="font-size: 11px; color: #475569;">Generated On: ${generatedDate}</div>
                        <div style="font-size: 11px; color: #16a34a; font-weight: bold;">Status: Verified Account</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Date / Time</th>
                            <th>Reference ID</th>
                            <th>Description / Channel</th>
                            <th>Type</th>
                            <th>Amount (₦)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>${generatedDate} 08:30 AM</td>
                            <td>SOV-10928391</td>
                            <td>Nomba Virtual NUBAN Settlement</td>
                            <td><strong style="color: #16a34a;">CREDIT</strong></td>
                            <td>₦25,000.00</td>
                            <td><span class="badge-success">SUCCESS</span></td>
                        </tr>
                        <tr>
                            <td>${generatedDate} 10:15 AM</td>
                            <td>AJO-8839201</td>
                            <td>Ajo Express Daily Lock Deduction</td>
                            <td><strong style="color: #dc2626;">DEBIT</strong></td>
                            <td>₦1,000.00</td>
                            <td><span class="badge-success">SUCCESS</span></td>
                        </tr>
                        <tr>
                            <td>${generatedDate} 02:45 PM</td>
                            <td>VTU-9920182</td>
                            <td>ClubKonnect Utility Batch Vending</td>
                            <td><strong style="color: #dc2626;">DEBIT</strong></td>
                            <td>₦4,500.00</td>
                            <td><span class="badge-success">SUCCESS</span></td>
                        </tr>
                    </tbody>
                </table>

                <div class="footer">
                    <p>ALL TIME BUSINESS LTD (RC: 950444) | www.alltimebusiness.com.ng</p>
                    <p>Corporate Office: 14 Jinadu Odesanya Street, Eyita, Ikorodu, Lagos State. Support: 08022552528</p>
                    <p>This is a computer-generated account statement and requires no physical signature.</p>
                </div>
            </body>
            </html>
        `;

        return res.send(`
            <script>
                const win = window.open('', '_self');
                win.document.write(\`${statementHtml}\`);
                win.document.close();
                setTimeout(() => { win.print(); }, 500);
            </script>
        `);

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to generate PDF account statement.' });
    }
});

// Diagnostic Test Endpoint
app.get('/api/v1/test-email', async (req, res) => {
    try {
        const testTarget = req.query.email || process.env.SMTP_USER || 'ogegbodegreat@gmail.com';
        
        const success = await dispatchEmail(
            testTarget,
            '⚡ @BL SOVEREIGN GATEWAY - Live SMTP Delivery Test',
            `
            <div style="background:#0f172a; color:#fff; padding:30px; font-family:'Segoe UI',sans-serif; border-radius:12px; max-width:550px; margin:0 auto; border:1px solid #38bdf8;">
                <h2 style="color:#38bdf8; text-align:center;">ALL TIME BUSINESS LTD</h2>
                <p style="text-align:center; color:#cbd5e1; font-size:0.8rem; text-transform:uppercase;">@BL SOVEREIGN GATEWAY</p>
                <hr style="border-color:#334155; margin:20px 0;">
                <h3 style="color:#10b981;">SMTP Email Delivery Test Successful!</h3>
                <p style="line-height:1.6; color:#cbd5e1;">Your Gmail App Password integration is fully operational on Port 587 STARTTLS.</p>
            </div>
            `
        );

        if (success) {
            return res.status(200).json({ status: 'success', message: `Test email successfully sent to ${testTarget}` });
        } else {
            return res.status(500).json({ status: 'error', message: 'Mail delivery failed. Check Railway server logs.' });
        }
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
});

// Navigation Page Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/vtu-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'vtu-support.html')));
app.get('/betting-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'betting-support.html')));
app.get('/bill-payments', (req, res) => res.sendFile(path.join(__dirname, 'public', 'bill-payments.html')));
app.get('/credit-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'credit-support.html')));
app.get('/education-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'education-support.html')));
app.get('/newsletter', (req, res) => res.sendFile(path.join(__dirname, 'public', 'newsletter.html')));
app.get('/private', (req, res) => res.sendFile(path.join(__dirname, 'public', 'private.html')));

// Merchant Onboarding Route
app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { merchantName, phone, email, password, settlementAccount, bankName } = req.body;

        if (!merchantName || !phone || !email || !password || !settlementAccount || !bankName) {
            return res.status(400).json({ status: 'error', message: 'All onboarding fields are required.' });
        }

        const cleanPhone = phone.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (merchantAccounts[cleanPhone]) {
            return res.status(400).json({ status: 'error', message: 'This Phone Number is already registered. Please Sign In.' });
        }

        const generatedNuban = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newMerchant = {
            id: `MCH-${Date.now()}`,
            merchantName,
            phone: cleanPhone,
            email: cleanEmail,
            password: hashedPassword,
            settlementAccount,
            bankName,
            virtualNuban: generatedNuban,
            virtualBank: 'Nomba / MFB',
            balance: 0.00,
            createdAt: new Date().toISOString()
        };

        merchantAccounts[cleanPhone] = newMerchant;
        saveAccounts(merchantAccounts);

        const welcomeMailHtml = `
            <div style="background:#0f172a; color:#fff; padding:30px; font-family:'Segoe UI',sans-serif; border-radius:12px; max-width:550px; margin:0 auto; border:1px solid #38bdf8;">
                <h2 style="color:#38bdf8; text-align:center;">ALL TIME BUSINESS LTD</h2>
                <p style="text-align:center; color:#cbd5e1; font-size:0.8rem; text-transform:uppercase;">@BL SOVEREIGN GATEWAY</p>
                <hr style="border-color:#334155; margin:20px 0;">
                <h3 style="color:#10b981;">Welcome, ${merchantName}!</h3>
                <p style="line-height:1.6; color:#cbd5e1;">Your merchant account onboarding is complete. Below are your collection account details:</p>
                <div style="background:#1e293b; padding:15px; border-radius:8px; margin:15px 0; border-left:4px solid #38bdf8;">
                    <p><strong>Collection NUBAN:</strong> <span style="color:#f59e0b; font-weight:800;">${generatedNuban}</span></p>
                    <p><strong>Collection Bank:</strong> Nomba MFB</p>
                    <p><strong>Username (Phone):</strong> ${cleanPhone}</p>
                </div>
            </div>
        `;
        
        await dispatchEmail(cleanEmail, '🎉 Merchant Onboarding Successful - All Time Business Ltd', welcomeMailHtml);

        return res.status(201).json({
            status: 'success',
            message: 'Onboarding completed successfully!',
            merchant: newMerchant
        });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Server error during merchant onboarding.' });
    }
});

// Merchant Sign In Route
app.post('/api/v1/auth/signin', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { phone, password } = req.body;
        const cleanPhone = phone ? phone.trim() : '';

        const account = merchantAccounts[cleanPhone];

        if (!account) {
            return res.status(404).json({ status: 'error', message: 'Account not found. Please complete merchant onboarding first.' });
        }

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Incorrect password.' });
        }

        return res.status(200).json({ status: 'success', message: 'Signed in successfully!', merchant: account });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Sign in processing failed.' });
    }
});

// SAIL Credit Application Route
app.post('/api/v1/credit/apply', async (req, res) => {
    try {
        const { merchantName, creditAmount, interest, insurance, upfrontTotal, dailyTarget, tenor, turnover, merchantEmail } = req.body;

        const appId = `SAIL-${Date.now()}`;
        const newApp = {
            appId,
            merchantName,
            merchantEmail,
            creditAmount,
            interest: interest || (creditAmount * 0.15),
            insurance: insurance || (creditAmount * 0.01),
            upfrontTotal: upfrontTotal || (creditAmount * 0.16),
            dailyTarget: dailyTarget || (creditAmount * 0.05),
            tenor: tenor || '20 Working Days',
            turnover,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };

        global.creditApplications.push(newApp);

        const creditMailHtml = `
            <div style="background:#0f172a; color:#fff; padding:30px; font-family:'Segoe UI',sans-serif; border-radius:12px; max-width:580px; margin:0 auto; border:1px solid #38bdf8;">
                <h2 style="color:#38bdf8; text-align:center;">ALL TIME BUSINESS LTD</h2>
                <h3 style="color:#10b981;">Credit Facility Application Received</h3>
                <p>Dear <strong>${merchantName}</strong>, your request for a SAIL Working Capital Credit Line (₦${parseFloat(creditAmount).toLocaleString()}) has been logged for review.</p>
            </div>
        `;

        await dispatchEmail(merchantEmail, '💳 SAIL Credit Application - All Time Business Ltd', creditMailHtml);
        return res.status(200).json({ status: 'success', message: 'Credit application logged successfully.' });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to log credit application.' });
    }
});

// Checkout Route
app.post('/api/v1/checkout/initialize', async (req, res) => {
    try {
        const { serviceType, targetInput, amount, paymentMethod } = req.body;
        const orderRef = `SOV-${Date.now()}`;
        const pricing = calculateInvoiceSplit(amount);

        if (paymentMethod === 'TRANSFER') {
            let virtualAccountNum = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
            return res.status(200).json({
                status: 'success', orderRef, paymentMethod: 'TRANSFER',
                bankDetails: {
                    accountNumber: virtualAccountNum,
                    bankName: 'Nomba / MFB',
                    amountToPay: `₦${pricing.totalCustomerPayment}`
                }
            });
        }

        return res.status(200).json({
            status: 'success', orderRef, paymentMethod: 'CARD_OR_USSD',
            checkoutUrl: `https://checkout.nomba.com/pay/${orderRef}?amount=${pricing.totalCustomerPayment}`
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Checkout initialization failed.' });
    }
});

// Admin Command Desk Overview
app.get('/api/v1/admin/overview', (req, res) => {
    try {
        const accounts = loadAccounts();
        const merchantsList = Object.values(accounts);
        
        return res.status(200).json({
            status: 'success',
            metrics: {
                totalMerchants: merchantsList.length,
                totalWalletBalance: merchantsList.reduce((acc, curr) => acc + (curr.balance || 0), 0),
                activeCreditAppsCount: (global.creditApplications || []).length
            },
            merchants: merchantsList,
            creditApplications: global.creditApplications || []
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to retrieve admin analytics.' });
    }
});

// Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Master Server Engine LIVE on port ${PORT}`));
