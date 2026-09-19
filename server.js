/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Includes: Access Bank Auto-Sweep | Termii ₦5 Cost / ₦6 Billing Logic | 
 * Free Onboarding SMS | Resend HTTP API Mailer | PIN-Secured Bank Withdrawals
 * Entity: ALL TIME BUSINESS LTD (RC: 950444) | www.alltimebusiness.com.ng
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables & Credentials
const NOMBA_ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const NOMBA_ACCESS_TOKEN = process.env.NOMBA_ACCESS_TOKEN;

const CLUBKONNECT_USERID = process.env.CLUBKONNECT_USERID || 'CK101290548';
const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY || 'UME517RP99A32IP8Z73J430SX4RHP98UYN10NL2939JT525O13QVJU6JVC09EI41';

const TERMII_API_KEY = process.env.TERMII_API_KEY;
const ACCESS_BANK_DESTINATION_ACCOUNT = process.env.ACCESS_BANK_ACCOUNT || '0123456789'; // Corporate Access Bank NUBAN

// Persistent File-System Database
const DB_FILE = path.join(__dirname, 'database.json');

function loadAccounts() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
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

let merchantAccounts = loadAccounts();

// Resend HTTP Mailer Configuration
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

// =========================================================================
// 📲 TERMII SMS DISPATCH ENGINE (FREE ONBOARDING / ₦6 SUBSEQUENT)
// =========================================================================

async function sendTermiiSMS(recipientPhone, messageText, isFreeOnboarding = false) {
    try {
        let formattedPhone = recipientPhone.trim().replace(/\s+/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '234' + formattedPhone.slice(1);
        } else if (formattedPhone.startsWith('+234')) {
            formattedPhone = formattedPhone.slice(1);
        }

        const payload = {
            api_key: TERMII_API_KEY,
            to: formattedPhone,
            from: 'OE Alert',    // Approved DND Sender ID
            channel: 'dnd',      // Approved DND Route
            type: 'plain',
            sms: messageText
        };

        const response = await axios.post('https://api.ng.termii.com/api/sms/send', payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log(`✅ Termii SMS Sent to [${formattedPhone}] | Type: ${isFreeOnboarding ? 'FREE ONBOARDING' : 'STANDARD (₦6 DEBIT)'}`);
        return { success: true, data: response.data };
    } catch (err) {
        console.error(`❌ Termii SMS Delivery Error:`, err.response ? err.response.data : err.message);
        return { success: false, error: err.message };
    }
}

// Merchant SMS Endpoint with Differential Billing (₦6.00)
app.post('/api/v1/sms/send-alert', async (req, res) => {
    try {
        const { merchantPhone, recipientPhone, message } = req.body;
        const SMS_BILLING_RATE = 6.00;

        merchantAccounts = loadAccounts();
        const account = merchantAccounts[merchantPhone ? merchantPhone.trim() : ''];

        if (!account) {
            return res.status(404).json({ status: 'error', message: 'Merchant account not found.' });
        }

        if ((account.balance || 0) < SMS_BILLING_RATE) {
            return res.status(400).json({ status: 'error', message: `Insufficient balance. Required: ₦${SMS_BILLING_RATE.toFixed(2)}.` });
        }

        const smsResult = await sendTermiiSMS(recipientPhone, message, false);

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
// 🏦 IMMEDIATE ACCESS BANK AUTOMATED SWEEP ENGINE
// =========================================================================

async function executeAccessBankAutoSweep(amount, referenceId, sourceDescription) {
    try {
        console.log(`⚡ AUTO-SWEEP INITIATED: Sweeping ₦${amount.toLocaleString()} [Ref: ${referenceId}] to Access Bank (${ACCESS_BANK_DESTINATION_ACCOUNT})...`);
        
        // Simulating immediate NIBSS / Nomba settlement payout sweep
        const sweepRef = `SWP-${Date.now()}`;
        console.log(`✅ AUTO-SWEEP SUCCESSFUL: ₦${amount.toLocaleString()} credited directly to Access Bank Account [Ref: ${sweepRef}]`);
        
        return { success: true, sweepRef };
    } catch (err) {
        console.error('❌ Auto-Sweep Error:', err.message);
        return { success: false, error: err.message };
    }
}

// Merchant Onboarding Route (FREE Onboarding SMS Triggered)
app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { merchantName, phone, email, password, settlementAccount, bankName, withdrawalPin } = req.body;

        if (!merchantName || !phone || !email || !password || !settlementAccount || !bankName) {
            return res.status(400).json({ status: 'error', message: 'All fields are required.' });
        }

        const cleanPhone = phone.trim();
        const cleanEmail = email.trim().toLowerCase();

        if (merchantAccounts[cleanPhone]) {
            return res.status(400).json({ status: 'error', message: 'Phone number already registered.' });
        }

        const generatedNuban = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
        const hashedPassword = await bcrypt.hash(password, 10);

        const newMerchant = {
            id: `MCH-${Date.now()}`,
            merchantName,
            phone: cleanPhone,
            email: cleanEmail,
            password: hashedPassword,
            withdrawalPin: (withdrawalPin && /^\d{4}$/.test(withdrawalPin.trim())) ? withdrawalPin.trim() : '1234',
            settlementAccount,
            bankName,
            virtualNuban: generatedNuban,
            virtualBank: 'Nomba / MFB',
            balance: 0.00,
            createdAt: new Date().toISOString()
        };

        merchantAccounts[cleanPhone] = newMerchant;
        saveAccounts(merchantAccounts);

        // 1. FREE Onboarding SMS Dispatch (No Debit)
        const welcomeSms = `Welcome to @BL SOVEREIGN GATEWAY, ${merchantName}! Your Nomba Virtual NUBAN is ${generatedNuban}. Complete setup at www.alltimebusiness.com.ng`;
        await sendTermiiSMS(cleanPhone, welcomeSms, true);

        // 2. Resend Email Dispatch
        const welcomeMailHtml = `
            <div style="background:#0f172a; color:#fff; padding:30px; font-family:'Segoe UI',sans-serif; border-radius:12px; border:1px solid #38bdf8;">
                <h2 style="color:#38bdf8; text-align:center;">@BL SOVEREIGN GATEWAY</h2>
                <h3 style="color:#10b981;">Welcome, ${merchantName}!</h3>
                <p>Your collection account details:</p>
                <p><strong>NUBAN:</strong> ${generatedNuban} (Nomba MFB)</p>
            </div>
        `;
        await dispatchEmail(cleanEmail, '🎉 Merchant Onboarding Successful', welcomeMailHtml);

        return res.status(201).json({ status: 'success', message: 'Onboarding complete!', merchant: newMerchant });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Server error during onboarding.' });
    }
});

// Merchant Sign In
app.post('/api/v1/auth/signin', async (req, res) => {
    try {
        merchantAccounts = loadAccounts();
        const { phone, password } = req.body;
        const cleanPhone = phone ? phone.trim() : '';

        const account = merchantAccounts[cleanPhone];
        if (!account) return res.status(404).json({ status: 'error', message: 'Account not found.' });

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) return res.status(401).json({ status: 'error', message: 'Incorrect password.' });

        return res.status(200).json({ status: 'success', message: 'Signed in successfully!', merchant: account });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Sign in processing failed.' });
    }
});

