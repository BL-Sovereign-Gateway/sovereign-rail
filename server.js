/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Full Ecosystem with Enforced Unique Phone/Email, Persistent DB & Credit Emailing
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
const NOMBA_BASE_URL = 'https://api.nomba.com/v1';

const CLUBKONNECT_USERID = process.env.CLUBKONNECT_USERID || 'CK101290548';
const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY || 'UME517RP99A32IP8Z73J430SX4RHP98UYN10NL2939JT525O13QVJU6JVC09EI41';

// File-System Database Storage
const DB_FILE = path.join(__dirname, 'database.json');

function loadAccounts() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.log('❌ DB Read Error. Initializing fresh merchant storage.');
    }
    return {};
}

function saveAccounts(accounts) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(accounts, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ DB Write Error:', e.message);
    }
}

const merchantAccounts = loadAccounts();
const transactionLedger = {}; 

const ACCESS_BANK_CORPORATE = {
    bankName: "Access Bank Plc",
    accountNumber: "0037323182",
    accountName: "All Time Business Ltd"
};

// Nodemailer SMTP Engine
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER || 'ogegbodegreat@gmail.com',
        pass: process.env.SMTP_PASS || 'zwjpictrfbbgjelv'
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000
});

transporter.verify((error) => {
    if (error) console.error('❌ Gmail SMTP Error:', error.message);
    else console.log('🚀 Branded SMTP Engine Ready from All Time Business Ltd!');
});

const getAuthHeader = () => {
    if (!NOMBA_ACCESS_TOKEN) return '';
    return NOMBA_ACCESS_TOKEN.startsWith('Bearer ') ? NOMBA_ACCESS_TOKEN : `Bearer ${NOMBA_ACCESS_TOKEN.trim()}`;
};

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

// Universal Fulfillment Engine
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

// 🌐 Page Routing
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

// 🔐 Merchant Onboarding with Enforced Unique Phone AND Email Check
app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        const { merchantName, phone, email, password, settlementAccount, bankName } = req.body;

        if (!merchantName || !phone || !email || !password || !settlementAccount || !bankName) {
            return res.status(400).json({ status: 'error', message: 'All fields are strictly required.' });
        }

        const cleanPhone = phone.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (merchantAccounts[cleanPhone]) {
            return res.status(400).json({ status: 'error', message: 'An account with this phone number already exists.' });
        }

        const emailExists = Object.values(merchantAccounts).some(acc => acc.email.toLowerCase() === cleanEmail);
        if (emailExists) {
            return res.status(400).json({ status: 'error', message: 'An account with this email address already exists.' });
        }

        const generatedNuban = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        merchantAccounts[cleanPhone] = {
            id: `MCH-${Date.now()}`,
            merchantName,
            phone: cleanPhone,
            email: cleanEmail,
            password: hashedPassword,
            settlementAccount,
            bankName,
            virtualNuban: generatedNuban,
            virtualBank: 'Nomba / MFB',
            balance: 0.00
        };

        saveAccounts(merchantAccounts);

        return res.status(201).json({
            status: 'success',
            message: '🎉 Onboarding complete!',
            merchant: merchantAccounts[cleanPhone]
        });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Onboarding process encountered an error.' });
    }
});

// Merchant Sign In Engine
app.post('/api/v1/auth/signin', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const cleanPhone = phone ? phone.trim() : '';
        const account = merchantAccounts[cleanPhone];

        if (!account) {
            return res.status(404).json({ status: 'error', message: 'Account not found. Please complete merchant onboarding.' });
        }

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid password. Please check your credentials.' });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Signed in successfully!',
            merchant: account
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Sign in failed.' });
    }
});

// 💳 SAIL CREDIT APPLICATION EMAIL DISPATCH
app.post('/api/v1/credit/apply', async (req, res) => {
    try {
        const { merchantName, creditAmount, tenor, turnover, merchantEmail } = req.body;

        const senderEmail = process.env.SMTP_USER || 'ogegbodegreat@gmail.com';
        const targetEmail = merchantEmail || senderEmail;

        const mailOptions = {
            from: `"All Time Business Ltd | SAIL Credit" <${senderEmail}>`,
            to: targetEmail,
            subject: '💳 SAIL Credit Application Received - All Time Business Ltd',
            html: `
                <div style="background-color: #0f172a; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #38bdf8;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #38bdf8; margin: 0; font-size: 24px; font-weight: 800;">ALL TIME BUSINESS LTD</h2>
                        <p style="color: #cbd5e1; font-size: 13px; margin-top: 4px; letter-spacing: 1px;">@BL SOVEREIGN GATEWAY | SAIL CREDIT</p>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
                    <h3 style="color: #10b981; font-size: 18px; margin-bottom: 10px;">Credit Facility Application Confirmation</h3>
                    <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">Dear <strong>${merchantName}</strong>,</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">Your request for a SAIL Credit Facility has been received and logged into our underwriting engine.</p>
                    <div style="background: #1e293b; padding: 18px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #38bdf8;">
                        <p style="margin: 6px 0; font-size: 14px;"><strong>👤 Merchant Name:</strong> ${merchantName}</p>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>💰 Facility Requested:</strong> ₦${parseFloat(creditAmount).toLocaleString('en-NG', {minimumFractionDigits: 2})}</p>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>⏳ Repayment Tenor:</strong> ${tenor} Days</p>
                        <p style="margin: 6px 0; font-size: 14px;"><strong>📊 Estimated Turnover:</strong> ₦${parseFloat(turnover).toLocaleString('en-NG', {minimumFractionDigits: 2})}</p>
                    </div>
                    <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-top: 25px;">
                        Our automated risk underwriting team will review your account's daily settlement volume and communicate the decision shortly.
                    </p>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.error('❌ Credit Email Send Error:', error.message);
            else console.log('✅ Credit Application Email Sent:', info.response);
        });

        return res.status(200).json({ status: 'success', message: 'Credit application received and confirmation email dispatched.' });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to process credit application.' });
    }
});

// Checkout Routes
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
app.listen(PORT, '0.0.0.0', () => console.log(`Master Engine LIVE on port ${PORT}`));
