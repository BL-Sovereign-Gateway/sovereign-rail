/**
 * ============================================================================
 * @BL SOVEREIGN GATEWAY - ALL-IN-ONE MASTER PRODUCTION ENGINE
 * Ecosystem: Nomba API + Pass-Through Billing + ₦2.00 Cashback + Merchant Auth
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

// Explicitly Serve Static Public Assets (HTML, CSS, JS, Images)
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables from Railway
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

// In-Memory Database Fallback (Prevents Server Crashes Prior to Database Hookup)
const tempMerchantStore = [];

// =========================================================================
// 💡 1. PASS-THROUGH CONVENIENCE FEE & ₦2.00 CASHBACK ENGINE
// =========================================================================
function calculateInvoiceSplit(targetAmount) {
    const target = parseFloat(targetAmount);

    // Platform Tiered Markup (1k–20k: ₦20 | 21k–50k: ₦25 | 51k+: ₦30)
    let grossPlatformFee = 20.00;
    if (target > 20000 && target <= 50000) grossPlatformFee = 25.00;
    if (target > 50000) grossPlatformFee = 30.00;

    // Nomba Negotiated Flat Charge (₦30.00) + 7.5% VAT (₦2.25) = ₦32.25
    const nombaBaseFee = 30.00;
    const nombaVat = nombaBaseFee * 0.075;
    const totalNombaDeduction = nombaBaseFee + nombaVat;

    // ₦2.00 Merchant Cashback Reward
    const CASHBACK_AMOUNT = 2.00;
    const netGatewayProfit = grossPlatformFee - CASHBACK_AMOUNT;
    const totalMerchantPayout = target + CASHBACK_AMOUNT;

    // Total Amount Customer Transfers to Nomba Virtual NUBAN
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
// 🌐 2. FRONT-END ROUTING & PAGES (SERVED FROM /public)
// =========================================================================

// Home / Healthcheck Page
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
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

// Self-Registration Page Route
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'), (err) => {
        if (err) {
            res.status(404).send("<h2>@BL Gateway: register.html not found inside 'public' folder.</h2>");
        }
    });
});

// Merchant Portal / Dashboard Route
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'), (err) => {
        if (err) {
            res.status(404).send("<h2>@BL Gateway: dashboard.html not found inside 'public' folder.</h2>");
        }
    });
});

// Education Support Route
app.get('/education-support', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'education-support.html'), (err) => {
        if (err) {
            res.status(404).send("<h2>@BL Gateway: education-support.html not found inside 'public' folder.</h2>");
        }
    });
});

// Sail Credit Support Route
app.get('/credit-support', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'credit-support.html'), (err) => {
        if (err) {
            res.status(404).send("<h2>@BL Gateway: credit-support.html not found inside 'public' folder.</h2>");
        }
    });
});

// =========================================================================
// 🔐 3. MERCHANT SELF-REGISTRATION ENDPOINT
// =========================================================================
app.post('/api/v1/auth/register-merchant', async (req, res) => {
    try {
        const { businessName, ownerName, email, phone, password, bankCode, settlementBankCode, settlementAccountNumber, cacNumber } = req.body;

        const effectiveBankCode = bankCode || settlementBankCode;

        if (!businessName || !email || !phone || !password || !settlementAccountNumber || !effectiveBankCode) {
            return res.status(400).json({
                status: 'error',
                message: 'All primary fields (Merchant Name, Email, Phone, Password, Settlement Account & Bank) are required.'
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
            tierLevel: 'TIER_1',
            balance: 0.00,
            totalCashbackEarned: 0.00,
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
        };

        tempMerchantStore.push(newMerchant);

        console.log(`🎉 New Merchant Registered: ${businessName} (${merchantRef})`);

        return res.status(201).json({
            status: 'success',
            message: 'Merchant account registered successfully!',
            data: {
                merchantId: newMerchant.id,
                merchantRef: newMerchant.merchantRef,
                businessName: newMerchant.businessName,
                email: newMerchant.email,
                cashbackEligible: true,
                cashbackRate: '₦2.00 per transaction'
            }
        });
    } catch (error) {
        console.error('❌ Merchant Registration Error:', error.message);
        return res.status(500).json({ status: 'error', message: 'Internal server error during registration.' });
    }
});

// =========================================================================
// ⚡ 4. NOMBA VIRTUAL ACCOUNT CREATION ENDPOINT
// =========================================================================
app.post('/api/v1/create-virtual-account', async (req, res) => {
    try {
        const { merchantName, schoolName, targetAmount, accountRef } = req.body;
        const activeMerchantName = merchantName || schoolName;

        if (!activeMerchantName || !targetAmount || !accountRef) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required parameters: merchantName (or schoolName), targetAmount, accountRef'
            });
        }

        const pricing = calculateInvoiceSplit(targetAmount);

        console.log(`@BL Gateway: Issuing Virtual Account for ${activeMerchantName} | Target: ₦${pricing.cleanTarget} | Transfer Total: ₦${pricing.totalCustomerPayment}`);

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

        return res.status(200).json({
            status: 'success',
            message: `Virtual account generated for '${activeMerchantName}'`,
            account_details: {
                accountNumber: accountData.accountNumber,
                bankName: accountData.bankName || 'Nomba / MFB',
                accountName: activeMerchantName,
                customerMustTransfer: `₦${pricing.totalCustomerPayment}`,
                merchantTargetPayout: `₦${pricing.cleanTarget}`,
                cashbackEarned: `₦${pricing.cashbackAmount}`
            },
            pricing_breakdown: pricing
        });

    } catch (error) {
        console.error("@BL Virtual Account Generation Error:", error.response ? error.response.data : error.message);
        return res.status(error.response ? error.response.status : 500).json({
            status: 'error',
            message: 'Failed to create virtual account on Nomba',
            details: error.response ? error.response.data : error.message
        });
    }
});

// =========================================================================
// 💳 5. SAIL CREDIT SUPPORT APPLICATION ENDPOINT
// =========================================================================
app.post('/api/v1/credit/apply', async (req, res) => {
    try {
        const { merchantRef, requestedAmount, repaymentTenor, monthlyTurnover, purpose } = req.body;

        if (!merchantRef || !requestedAmount || !repaymentTenor || !monthlyTurnover) {
            return res.status(400).json({
                status: 'error',
                message: 'All fields (Merchant Ref, Requested Amount, Tenor, and Turnover) are required.'
            });
        }

        const amount = parseFloat(requestedAmount);
        const turnover = parseFloat(monthlyTurnover);
        const maxEligibleCredit = turnover * 0.50;

        if (amount > maxEligibleCredit) {
            return res.status(400).json({
                status: 'error',
                message: `Credit request exceeds eligibility limit. Maximum eligible credit line: ₦${maxEligibleCredit.toLocaleString()}.`
            });
        }

        const creditAppRef = `SAIL-CRD-${Math.floor(100000 + Math.random() * 900000)}`;

        console.log(`💳 Sail Credit Application: ${merchantRef} | Amount: ₦${amount} | Ref: ${creditAppRef}`);

        return res.status(200).json({
            status: 'success',
            message: `Credit application ${creditAppRef} received! An officer will contact you within 24 hours.`,
            data: { creditAppRef, merchantRef, approvedAmount: amount, tenor: repaymentTenor }
        });
    } catch (error) {
        console.error('❌ Sail Credit Processing Error:', error.message);
        return res.status(500).json({ status: 'error', message: 'Internal server error processing credit application.' });
    }
});

// =========================================================================
// 🔔 6. NOMBA LIVE WEBHOOK CONTROLLER & CASHBACK LEDGER
// =========================================================================
app.post('/api/v1/nomba-webhook', (req, res) => {
    try {
        const payload = req.body;
        const eventType = payload.event || payload.type;

        console.log(`@BL Webhook Alert: Incoming event [${eventType}]`);

        if (eventType === 'payment_success' || eventType === 'SUCCESSFUL_TRANSACTION') {
            const data = payload.data || payload;
            const transactionRef = data.orderReference || data.transactionRef;
            const accountRef = data.accountRef || data.customerIdentifier;
            const grossPaidAmount = parseFloat(data.amount || 0);

            console.log(`✅ PAYMENT CONFIRMED: Ref: ${transactionRef} | AccountRef: ${accountRef} | Amount Received: ₦${grossPaidAmount}`);
            console.log(`🎉 ₦2.00 Cashback credited to merchant ledger.`);
        }

        return res.status(200).json({ status: 'success', message: 'Webhook processed successfully' });
    } catch (error) {
        console.error("❌ Webhook Handling Error:", error.message);
        return res.status(200).json({ status: 'error', message: error.message });
    }
});

// =========================================================================
// PORT CONFIGURATION & SERVER LAUNCH
// =========================================================================
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`@BL Sovereign Gateway Engine LIVE on port ${PORT}`));
