/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Fixed: Persistent Merchant DB | Enforced Unique Auth | Robust Email Delivery
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
const CLUBKONNECT_USERID = process.env.CLUBKONNECT_USERID || 'CK101290548';
const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY || 'UME517RP99A32IP8Z73J430SX4RHP98UYN10NL2939JT525O13QVJU6JVC09EI41';

// Persistent Database Path
const DB_FILE = path.join(__dirname, 'database.json');

// Synchronous Persistent Load & Save
function loadAccounts() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('⚠️ DB Load Exception:', e.message);
    }
    return {};
}

function saveAccounts(accounts) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(accounts, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ DB Save Exception:', e.message);
    }
}

let merchantAccounts = loadAccounts();

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
    else console.log('🚀 SMTP Server Ready! Email dispatch operational.');
});

// Helper Function: Send Branded Emails Asynchronously
async function dispatchEmail(to, subject, html) {
    const sender = process.env.SMTP_USER || 'ogegbodegreat@gmail.com';
    try {
        await transporter.sendMail({
            from: `"All Time Business Ltd | Gateway" <${sender}>`,
            to,
            subject,
            html
        });
        console.log(`✅ Email delivered successfully to ${to}`);
    } catch (err) {
        console.error(`❌ Mail Delivery Failure to ${to}:`, err.message);
    }
}

// =========================================================================
// 🔐 AUTHENTICATION ENDPOINTS (CLINICAL STABILITY)
// =========================================================================

// Merchant Sign Up
app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        // Reload memory from disk to ensure sync
        merchantAccounts = loadAccounts();

        const { merchantName, phone, email, password, settlementAccount, bankName } = req.body;

        if (!merchantName || !phone || !email || !password || !settlementAccount || !bankName) {
            return res.status(400).json({ status: 'error', message: 'All onboarding fields are required.' });
        }

        const cleanPhone = phone.trim();
        const cleanEmail = email.trim().toLowerCase();

        // Check Unique Phone
        if (merchantAccounts[cleanPhone]) {
            return res.status(400).json({ status: 'error', message: 'This Phone Number is already registered. Please Sign In.' });
        }

        // Check Unique Email
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

        // Dispatch Welcome Email
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
        dispatchEmail(cleanEmail, '🎉 Merchant Onboarding Successful - All Time Business Ltd', welcomeMailHtml);

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

// Merchant Sign In
app.post('/api/v1/auth/signin', async (req, res) => {
    try {
        // Force refresh DB read
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

// Credit Application Mail Dispatch
app.post('/api/v1/credit/apply', async (req, res) => {
    try {
        const { merchantName, creditAmount, tenor, turnover, merchantEmail } = req.body;
        const targetEmail = merchantEmail || process.env.SMTP_USER || 'ogegbodegreat@gmail.com';

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

        dispatchEmail(targetEmail, '💳 SAIL Credit Application Received - All Time Business Ltd', creditMailHtml);
        return res.status(200).json({ status: 'success', message: 'Credit application received and email dispatched.' });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Failed to log credit application.' });
    }
});

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

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Master Engine LIVE on port ${PORT}`));
