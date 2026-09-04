/**
 * ============================================================================
 * @BL SOVEREIGN GATEWAY - MASTER SWITCH & VERIFICATION ENGINE
 * Ecosystem: Nomba API + Real-Time Verification Ledger + Pass-Through Fees
 * Engine: Node.js (Express) Deployed on Railway
 * ============================================================================
 */

const express = require('express');
const path = require('path');
const axios = require('axios');
const bcrypt = require('bcryptjs');

const app = express();

// Body Parser Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Public Assets
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables
const NOMBA_ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const NOMBA_ACCESS_TOKEN = process.env.NOMBA_ACCESS_TOKEN;
const NOMBA_BASE_URL = 'https://api.nomba.com/v1';

// Safe Bearer Header Formatter
const getAuthHeader = () => {
    if (!NOMBA_ACCESS_TOKEN) return '';
    return NOMBA_ACCESS_TOKEN.startsWith('Bearer ')
        ? NOMBA_ACCESS_TOKEN
        : `Bearer ${NOMBA_ACCESS_TOKEN.trim()}`;
};

// In-Memory Database & Live Payment Verification Ledger
const tempMerchantStore = [];
const transactionLedger = {}; 

// =========================================================================
// 💡 1. PASS-THROUGH CONVENIENCE FEE & CASHBACK CALCULATOR
// =========================================================================
function calculateInvoiceSplit(targetAmount) {
    const target = parseFloat(targetAmount);

    let grossPlatformFee = 20.00;
    if (target > 20000 && target <= 50000) grossPlatformFee = 25.00;
    if (target > 50000) grossPlatformFee = 30.00;

    const nombaBaseFee = 30.00;
    const nombaVat = nombaBaseFee * 0.075;
    const totalNombaDeduction = nombaBaseFee + nombaVat;

    const CASHBACK_AMOUNT = 2.00;
    const netGatewayProfit = grossPlatformFee - CASHBACK_AMOUNT;
    const totalMerchantPayout = target + CASHBACK_AMOUNT;

    const totalCustomerPayment = Math.ceil(target + totalNombaDeduction + grossPlatformFee);

    return {
        cleanTarget: target,
        totalCustomerPayment: totalCustomerPayment,
        nombaFeeDeduction: totalNombaDeduction,
        grossPlatformFee: grossPlatformFee,
        cashbackAmount: CASHBACK_AMOUNT,
        netGatewayProfit: netGatewayProfit,
        totalMerchantPayout: totalMerchantPayout
    };
}

// =========================================================================
// 🌐 2. FRONT-END ROUTING & PAGES
// =========================================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) {
            res.status(200).json({
                system: "@BL SOVEREIGN GATEWAY",
                provider: "NOMBA SWITCH ENGINE",
                status: "LIVE & OPERATIONAL",
                timestamp: new Date().toISOString()
            });
        }
    });
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/education-support', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'education-support.html'));
});

app.get('/credit-support', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'credit-support.html'));
});

