/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Full Ecosystem with Persistent JSON Database Storage
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

// Environment Variables
const NOMBA_ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const NOMBA_ACCESS_TOKEN = process.env.NOMBA_ACCESS_TOKEN;
const NOMBA_BASE_URL = 'https://api.nomba.com/v1';

const CLUBKONNECT_USERID = process.env.CLUBKONNECT_USERID || 'CK101290548';
const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY || 'UME517RP99A32IP8Z73J430SX4RHP98UYN10NL2939JT525O13QVJU6JVC09EI41';

// File-System Database (Survives Server Restarts)
const DB_FILE = path.join(__dirname, 'database.json');

function loadAccounts() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.log('Creating fresh merchant database file...');
    }
    return {};
}

function saveAccounts(accounts) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(accounts, null, 2), 'utf8');
    } catch (e) {
        console.error('Database write error:', e.message);
    }
}

const merchantAccounts = loadAccounts();
const transactionLedger = {}; 

const ACCESS_BANK_CORPORATE = {
    bankName: "Access Bank Plc",
    accountNumber: "0037323182",
    accountName: "All Time Business Ltd"
};

// Nodemailer Transporter
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
    else console.log('🚀 SMTP Engine Ready from All Time Business Ltd!');
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

// Universal ClubKonnect Fulfillment Driver
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

// Routes
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

// Merchant Sign Up
app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        const { merchantName, phone, email, password, settlementAccount, bankName } = req.body;
        if (!merchantName || !phone || !password) return res.status(400).json({ status: 'error', message: 'Missing fields.' });
        
        if (merchantAccounts[phone]) return res.status(400).json({ status: 'error', message: 'Account exists.' });

        const generatedNuban = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        merchantAccounts[phone] = {
            id: `MCH-${Date.now()}`,
            merchantName, phone, email: email || '',
            password: hashedPassword, settlementAccount, bankName,
            virtualNuban: generatedNuban, virtualBank: 'Nomba / MFB', balance: 0.00
        };

        saveAccounts(merchantAccounts); // Persist to database file

        return res.status(201).json({ status: 'success', message: 'Registration complete!', merchant: merchantAccounts[phone] });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Signup error.' });
    }
});

// Merchant Sign In
app.post('/api/v1/auth/signin', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const account = merchantAccounts[phone];
        if (!account) return res.status(404).json({ status: 'error', message: 'Account not found.' });

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) return res.status(401).json({ status: 'error', message: 'Invalid password.' });

        return res.status(200).json({ status: 'success', merchant: account });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Sign in failed.' });
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

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Master Engine LIVE on port ${PORT}`));
