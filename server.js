/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Full Ecosystem: Persistent DB | Universal SMTP | SAIL Credit | Admin Command Desk
 * ============================================================================
 */

const express = require('express');
const path = require('path');
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

// Global In-Memory Credit Tracker (Preserved across route dispatches)
global.creditApplications = global.creditApplications || [];

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

// 🧪 Diagnostic Test Endpoint
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
                <div style="background:#1e293b; padding:15px; border-radius:8px; margin:15px 0; border-left:4px solid #10b981;">
                    <p><strong>Recipient:</strong> ${testTarget}</p>
                    <p><strong>Status:</strong> Delivered via Railway Server Engine</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                </div>
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

        const emailExists = Object.values(merchantAccounts).some(acc => acc.email.toLowerCase() === cleanEmail);
        if (emailExists) {
            return res.status(400).json({ status: 'error', message: 'This Email Address is already registered. Please Sign In.' });
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
                    <p><strong>Payout Account:</strong> ${bankName} (${settlementAccount})</p>
                </div>
                <p style="text-align:center; font-size:0.8rem; color:#94a3b8;">Log in anytime at <a href="https://alltimebusiness.com.ng" style="color:#38bdf8;">www.alltimebusiness.com.ng</a></p>
            </div>
        `;
        
        await dispatchEmail(cleanEmail, '🎉 Merchant Onboarding Successful - All Time Business Ltd', welcomeMailHtml);

        return res.status(201).json({
            status: 'success',
            message: 'Onboarding completed successfully!',
            merchant: {
                id: newMerchant.id,
                merchantName: newMerchant.merchantName,
                phone: newMerchant.phone,
                email: newMerchant.email,
                settlementAccount: newMerchant.settlementAccount,
                bankName: newMerchant.bankName,
                virtualNuban: newMerchant.virtualNuban,
                virtualBank: newMerchant.virtualBank,
                balance: newMerchant.balance
            }
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
            return res.status(404).json({
                status: 'error',
                message: 'Account not found. Please complete merchant onboarding first.'
            });
        }

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) {
            return res.status(401).json({
                status: 'error',
                message: 'Incorrect password. Please verify your credentials.'
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Signed in successfully!',
            merchant: {
                id: account.id,
                merchantName: account.merchantName,
                phone: account.phone,
                email: account.email,
                settlementAccount: account.settlementAccount,
                bankName: account.bankName,
                virtualNuban: account.virtualNuban,
                virtualBank: account.virtualBank,
                balance: account.balance
            }
        });
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
            tenor: tenor || '20 Working Days (Commencing Day 2 Post-Disbursement)',
            turnover,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };

        global.creditApplications.push(newApp);

        const creditMailHtml = `
            <div style="background:#0f172a; color:#fff; padding:30px; font-family:'Segoe UI',sans-serif; border-radius:12px; max-width:580px; margin:0 auto; border:1px solid #38bdf8;">
                <h2 style="color:#38bdf8; text-align:center;">ALL TIME BUSINESS LTD</h2>
                <p style="text-align:center; color:#cbd5e1; font-size:0.8rem; text-transform:uppercase;">@BL SOVEREIGN GATEWAY | SAIL CREDIT</p>
                <hr style="border-color:#334155; margin:20px 0;">
                <h3 style="color:#10b981;">Credit Facility Application Received</h3>
                <p style="line-height:1.6; color:#cbd5e1;">Dear <strong>${merchantName}</strong>,</p>
                <p style="line-height:1.6; color:#cbd5e1;">Your request for a SAIL Working Capital Credit Line has been logged. Below is your official financial terms breakdown:</p>
                
                <div style="background:#1e293b; padding:18px; border-radius:10px; margin:20px 0; border-left:4px solid #38bdf8;">
                    <p style="margin:6px 0;"><strong>👤 Merchant Name:</strong> ${merchantName}</p>
                    <p style="margin:6px 0;"><strong>💰 Facility Credited:</strong> ₦${parseFloat(creditAmount).toLocaleString('en-NG', {minimumFractionDigits:2})}</p>
                    <p style="margin:6px 0; color:#f87171;"><strong>🔴 Upfront Interest (15%):</strong> ₦${parseFloat(newApp.interest).toLocaleString('en-NG', {minimumFractionDigits:2})}</p>
                    <p style="margin:6px 0; color:#f87171;"><strong>🔴 Upfront Insurance (1%):</strong> ₦${parseFloat(newApp.insurance).toLocaleString('en-NG', {minimumFractionDigits:2})}</p>
                    <p style="margin:6px 0; color:#f59e0b;"><strong>⚠️ Total Upfront Fee Collected:</strong> ₦${parseFloat(newApp.upfrontTotal).toLocaleString('en-NG', {minimumFractionDigits:2})}</p>
                    <p style="margin:6px 0; color:#34d399;"><strong>🟩 Daily Repayment Target (5%):</strong> ₦${parseFloat(newApp.dailyTarget).toLocaleString('en-NG', {minimumFractionDigits:2})} / working day</p>
                    <p style="margin:6px 0;"><strong>⏳ Repayment Schedule:</strong> 20 Working Days (Commencing Day 2 Post-Disbursement)</p>
                </div>
                
                <p style="text-align:center; font-size:0.8rem; color:#94a3b8;">Our risk underwriting team is reviewing your account's daily settlement volume.</p>
            </div>
        `;

        await dispatchEmail(merchantEmail, '💳 SAIL Credit Facility Application - All Time Business Ltd', creditMailHtml);
        return res.status(200).json({ status: 'success', message: 'Credit application logged and breakdown email dispatched.' });

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

// =========================================================================
// 🔒 ADMIN COMMAND CENTER ENDPOINTS (private.html)
// =========================================================================

// 1. Fetch Complete Ecosystem Metrics & Credit Queue
app.get('/api/v1/admin/overview', (req, res) => {
    try {
        const accounts = loadAccounts();
        const merchantsList = Object.values(accounts);
        
        const totalMerchants = merchantsList.length;
        const totalWalletBalance = merchantsList.reduce((acc, curr) => acc + (curr.balance || 0), 0);

        // Fetch Credit Applications Array
        const creditApps = global.creditApplications || [];

        return res.status(200).json({
            status: 'success',
            metrics: {
                totalMerchants,
                totalWalletBalance,
                activeCreditAppsCount: creditApps.length
            },
            merchants: merchantsList.map(m => ({
                merchantName: m.merchantName,
                phone: m.phone,
                email: m.email,
                virtualNuban: m.virtualNuban,
                bankName: m.bankName,
                settlementAccount: m.settlementAccount,
                balance: m.balance
            })),
            creditApplications: creditApps
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to retrieve admin analytics.' });
    }
});

// 2. Process Loan Decision (Approve / Reject)
app.post('/api/v1/admin/credit/action', async (req, res) => {
    try {
        const { appId, action, merchantEmail, merchantName, creditAmount } = req.body;

        const isApproved = action === 'APPROVE';
        const statusColor = isApproved ? '#10b981' : '#ef4444';
        const statusText = isApproved ? 'APPROVED & DISBURSED' : 'DECLINED';

        // Update application state in array
        const appObj = global.creditApplications.find(a => a.appId === appId);
        if (appObj) {
            appObj.status = statusText;
        }

        const decisionMailHtml = `
            <div style="background:#0f172a; color:#fff; padding:30px; font-family:'Segoe UI',sans-serif; border-radius:12px; max-width:580px; margin:0 auto; border:1px solid #38bdf8;">
                <h2 style="color:#38bdf8; text-align:center;">ALL TIME BUSINESS LTD</h2>
                <p style="text-align:center; color:#cbd5e1; font-size:0.8rem; text-transform:uppercase;">@BL SOVEREIGN GATEWAY | SAIL CREDIT RISK DESK</p>
                <hr style="border-color:#334155; margin:20px 0;">
                <h3 style="color:${statusColor};">SAIL Credit Application ${statusText}</h3>
                <p style="line-height:1.6; color:#cbd5e1;">Dear <strong>${merchantName}</strong>,</p>
                <p style="line-height:1.6; color:#cbd5e1;">Your request for a SAIL Working Capital Facility of <strong>₦${parseFloat(creditAmount).toLocaleString('en-NG')}</strong> has been evaluated by our underwriting desk.</p>
                
                <div style="background:#1e293b; padding:18px; border-radius:10px; margin:20px 0; border-left:4px solid ${statusColor};">
                    <p style="margin:6px 0;"><strong>Decision Status:</strong> <span style="color:${statusColor}; font-weight:800;">${statusText}</span></p>
                    <p style="margin:6px 0;"><strong>Facility Amount:</strong> ₦${parseFloat(creditAmount).toLocaleString('en-NG')}</p>
                    ${isApproved ? '<p style="margin:6px 0; color:#34d399;"><strong>Repayment Schedule:</strong> 20 Working Days (Starts Day 2 Post-Disbursement via daily 5% settlement deductions)</p>' : '<p style="margin:6px 0; color:#cbd5e1;">Reason: Daily gateway settlement turnover does not currently meet underwriting threshold.</p>'}
                </div>
            </div>
        `;

        await dispatchEmail(merchantEmail, `💳 SAIL Credit Decision: ${statusText} - All Time Business Ltd`, decisionMailHtml);

        return res.status(200).json({ status: 'success', message: `Application ${action.toLowerCase()}d and notification email dispatched.` });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to process credit decision.' });
    }
});

// 3. Broadcast Newsletter to All Onboarded Merchants
app.post('/api/v1/admin/newsletter/broadcast', async (req, res) => {
    try {
        const { subject, contentHtml } = req.body;
        const accounts = loadAccounts();
        const emails = Object.values(accounts).map(a => a.email).filter(e => e && e.includes('@'));

        if (emails.length === 0) {
            return res.status(400).json({ status: 'error', message: 'No registered merchant emails found.' });
        }

        let sentCount = 0;
        for (const email of emails) {
            const formattedBody = `
                <div style="background:#0f172a; color:#fff; padding:30px; font-family:'Segoe UI',sans-serif; border-radius:12px; max-width:600px; margin:0 auto; border:1px solid #38bdf8;">
                    <h2 style="color:#38bdf8; text-align:center;">ALL TIME BUSINESS LTD</h2>
                    <p style="text-align:center; color:#cbd5e1; font-size:0.8rem; text-transform:uppercase;">@BL SOVEREIGN GATEWAY BROADCAST</p>
                    <hr style="border-color:#334155; margin:20px 0;">
                    ${contentHtml}
                    <hr style="border-color:#334155; margin:20px 0;">
                    <p style="text-align:center; font-size:0.75rem; color:#94a3b8;">www.alltimebusiness.com.ng | Corporate Office: Access Bank Tower, Nigeria</p>
                </div>
            `;
            const dispatched = await dispatchEmail(email, subject, formattedBody);
            if (dispatched) sentCount++;
        }

        return res.status(200).json({ status: 'success', message: `Newsletter broadcast dispatched to ${sentCount} merchants.` });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to broadcast newsletter.' });
    }
});

// Admin Route Page
app.get('/private', (req, res) => res.sendFile(path.join(__dirname, 'public', 'private.html')));

// Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Master Server Engine LIVE on port ${PORT}`));
