/**
 * ============================================================================
 * @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Mandatory Settlement Onboarding | Non-Blocking Email Dispatch | 30+ Banks
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();

// Body Parser & Static Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Safe Transporter Config (Failsafe for Railway)
let transporter = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

// In-Memory Database Stores
const merchantAccounts = {}; 
const transactionLedger = {}; 

// Expanded 30+ Nigerian Banks
const FULL_NIGERIAN_BANKS = [
    { id: '044', name: 'Access Bank Plc' },
    { id: '058', name: 'Guaranty Trust Bank (GTBank)' },
    { id: '057', name: 'Zenith Bank Plc' },
    { id: '033', name: 'United Bank for Africa (UBA)' },
    { id: '011', name: 'First Bank of Nigeria' },
    { id: '070', name: 'Fidelity Bank' },
    { id: '214', name: 'First City Monument Bank (FCMB)' },
    { id: '221', name: 'Stanbic IBTC Bank' },
    { id: '035', name: 'Wema Bank (ALAT)' },
    { id: '232', name: 'Sterling Bank' },
    { id: '032', name: 'Union Bank of Nigeria' },
    { id: '050', name: 'Ecobank Nigeria' },
    { id: '076', name: 'Polaris Bank' },
    { id: '082', name: 'Keystone Bank' },
    { id: '215', name: 'Unity Bank' },
    { id: '301', name: 'Jaiz Bank' },
    { id: '101', name: 'Providus Bank' },
    { id: '102', name: 'Titan Trust Bank' },
    { id: '103', name: 'Globus Bank' },
    { id: '100004', name: 'OPay Digital Services' },
    { id: '100033', name: 'Palmpay' },
    { id: '50211', name: 'Kuda Microfinance Bank' },
    { id: '50515', name: 'Moniepoint MFB' },
    { id: '50380', name: 'FairMoney MFB' },
    { id: '50300', name: 'VFD Microfinance Bank' },
    { id: '50315', name: 'Carbon MFB' },
    { id: '50223', name: 'Nomba MFB' }
];

// Helper: Pass-Through Revenue Split
function calculateInvoiceSplit(targetAmount) {
    const target = parseFloat(targetAmount);
    let grossPlatformFee = 20.00;
    if (target > 20000 && target <= 50000) grossPlatformFee = 25.00;
    if (target > 50000) grossPlatformFee = 30.00;

    const nombaBaseFee = 30.00;
    const nombaVat = nombaBaseFee * 0.075;
    const totalNombaDeduction = nombaBaseFee + nombaVat;
    const CASHBACK_AMOUNT = 2.00;

    return {
        cleanTarget: target,
        totalCustomerPayment: Math.ceil(target + totalNombaDeduction + grossPlatformFee),
        nombaFeeDeduction: totalNombaDeduction,
        grossPlatformFee: grossPlatformFee,
        cashbackAmount: CASHBACK_AMOUNT,
        netGatewayProfit: grossPlatformFee - CASHBACK_AMOUNT,
        totalMerchantPayout: target + CASHBACK_AMOUNT
    };
}

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/api/v1/banks', (req, res) => res.json({ status: 'success', data: FULL_NIGERIAN_BANKS }));

// Merchant Onboarding API
app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        const { merchantName, phone, email, password, settlementAccount, bankName } = req.body;

        if (!merchantName || !phone || !password || !settlementAccount || !bankName) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'All fields are mandatory: Business Name, Phone, Password, Settlement Bank, and Account Number.' 
            });
        }

        if (merchantAccounts[phone]) {
            return res.status(400).json({ status: 'error', message: 'An account with this phone number already exists.' });
        }

        const generatedNuban = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        merchantAccounts[phone] = {
            id: `MCH-${Date.now()}`,
            merchantName,
            phone,
            email: email || '',
            password: hashedPassword,
            settlementAccount,
            bankName,
            virtualNuban: generatedNuban,
            virtualBank: 'Nomba / MFB',
            balance: 0.00,
            isOnboarded: true
        };

        // Safe Email Dispatch (Does NOT crash server if mail fails)
        if (transporter && email) {
            transporter.sendMail({
                from: '"@BL SOVEREIGN GATEWAY" <no-reply@alltimebusiness.com.ng>',
                to: email,
                subject: '🎉 Onboarding Complete - @BL SOVEREIGN GATEWAY',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: #fff; border-radius: 10px;">
                        <h2 style="color: #38bdf8;">Welcome, ${merchantName}!</h2>
                        <p>Your onboarding on <strong>@BL SOVEREIGN GATEWAY</strong> is complete.</p>
                        <hr style="border-color: #334155;">
                        <p><strong>Dedicated Collection NUBAN:</strong> ${generatedNuban} (Nomba / MFB)</p>
                        <p><strong>Registered Settlement:</strong> ${bankName} (${settlementAccount})</p>
                        <p>Sign in with your phone number (<strong>${phone}</strong>) to access your merchant dashboard.</p>
                    </div>
                `
            }).catch(err => console.log('Non-critical email dispatch failure:', err.message));
        }

        return res.status(201).json({
            status: 'success',
            message: `🎉 Onboarding Successful!\n\nWelcome to @BL SOVEREIGN GATEWAY, ${merchantName}.\n\nDedicated Collection NUBAN: ${generatedNuban} (Nomba / MFB).\nSettlement Account: ${settlementAccount} (${bankName}).\n\nProceed to sign in to access your dashboard.`
        });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Onboarding failed due to internal server error.' });
    }
});

// Merchant Sign In
app.post('/api/v1/auth/signin', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const account = merchantAccounts[phone];

        if (!account) {
            return res.status(404).json({ status: 'error', message: 'Account not found. Please complete onboarding first.' });
        }

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: 'Invalid password.' });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Signed in successfully!',
            merchant: {
                id: account.id,
                merchantName: account.merchantName,
                phone: account.phone,
                settlementAccount: account.settlementAccount,
                bankName: account.bankName,
                virtualNuban: account.virtualNuban,
                virtualBank: account.virtualBank,
                balance: account.balance
            }
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Sign in failed.' });
    }
});

// Start Server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`@BL Sovereign Gateway Engine LIVE on port ${PORT}`));
