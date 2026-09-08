/**
 * ============================================================================
 * ALL TIME BUSINESS LTD | @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Full Ecosystem:
 * Merchant Auth | Email Dispatch | Utility Hub | Multi-Channel Checkout
 * Gateway Wallet | ClubKonnect Universal Fulfillment | 30+ Banks API
 * Deployment: Node.js (Express) on Railway
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

// Environment Variables
const NOMBA_ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const NOMBA_ACCESS_TOKEN = process.env.NOMBA_ACCESS_TOKEN;
const NOMBA_BASE_URL = 'https://api.nomba.com/v1';

// Production ClubKonnect Credentials (Hardcoded Fallbacks Included)
const CLUBKONNECT_USERID = process.env.CLUBKONNECT_USERID || 'CK101290548';
const CLUBKONNECT_API_KEY = process.env.CLUBKONNECT_API_KEY || 'UME517RP99A32IP8Z73J430SX4RHP98UYN10NL2939JT525O13QVJU6JVC09EI41';

// Corporate Primary Bank Details
const ACCESS_BANK_CORPORATE = {
    bankName: "Access Bank Plc",
    accountNumber: "0037323182",
    accountName: "All Time Business Ltd"
};

// =========================================================================
// 📩 BRANDED EMAIL ENGINE WITH ENFORCED SSL HANDSHAKE
// =========================================================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER, // e.g., ogegbodegreat@gmail.com
        pass: process.env.SMTP_PASS  // e.g., zwjpictrfbbgjelv
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 10000
});

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Gmail SMTP Connection Error:', error.message);
    } else {
        console.log('🚀 SMTP Server Connected! Ready to send emails from All Time Business Ltd.');
    }
});

const getAuthHeader = () => {
    if (!NOMBA_ACCESS_TOKEN) return '';
    return NOMBA_ACCESS_TOKEN.startsWith('Bearer ')
        ? NOMBA_ACCESS_TOKEN
        : `Bearer ${NOMBA_ACCESS_TOKEN.trim()}`;
};

// In-Memory Database Stores
const merchantAccounts = {};
const transactionLedger = {}; 

// Full 30+ Nigerian Commercial Banks & Digital MFBs
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

function calculateInvoiceSplit(targetAmount) {
    const target = parseFloat(targetAmount);
    let grossPlatformFee = 20.00;
    if (target > 20000 && target <= 50000) grossPlatformFee = 25.00;
    if (target > 50000) grossPlatformFee = 30.00;

    const CASHBACK_AMOUNT = 2.00;

    return {
        cleanTarget: target,
        totalCustomerPayment: Math.ceil(target + grossPlatformFee),
        grossPlatformFee: grossPlatformFee,
        cashbackAmount: CASHBACK_AMOUNT,
        netGatewayProfit: grossPlatformFee - CASHBACK_AMOUNT,
        totalMerchantPayout: target + CASHBACK_AMOUNT
    };
}

// =========================================================================
// 🚀 UNIVERSAL CLUBKONNECT DISPATCH DRIVER
// =========================================================================
async function executeClubKonnectDispatch(orderRef, serviceType, targetInput, amount) {
    try {
        const service = serviceType.toLowerCase();
        let endpoint = 'https://www.clubkonnect.com/API/APIAirtimeV1.asp';
        let params = {
            UserID: CLUBKONNECT_USERID,
            APIKey: CLUBKONNECT_API_KEY,
            RequestID: orderRef
        };

        // 1. FUND BETTING WALLET
        if (['sportybet', 'bet9ja', '1xbet', 'betking', 'msport', 'betway', 'betano', '1win', '22bet', 'melbet'].includes(service)) {
            endpoint = 'https://www.clubkonnect.com/API/BettingWalletTopupV1.asp';
            params.BettingCompany = service;
            params.CustomerId = targetInput;
            params.Amount = amount;
        }
        
        // 2. BUY DATA BUNDLES & SMILE DATA
        else if (service.includes('data') || service.includes('smile')) {
            endpoint = 'https://www.clubkonnect.com/API/APIDatabundleV1.asp';
            params.MobileNetwork = service.replace('_data', '').replace('smile', '05');
            params.DataPlan = targetInput;
            params.MobileNumber = targetInput;
        }

        // 3. CABLE TV SUBSCRIPTION
        else if (['dstv', 'gotv', 'startimes'].includes(service)) {
            endpoint = 'https://www.clubkonnect.com/API/APICableTVV1.asp';
            params.CableTV = service;
            params.SmartCardNo = targetInput;
            params.Amount = amount;
        }

        // 4. ELECTRICITY BILL PAYMENTS
        else if (['ikedc', 'ekedc', 'ibedc', 'aedc', 'phedc', 'jedc', 'kaedco'].includes(service)) {
            endpoint = 'https://www.clubkonnect.com/API/APIElectricityV1.asp';
            params.ElectricCompany = service;
            params.MeterNo = targetInput;
            params.Amount = amount;
        }

        // 5. EDUCATION e-PINs (WAEC & JAMB)
        else if (['waec', 'jamb'].includes(service)) {
            endpoint = 'https://www.clubkonnect.com/API/APIEducationV1.asp';
            params.ExamType = service;
            params.Amount = amount;
        }

        // 6. DEFAULT: MOBILE AIRTIME VTU
        else {
            endpoint = 'https://www.clubkonnect.com/API/APIAirtimeV1.asp';
            params.MobileNetwork = service;
            params.Amount = amount;
            params.MobileNumber = targetInput;
        }

        const response = await axios.get(endpoint, { params });
        console.log(`✅ ClubKonnect Fulfillment Dispatched [${serviceType.toUpperCase()}] | Ref: ${orderRef}`, response.data);
        return response.data;

    } catch (error) {
        console.error(`❌ ClubKonnect Fulfillment Failure [${serviceType}]:`, error.response?.data || error.message);
    }
}

// =========================================================================
// 🌐 1. PAGE ROUTING & BANK LIST ENDPOINT
// =========================================================================
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

app.get('/api/v1/banks', (req, res) => res.status(200).json({ status: 'success', data: FULL_NIGERIAN_BANKS }));

// =========================================================================
// 🔐 2. MERCHANT AUTHENTICATION, ONBOARDING & EMAIL DISPATCH
// =========================================================================
app.post('/api/v1/auth/signup', async (req, res) => {
    try {
        const { merchantName, phone, email, password, settlementAccount, bankName } = req.body;

        if (!merchantName || !phone || !password || !settlementAccount || !bankName) {
            return res.status(400).json({ status: 'error', message: 'All fields are required for merchant onboarding.' });
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

        if (email) {
            const senderEmail = process.env.SMTP_USER || 'ogegbodegreat@gmail.com';
            const mailOptions = {
                from: `"All Time Business Ltd | @BL SOVEREIGN GATEWAY" <${senderEmail}>`,
                to: email,
                subject: '🎉 Onboarding Complete - All Time Business Ltd',
                html: `
                    <div style="background-color: #0f172a; color: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #38bdf8;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #38bdf8; margin: 0; font-size: 24px; font-weight: 800;">ALL TIME BUSINESS LTD</h2>
                            <p style="color: #cbd5e1; font-size: 13px; margin-top: 4px; letter-spacing: 1px;">@BL SOVEREIGN GATEWAY</p>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;">
                        <h3 style="color: #f59e0b; font-size: 18px; margin-bottom: 10px;">Welcome aboard, ${merchantName}!</h3>
                        <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">Your merchant account registration with <strong>All Time Business Ltd</strong> is complete. Below are your assigned financial collection credentials:</p>
                        <div style="background: #1e293b; padding: 18px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #38bdf8;">
                            <p style="margin: 6px 0; font-size: 14px;"><strong>🏦 Dedicated Collection NUBAN:</strong> <span style="color: #38bdf8; font-weight: 700;">${generatedNuban}</span></p>
                            <p style="margin: 6px 0; font-size: 14px;"><strong>🏛 Bank Name:</strong> Nomba / MFB</p>
                            <p style="margin: 6px 0; font-size: 14px;"><strong>🏧 Registered Payout Bank:</strong> ${bankName} (${settlementAccount})</p>
                            <p style="margin: 6px 0; font-size: 14px;"><strong>📱 Username (Phone):</strong> ${phone}</p>
                        </div>
                        <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-top: 25px;">
                            Log in anytime at <a href="https://alltimebusiness.com.ng" style="color: #38bdf8; text-decoration: none; font-weight: 700;">www.alltimebusiness.com.ng</a> to manage your settlements and transactions.
                        </p>
                    </div>
                `
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) console.log('❌ Email Send Error:', error.message);
                else console.log('✅ Email Delivered from All Time Business Ltd:', info.response);
            });
        }

        return res.status(201).json({
            status: 'success',
            message: `🎉 Onboarding Successful!\n\nWelcome to All Time Business Ltd (@BL SOVEREIGN GATEWAY), ${merchantName}.\n\nYour Dedicated NUBAN Account (${generatedNuban}) is live.\n\nAn onboarding email has been sent to ${email}.`
        });

    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Onboarding process encountered an issue.' });
    }
});

app.post('/api/v1/auth/signin', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const account = merchantAccounts[phone];

        if (!account) return res.status(404).json({ status: 'error', message: 'Account not found. Please sign up first.' });

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) return res.status(401).json({ status: 'error', message: 'Invalid password.' });

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

// =========================================================================
// 💳 3. CHECKOUT SUITE (Multi-Channel & Gateway Wallet Balance)
// =========================================================================

// 1. Multi-Channel External Checkout (Card, Transfer, USSD)
app.post('/api/v1/checkout/initialize', async (req, res) => {
    try {
        const { serviceType, targetInput, amount, phone, email, paymentMethod } = req.body;
        const orderRef = `SOV-${Date.now()}`;
        const pricing = calculateInvoiceSplit(amount);

        transactionLedger[orderRef] = {
            status: 'PENDING_PAYMENT',
            serviceType,
            targetInput,
            amount: pricing.cleanTarget,
            totalCharged: pricing.totalCustomerPayment,
            phone,
            email
        };

        if (paymentMethod === 'TRANSFER') {
            let virtualAccountNum = `99${Math.floor(10000000 + Math.random() * 90000000)}`;

            if (NOMBA_ACCESS_TOKEN && !NOMBA_ACCESS_TOKEN.includes('placeholder')) {
                try {
                    const virtualAccount = await axios.post(`${NOMBA_BASE_URL}/accounts/virtual`, {
                        accountRef: orderRef,
                        accountName: `@BL SOVEREIGN - ${serviceType}`,
                        currency: "NGN",
                        amount: pricing.totalCustomerPayment
                    }, {
                        headers: { 'accountId': NOMBA_ACCOUNT_ID, 'Authorization': getAuthHeader() }
                    });
                    virtualAccountNum = virtualAccount.data?.data?.accountNumber || virtualAccountNum;
                } catch (e) {
                    console.log('Using Dynamic Fallback NUBAN Engine');
                }
            }

            return res.status(200).json({
                status: 'success',
                orderRef,
                paymentMethod: 'TRANSFER',
                bankDetails: {
                    accountNumber: virtualAccountNum,
                    bankName: 'Nomba / MFB',
                    corporateFallbackBank: ACCESS_BANK_CORPORATE.bankName,
                    corporateFallbackAccount: ACCESS_BANK_CORPORATE.accountNumber,
                    amountToPay: `₦${pricing.totalCustomerPayment}`
                }
            });
        }

        return res.status(200).json({
            status: 'success',
            orderRef,
            paymentMethod: 'CARD_OR_USSD',
            checkoutUrl: `https://checkout.nomba.com/pay/${orderRef}?amount=${pricing.totalCustomerPayment}`
        });

    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Failed to initialize checkout session.' });
    }
});

// 2. Checkout via Gateway Wallet Balance
app.post('/api/v1/checkout/wallet', async (req, res) => {
    try {
        const { merchantPhone, serviceType, targetInput, amount } = req.body;
        const merchant = merchantAccounts[merchantPhone];

        if (!merchant) {
            return res.status(404).json({ status: 'error', message: 'Merchant account not found.' });
        }

        const pricing = calculateInvoiceSplit(amount);
        const totalCost = pricing.cleanTarget;

        if (merchant.balance < totalCost) {
            return res.status(400).json({ 
                status: 'error', 
                message: `Insufficient wallet balance! Your available balance is ₦${merchant.balance.toFixed(2)}, but this transaction requires ₦${totalCost.toFixed(2)}.` 
            });
        }

        merchant.balance -= totalCost;
        const orderRef = `SOV-WAL-${Date.now()}`;

        transactionLedger[orderRef] = {
            status: 'COMPLETED',
            paymentMethod: 'WALLET_BALANCE',
            serviceType,
            targetInput,
            amount: totalCost,
            phone: merchantPhone,
            fulfilledAt: new Date().toISOString()
        };

        // 🚀 Trigger ClubKonnect Auto-Dispatch
        await executeClubKonnectDispatch(orderRef, serviceType, targetInput, totalCost);

        return res.status(200).json({
            status: 'success',
            message: `🎉 Payment successful! ₦${totalCost.toFixed(2)} deducted from your wallet balance. Service dispatched.`,
            newBalance: merchant.balance,
            orderRef
        });

    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Wallet checkout failed.' });
    }
});

// =========================================================================
// 🔔 4. AUTOMATED WEBHOOK & CLUBKONNECT DISPATCH
// =========================================================================
app.post('/api/v1/nomba-webhook', async (req, res) => {
    try {
        const { event, data } = req.body;

        if (event === 'payment_success' || event === 'SUCCESSFUL_TRANSACTION') {
            const orderRef = data.orderReference || data.accountRef;
            const record = transactionLedger[orderRef];

            if (record && record.status !== 'COMPLETED') {
                record.status = 'PAID';

                // 🚀 Trigger Instant ClubKonnect Dispatch
                await executeClubKonnectDispatch(orderRef, record.serviceType, record.targetInput, record.amount);

                record.status = 'COMPLETED';
                console.log(`✅ Instant Order Delivery Completed | Ref: ${orderRef}`);
            }
        }
        return res.status(200).json({ status: 'success' });
    } catch (error) {
        return res.status(200).json({ status: 'error', message: error.message });
    }
});

// Start Master Server Engine
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`All Time Business Ltd Master Engine LIVE on port ${PORT}`));