// =========================================================================
// 🔍 3. REAL-TIME PAYMENT VERIFICATION ENDPOINT
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
// 🔐 4. MERCHANT SELF-REGISTRATION ENDPOINT
// =========================================================================
app.post('/api/v1/auth/register-merchant', async (req, res) => {
    try {
        const { businessName, ownerName, email, phone, password, bankCode, settlementBankCode, settlementAccountNumber, cacNumber } = req.body;
        const effectiveBankCode = bankCode || settlementBankCode;

        if (!businessName || !email || !phone || !password || !settlementAccountNumber || !effectiveBankCode) {
            return res.status(400).json({
                status: 'error',
                message: 'All primary fields are required.'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const merchantRef = `BL-MCH-${Math.floor(100000 + Math.random() * 900000)}`;

        const newMerchant = {
            id: tempMerchantStore.length + 1,
            merchantRef,
            businessName,
            ownerName: ownerName || businessName,
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            hashedPassword,
            settlementBankCode: effectiveBankCode,
            settlementAccountNumber,
            cacNumber: cacNumber || null,
            balance: 0.00,
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
        };

        tempMerchantStore.push(newMerchant);

        return res.status(201).json({
            status: 'success',
            message: 'Merchant account registered successfully!',
            data: { merchantRef: newMerchant.merchantRef, businessName: newMerchant.businessName }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Internal server error during registration.' });
    }
});

// =========================================================================
// ⚡ 5. NOMBA VIRTUAL ACCOUNT CREATION ENDPOINT
// =========================================================================
app.post('/api/v1/create-virtual-account', async (req, res) => {
    try {
        const { merchantName, schoolName, targetAmount, accountRef } = req.body;
        const activeMerchantName = merchantName || schoolName;

        if (!activeMerchantName || !targetAmount || !accountRef) {
            return res.status(400).json({ status: 'error', message: 'Missing required parameters.' });
        }

        const pricing = calculateInvoiceSplit(targetAmount);

        // Fallback for testing before live Nomba keys are applied
        if (!NOMBA_ACCESS_TOKEN || NOMBA_ACCESS_TOKEN.includes('placeholder')) {
            const mockNuban = `99${Math.floor(10000000 + Math.random() * 90000000)}`;
            
            // Register reference in ledger
            transactionLedger[accountRef] = { status: 'PENDING', amount: pricing.totalCustomerPayment };

            return res.status(200).json({
                status: 'success',
                message: `Virtual account generated for '${activeMerchantName}'`,
                account_details: {
                    accountNumber: mockNuban,
                    bankName: 'Nomba / MFB',
                    accountName: activeMerchantName,
                    customerMustTransfer: `₦${pricing.totalCustomerPayment}`
                },
                pricing_breakdown: pricing
            });
        }

        const nombaPayload = {
            accountRef: accountRef,
            accountName: activeMerchantName,
            currency: "NGN",
            amount: pricing.totalCustomerPayment
        };

        const response = await axios.post(`${NOMBA_BASE_URL}/accounts/virtual`, nombaPayload, {
            headers: {
                'accountId': NOMBA_ACCOUNT_ID,
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            timeout: 12000
        });

        const accountData = response.data?.data || response.data;
        transactionLedger[accountRef] = { status: 'PENDING', amount: pricing.totalCustomerPayment };

        return res.status(200).json({
            status: 'success',
            message: `Virtual account generated for '${activeMerchantName}'`,
            account_details: {
                accountNumber: accountData.accountNumber,
                bankName: accountData.bankName || 'Nomba / MFB',
                accountName: activeMerchantName,
                customerMustTransfer: `₦${pricing.totalCustomerPayment}`
            },
            pricing_breakdown: pricing
        });

    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Failed to create virtual account on Nomba' });
    }
});

// =========================================================================
// 🔔 6. NOMBA LIVE WEBHOOK CONTROLLER
// =========================================================================
app.post('/api/v1/nomba-webhook', (req, res) => {
    try {
        const payload = req.body;
        const eventType = payload.event || payload.type;

        if (eventType === 'payment_success' || eventType === 'SUCCESSFUL_TRANSACTION') {
            const data = payload.data || payload;
            const ref = data.orderReference || data.accountRef || data.customerIdentifier;
            const grossPaidAmount = parseFloat(data.amount || 0);

            // Record live successful payment to ledger
            transactionLedger[ref] = {
                status: 'PAID',
                amount: grossPaidAmount,
                transactionRef: data.transactionRef || `TX-${Date.now()}`,
                paidAt: new Date().toISOString()
            };

            console.log(`✅ LIVE PAYMENT CONFIRMED | Ref: ${ref} | Amount: ₦${grossPaidAmount}`);
        }

        return res.status(200).json({ status: 'success', message: 'Webhook processed successfully' });
    } catch (error) {
        return res.status(200).json({ status: 'error', message: error.message });
    }
});

// Port Setup
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`@BL Sovereign Gateway Engine LIVE on port ${PORT}`));
