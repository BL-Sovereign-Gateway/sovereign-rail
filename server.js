/**
 * ============================================================================
 * @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Mandatory Settlement Verification | Email Dispatch | 30+ Nigerian Banks
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Email Transporter Config
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
    }
});

// Master Database Stores
const merchantAccounts = {}; 
const transactionLedger = {}; 
const publishedNewsletters = [
    {
        id: "news-001",
        title: "Welcome to @BL Sovereign Gateway",
        date: "September 5, 2026",
        summary: "Introducing our core payment infrastructure.",
        content: "Welcome to @BL Sovereign Gateway..."
    }
];

// Expanded 30+ Nigerian Commercial Banks & Digital MFBs
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
    { id: '001', name: 'OPTIMUS Bank' },
    { id: '101', name: 'Providus Bank' },
    { id: '102', name: 'Titan Trust Bank' },
    { id: '103', name: 'Globus Bank' },
    { id: '100004', name: 'OPay Digital Services' },
    { id: '100033', name: 'Palmpay' },
    { id: '50211', name: 'Kuda Microfinance Bank' },
    { id: '50515', name: 'Moniepoint MFB' },
    { id: '50380', name: 'FairMoney MFB' },
    { id: '50200', name: 'Rubies MFB' },
    { id: '50300', name: 'VFD Microfinance Bank' },
    { id: '50315', name: 'Carbon MFB' },
    { id: '50223', name: 'Nomba MFB' }
];

// =========================================================================
// 🔐 MANDATORY SETTLEMENT ONBOARDING API
// =========================================================================
app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        const { merchantName, phone, email, password, settlementAccount, bankName } = req.body;

        // Strict Validation: Bank details are mandatory
        if (!merchantName || !phone || !password || !settlementAccount || !bankName) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Mandatory fields missing! Business Name, Phone, Password, Settlement Bank, and Account Number are required for onboarding.' 
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

        // Send Email Notification
        if (email) {
            const mailOptions = {
                from: '"@BL SOVEREIGN GATEWAY" <no-reply@alltimebusiness.com.ng>',
                to: email,
                subject: '🎉 Welcome to @BL SOVEREIGN GATEWAY - Onboarding Complete',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: #fff; border-radius: 10px;">
                        <h2 style="color: #38bdf8;">Welcome, ${merchantName}!</h2>
                        <p>Your merchant onboarding on <strong>@BL SOVEREIGN GATEWAY</strong> is complete.</p>
                        <hr style="border-color: #334155;">
                        <h3>🏦 Dedicated Collection Account Details:</h3>
                        <p><strong>Account Number:</strong> ${generatedNuban}</p>
                        <p><strong>Bank Name:</strong> Nomba / MFB</p>
                        <p><strong>Settlement Bank:</strong> ${bankName} (${settlementAccount})</p>
                        <p>Sign in with your phone number (<strong>${phone}</strong>) to access your merchant dashboard.</p>
                    </div>
                `
            };
            transporter.sendMail(mailOptions).catch(err => console.log('Email send error:', err.message));
        }

        return res.status(201).json({
            status: 'success',
            message: `🎉 Onboarding Successful!\n\nWelcome to @BL SOVEREIGN GATEWAY, ${merchantName}.\n\nYour Dedicated NUBAN: ${generatedNuban} (Nomba / MFB).\nSettlement Account: ${settlementAccount} (${bankName}).\n\nCheck your email (${email}) for login credentials.`
        });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Onboarding failed.' });
    }
});

// Auth Routes & Page Endpoints
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/api/v1/banks', (req, res) => res.json({ status: 'success', data: FULL_NIGERIAN_BANKS }));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Engine LIVE on port ${PORT}`));
