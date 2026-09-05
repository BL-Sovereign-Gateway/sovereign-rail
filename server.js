/**
 * ============================================================================
 * @BL SOVEREIGN GATEWAY - MASTER SERVER ENGINE
 * Full Ecosystem: Merchant Auth | Credit | Education | Betting | VTU | Bills | Newsletter | Nomba
 * Deployment: Node.js (Express) on Railway
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');

const app = express();

// Body Parser & Static Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables
const NOMBA_ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const NOMBA_ACCESS_TOKEN = process.env.NOMBA_ACCESS_TOKEN;
const NOMBA_BASE_URL = 'https://api.nomba.com/v1';

// Authorization Header Formatter
const getAuthHeader = () => {
    if (!NOMBA_ACCESS_TOKEN) return '';
    return NOMBA_ACCESS_TOKEN.startsWith('Bearer ')
        ? NOMBA_ACCESS_TOKEN
        : `Bearer ${NOMBA_ACCESS_TOKEN.trim()}`;
};

// In-Memory Database Stores
const tempMerchantStore = [];
const transactionLedger = {}; 
const creditApplications = [];
const newsletterSubscribers = [];

// Default Newsletter Publications
const publishedNewsletters = [
    {
        id: "news-001",
        title: "Welcome to @BL Sovereign Gateway: The Future of Digital Settlement",
        date: "September 5, 2026",
        summary: "Introducing our core infrastructure—SoftPOS, Dynamic QR, and Instant Virtual NUBAN accounts.",
        content: "We are excited to launch @BL Sovereign Gateway, providing businesses across Nigeria with high-speed payment infrastructure, automated fee-splitting, and instant settlement. Stay tuned for regular updates on fintech trends, integration guides, and platform developments."
    }
];

// Supported Betting Platforms
const SUPPORTED_BOOKMAKERS = [
    { id: 'SPORTYBET', name: 'SportyBet' },
    { id: 'BET9JA', name: 'Bet9ja' },
    { id: '1XBET', name: '1xBet' },
    { id: 'BETKING', name: 'BetKing' },
    { id: 'MSPORT', name: 'MSport' },
    { id: 'BETWAY', name: 'Betway' },
    { id: 'BETANO', name: 'Betano' },
    { id: '1WIN', name: '1Win' },
    { id: '22BET', name: '22Bet' },
    { id: 'MELBET', name: 'Melbet' },
    { id: 'BETWINNER', name: 'BetWinner' },
    { id: 'MOZZARTBET', name: 'MozzartBet' },
    { id: 'BETPAWA', name: 'BetPawa' },
    { id: 'BANGBET', name: 'BangBet' },
    { id: 'MERRYBET', name: 'Merrybet' },
    { id: 'NAIRABET', name: 'NairaBet' },
    { id: 'ACCESSBET', name: 'AccessBet' },
    { id: 'LIVESCOREBET', name: 'LiveScoreBet' },
    { id: 'ILOTBET', name: 'iLotBet' },
    { id: 'PARIPESA', name: 'PariPesa' },
    { id: 'ZEBET', name: 'ZEbet' },
    { id: 'SUREBET247', name: 'SureBet247' },
    { id: 'GREEN_LOTTO', name: 'Green Lotto' },
    { id: 'GAMES4WIN', name: 'Winners Golden Bet' }
];

// Network Operators & Data Plans
const NETWORK_PROVIDERS = [
    { id: 'MTN', name: 'MTN Nigeria' },
    { id: 'AIRTEL', name: 'Airtel Nigeria' },
    { id: 'GLO', name: 'Glo Nigeria' },
    { id: '9MOBILE', name: '9mobile Nigeria' }
];

const DATA_PLANS = {
    MTN: [
        { planId: 'm-500mb', name: '500MB SME Data (30 Days)', price: 150 },
        { planId: 'm-1gb', name: '1GB SME Data (30 Days)', price: 290 },
        { planId: 'm-2gb', name: '2GB Direct Data (30 Days)', price: 580 },
        { planId: 'm-5gb', name: '5GB Direct Data (30 Days)', price: 1450 }
    ],
    AIRTEL: [
        { planId: 'a-1gb', name: '1GB Corporate Data (30 Days)', price: 300 },
        { planId: 'a-2gb', name: '2GB Corporate Data (30 Days)', price: 600 },
        { planId: 'a-5gb', name: '5GB Direct Data (30 Days)', price: 1500 }
    ],
    GLO: [
        { planId: 'g-1gb', name: '1.25GB Data (30 Days)', price: 480 },
        { planId: 'g-2gb', name: '2.5GB Data (30 Days)', price: 950 }
    ],
    '9MOBILE': [
        { planId: '9-1gb', name: '1GB Data (30 Days)', price: 450 }
    ]
};

// Bill Payment Providers
const BILL_PROVIDERS = [
    { id: 'IKEDC', name: 'Ikeja Electric (IKEDC)', type: 'UTILITY' },
    { id: 'EKEDC', name: 'Eko Electric (EKEDC)', type: 'UTILITY' },
    { id: 'IBEDC', name: 'Ibadan Electric (IBEDC)', type: 'UTILITY' },
    { id: 'DSTV', name: 'DSTV Subscription', type: 'CABLE' },
    { id: 'GOTV', name: 'GOTV Subscription', type: 'CABLE' },
    { id: 'STARTIMES', name: 'Startimes', type: 'CABLE' }
];

// Pass-Through Revenue Engine
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

// =========================================================================
// 🌐 1. FRONTEND PAGE ROUTING
// =========================================================================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/education-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'education-support.html')));
app.get('/credit-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'credit-support.html')));
app.get('/betting-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'betting-support.html')));
app.get('/vtu-support', (req, res) => res.sendFile(path.join(__dirname, 'public', 'vtu-support.html')));
app.get('/bill-payments', (req, res) => res.sendFile(path.join(__dirname, 'public', 'bill-payments.html')));
app.get('/newsletter', (req, res) => res.sendFile(path.join(__dirname, 'public', 'newsletter.html')));

// =========================================================================
// 📰 2. NEWSLETTER & PUBLIC UPDATES MODULE
// =========================================================================
app.post('/api/v1/newsletter/subscribe', (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ status: 'error', message: 'Please provide a valid email address.' });
        }

        if (!newsletterSubscribers.includes(email)) {
            newsletterSubscribers.push(email);
        }

        return res.status(200).json({
            status: 'success',
            message: 'Subscribed successfully! You will receive our latest publications directly in your inbox.'
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Failed to process newsletter subscription.' });
    }
});

app.get('/api/v1/newsletter/articles', (req, res) => {
    return res.status(200).json({ status: 'success', articles: publishedNewsletters });
});

// =========================================================================
// 📝 3. MERCHANT ONBOARDING
// =========================================================================
app.post('/api/v1/register', async (req, res) => {
    try {
        const { merchantName, email, phone, password, settlementAccount, bankName } = req.body;

        if (!merchantName || !email || !settlementAccount) {
            return res.status(400).json({ status: 'error', message: 'All required fields must be completed.' });
        }

        const hashedPassword = await bcrypt.hash(password || 'DefaultPass123', 10);
        const newMerchant = {
            id: `MCH-${Date.now()}`,
            merchantName,
            email,
            phone,
            password: hashedPassword,
            settlementAccount,
            bankName: bankName || 'Access Bank Plc',
            createdAt: new Date().toISOString()
        };

        tempMerchantStore.push(newMerchant);

        return res.status(201).json({
            status: 'success',
            message: 'Merchant account created successfully!',
            merchantId: newMerchant.id
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Server error during merchant registration.' });
    }
});

// =========================================================================
// 💳 4. SAIL CREDIT SUPPORT
// =========================================================================
app.post('/api/v1/credit/apply', (req, res) => {
    try {
        const { merchantName, amount, tenor, turnover } = req.body;

        if (!merchantName || !amount) {
            return res.status(400).json({ status: 'error', message: 'Missing required application fields.' });
        }

        const applicationRef = `SAIL-CR-${Date.now()}`;
        creditApplications.push({
            applicationRef,
            merchantName,
            amount,
            tenor,
            turnover,
            status: 'PENDING_REVIEW',
            appliedAt: new Date().toISOString()
        });

        return res.status(200).json({
            status: 'success',
            message: 'Credit line application received successfully.',
            applicationRef: applicationRef
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Server error processing credit application.' });
    }
});

// =========================================================================
// 🎓 5. EDUCATION SUPPORT FUND
// =========================================================================
app.post('/api/v1/education/donate', (req, res) => {
    try {
        const { donorName, schoolName, purpose, amount } = req.body;

        if (!donorName || !amount) {
            return res.status(400).json({ status: 'error', message: 'Donor name and amount are required.' });
        }

        const accountRef = `EDU-${Date.now()}`;
        const pricing = calculateInvoiceSplit(amount);

        transactionLedger[accountRef] = {
            status: 'PENDING',
            type: 'EDUCATION_SUPPORT',
            donorName,
            schoolName: schoolName || 'Real Schools, Eyita',
            purpose,
            amount: pricing.totalCustomerPayment
        };

        return res.status(200).json({
            status: 'success',
            accountRef: accountRef,
            pricing: pricing
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Server error processing education contribution.' });
    }
});

// =========================================================================
// 🎰 6. BETTING SERVICES
// =========================================================================
app.get('/api/v1/betting/providers', (req, res) => {
    return res.status(200).json({ status: 'success', data: SUPPORTED_BOOKMAKERS });
});

app.post('/api/v1/betting/initiate-topup', (req, res) => {
    try {
        const { providerId, userId, amount } = req.body;
        if (!providerId || !userId || !amount) {
            return res.status(400).json({ status: 'error', message: 'All fields are required.' });
        }

        const accountRef = `BET-${Date.now()}`;
        const pricing = calculateInvoiceSplit(amount);

        transactionLedger[accountRef] = {
            status: 'PENDING',
            type: 'BETTING_TOPUP',
            providerId,
            userId,
            amount: pricing.totalCustomerPayment
        };

        return res.status(200).json({
            status: 'success',
            accountRef: accountRef,
            pricing: pricing
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Server error processing betting top-up.' });
    }
});

// =========================================================================
// 📱 7. AIRTIME & DATA (VTU)
// =========================================================================
app.get('/api/v1/vtu/providers', (req, res) => {
    return res.status(200).json({ status: 'success', providers: NETWORK_PROVIDERS, plans: DATA_PLANS });
});

app.post('/api/v1/vtu/initiate', (req, res) => {
    try {
        const { type, network, phone, planId, amount } = req.body;
        if (!network || !phone || !amount) {
            return res.status(400).json({ status: 'error', message: 'Missing required details.' });
        }

        const accountRef = `VTU-${Date.now()}`;
        const pricing = calculateInvoiceSplit(amount);

        transactionLedger[accountRef] = {
            status: 'PENDING',
            type: type || 'AIRTIME',
            network,
            phone,
            planId: planId || null,
            amount: pricing.totalCustomerPayment
        };

        return res.status(200).json({
            status: 'success',
            accountRef: accountRef,
            pricing: pricing
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Server error processing VTU order.' });
    }
});

// =========================================================================
// ⚡ 8. BILL PAYMENTS (Utilities, Cable TV, Levies)
// =========================================================================
app.get('/api/v1/bills/providers', (req, res) => {
    return res.status(200).json({ status: 'success', data: BILL_PROVIDERS });
});

app.post('/api/v1/bills/pay', (req, res) => {
    try {
        const { providerId, customerIdentifier, amount } = req.body;
        if (!providerId || !customerIdentifier || !amount) {
            return res.status(400).json({ status: 'error', message: 'All bill payment details are required.' });
        }

        const accountRef = `BILL-${Date.now()}`;
        const pricing = calculateInvoiceSplit(amount);

        transactionLedger[accountRef] = {
            status: 'PENDING',
            type: 'BILL_PAYMENT',
            providerId,
            customerIdentifier,
            amount: pricing.totalCustomerPayment
        };

        return res.status(200).json({
            status: 'success',
            accountRef: accountRef,
            pricing: pricing
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Server error processing bill payment.' });
    }
});

// =========================================================================
// 🔍 9. UNIVERSAL PAYMENT VERIFICATION
// =========================================================================
app.get('/api/v1/verify-payment/:accountRef', (req, res) => {
    const ref = req.params.accountRef;
    const record = transactionLedger[ref];

    if (record && record.status === 'PAID') {
        return res.status(200).json({
            status: 'PAID',
            message: 'Payment confirmed live on bank switch!',
            data: record
        });
    }

    return res.status(200).json({
        status: 'PENDING',
        message: 'Payment not yet detected by bank switch.'
    });
});

// =========================================================================
// 🏦 10. NOMBA VIRTUAL ACCOUNT GENERATOR
// =========================================================================
app.post('/api/v1/create-virtual-account', async (req, res) => {
    try {
        const { merchantName, targetAmount, accountRef } = req.body;
        const pricing = calculateInvoiceSplit(targetAmount);

        if (!NOMBA_ACCESS_TOKEN || NOMBA_ACCESS_TOKEN.includes('placeholder')) {
            const mockNuban = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
            transactionLedger[accountRef] = { status: 'PENDING', amount: pricing.totalCustomerPayment };

            return res.status(200).json({
                status: 'success',
                account_details: {
                    accountNumber: mockNuban,
                    bankName: 'Nomba / MFB',
                    accountName: merchantName,
                    customerMustTransfer: `₦${pricing.totalCustomerPayment}`
                },
                pricing_breakdown: pricing
            });
        }

        const response = await axios.post(`${NOMBA_BASE_URL}/accounts/virtual`, {
            accountRef: accountRef,
            accountName: merchantName,
            currency: "NGN",
            amount: pricing.totalCustomerPayment
        }, {
            headers: {
                'accountId': NOMBA_ACCOUNT_ID,
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            }
        });

        const accountData = response.data?.data || response.data;
        transactionLedger[accountRef] = { status: 'PENDING', amount: pricing.totalCustomerPayment };

        return res.status(200).json({
            status: 'success',
            account_details: {
                accountNumber: accountData.accountNumber,
                bankName: accountData.bankName || 'Nomba / MFB',
                accountName: merchantName,
                customerMustTransfer: `₦${pricing.totalCustomerPayment}`
            },
            pricing_breakdown: pricing
        });

    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Failed to create virtual account.' });
    }
});

// =========================================================================
// 🔔 11. LIVE NOMBA WEBHOOK RECEIVER
// =========================================================================
app.post('/api/v1/nomba-webhook', (req, res) => {
    try {
        const payload = req.body;
        const eventType = payload.event || payload.type;

        if (eventType === 'payment_success' || eventType === 'SUCCESSFUL_TRANSACTION') {
            const data = payload.data || payload;
            const ref = data.orderReference || data.accountRef || data.customerIdentifier;

            transactionLedger[ref] = {
                status: 'PAID',
                amount: parseFloat(data.amount || 0),
                paidAt: new Date().toISOString()
            };
            console.log(`✅ LIVE PAYMENT CONFIRMED | Ref: ${ref}`);
        }

        return res.status(200).json({ status: 'success' });
    } catch (error) {
        return res.status(200).json({ status: 'error', message: error.message });
    }
});

// Start Master Server Engine
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`@BL Sovereign Gateway Engine LIVE on port ${PORT}`));