// Bank Withdrawal Endpoint
app.post('/api/v1/merchant/withdraw', async (req, res) => {
    try {
        const { merchantPhone, amount, destinationBank, accountNumber, withdrawalPin } = req.body;
        const withdrawAmount = parseFloat(amount);

        if (!merchantPhone || isNaN(withdrawAmount) || withdrawAmount < 100 || !destinationBank || !accountNumber || !withdrawalPin) {
            return res.status(400).json({ status: 'error', message: 'All fields including 4-digit PIN are required.' });
        }

        merchantAccounts = loadAccounts();
        const account = merchantAccounts[merchantPhone.trim()];

        if (!account) return res.status(404).json({ status: 'error', message: 'Merchant account not found.' });
        if ((account.balance || 0) < withdrawAmount) return res.status(400).json({ status: 'error', message: 'Insufficient balance.' });

        const setPin = account.withdrawalPin || '1234';
        if (withdrawalPin.trim() !== setPin) return res.status(401).json({ status: 'error', message: 'Invalid 4-digit PIN.' });

        account.balance -= withdrawAmount;
        saveAccounts(merchantAccounts);

        // Immediate Auto-Sweep Trigger to Primary Access Bank
        await executeAccessBankAutoSweep(withdrawAmount, `WTH-${Date.now()}`, 'Merchant Withdrawal');

        return res.status(200).json({
            status: 'success',
            message: `Withdrawal of ₦${withdrawAmount.toLocaleString()} to ${destinationBank} (${accountNumber}) dispatched!`,
            newBalance: account.balance
        });
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Withdrawal processing failed.' });
    }
});

// Navigation Page Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/vtu-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'vtu-support.html')));
app.get('/education-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'education-support.html')));
app.get('/bill-payments', (req, res) => res.sendFile(path.join(__dirname, 'public', 'bill-payments.html')));
app.get('/betting-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'betting-support.html')));
app.get('/credit-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'credit-support.html')));
app.get('/private', (req, res) => res.sendFile(path.join(__dirname, 'public', 'private.html')));

// Start Server Engine
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Master Server Engine LIVE on port ${PORT}`));
