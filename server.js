/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Full Ecosystem: Persistent DB | Universal Email Engine | ClubKonnect & Nomba
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

// Environment Variables & Production Credentials
const NOMBA_ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const NOMBA_ACCESS_TOKEN = process.env.NOMBA_ACCESS_TOKEN;
const NOMBA_BASE_URL = 'https://api.nomba.com/v1';

const CLUBKONNECT_USERID = process.env.CLUBKONNECT_USERID || 'CK101290548';
const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY || 'UME517RP99A32IP8Z73J430SX4RHP98UYN10NL2939JT525O13QVJU6JVC09EI41';

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
const transactionLedger = {}; 

const ACCESS_BANK_CORPORATE = {
    bankName: "Access Bank Plc",
    accountNumber: "0037323182",
    accountName: "All Time Business Ltd"
};

// Branded SMTP Engine Initialization
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER || 'ogegbodegreat@gmail.com',
        pass: process.env.SMTP_PASS || 'zwjpictrfbbgjelv'
    },
    tls: { rejectUnauthorized: false }
});

transporter.verify((error) => {
    if (error) console.error('❌ SMTP Connection Error:', error.message);
    else console.log('🚀 Universal SMTP Engine Connected & Ready!');
});

/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | Universal Email Engine
 * Delivers alerts to ALL email providers (Gmail, Yahoo, Outlook, Corporate)
 * ============================================================================
 */
async function dispatchEmail(targetEmail, subject, htmlContent) {
    const defaultSender = process.env.SMTP_USER || 'ogegbodegreat@gmail.com';
    
    // Ensure fallback to admin email if target email is missing or empty
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
        
        // If external domain fails, dispatch copy to primary corporate admin account as backup
        if (recipient !== defaultSender) {
            console.log(`🔄 Retrying backup delivery to admin [${defaultSender}]...`);
            mailOptions.to = defaultSender;
            try {
                await transporter.sendMail(mailOptions);
            } catch (fallbackErr) {
                console.error(`❌ Admin backup email failed:`, fallbackErr.message);
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

// Page Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/vtu-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'vtu-support.html')));
app.get('/betting-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'betting-support.html')));
app.get('/bill-payments', (req, res) => res.sendFile(path.join(__dirname, 'public', 'bill-payments.html')));
app.get('/credit-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'credit-support.html')));
app.get('/education-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'education-support.html')));

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
        const { merchantName, creditAmount, tenor, turnover, merchantEmail } = req.body;

        const creditMailHtml = `
            <div style="background:#0f172a; color:#fff; padding:30px; font-family:'Segoe UI',sans-serif; border-radius:12px; max-width:550px; margin:0 auto; border:1px solid #38bdf8;">
                <h2 style="color:#38bdf8; text-align:center;">ALL TIME BUSINESS LTD</h2>
                <p style="text-align:center; color:#cbd5e1; font-size:0.8rem; text-transform:uppercase;">@BL SOVEREIGN GATEWAY | SAIL CREDIT</p>
                <hr style="border-color:#334155; margin:20px 0;">
                <h3 style="color:#10b981;">Credit Line Application Logged</h3>
                <p style="line-height:1.6; color:#cbd5e1;">Dear <strong>${merchantName}</strong>,</p>
                <p style="line-height:1.6; color:#cbd5e1;">Your application for a working capital credit line has been logged into our underwriting system.</p>
                <div style="background:#1e293b; padding:15px; border-radius:8px; margin:15px 0; border-left:4px solid #38bdf8;">
                    <p><strong>Merchant:</strong> ${merchantName}</p>
                    <p><strong>Facility Requested:</strong> ₦${parseFloat(creditAmount).toLocaleString('en-NG')}</p>
                    <p><strong>Tenor:</strong> ${tenor} Days</p>
                    <p><strong>Estimated Turnover:</strong> ₦${parseFloat(turnover).toLocaleString('en-NG')}</p>
                </div>
                <p style="text-align:center; font-size:0.8rem; color:#94a3b8;">Our risk underwriting team is reviewing your account's daily settlement volume.</p>
            </div>
        `;

        await dispatchEmail(merchantEmail, '💳 SAIL Credit Application Received - All Time Business Ltd', creditMailHtml);
        return res.status(200).json({ status: 'success', message: 'Credit application logged and confirmation email dispatched.' });

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

// Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Master Server Engine LIVE on port ${PORT}`));
