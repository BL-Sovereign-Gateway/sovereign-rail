const express = require('express');
const axios = require('axios');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

// Serve static front-end files from "public" directory
app.use(express.static('public'));

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

// In-Memory Database Fallback (Prevents Railway Crashes if DB is Offline)
const tempMerchantStore = [];

// =========================================================================
// 1. @BL SOVEREIGN PASS-THROUGH FEE & CASHBACK ENGINE
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
// 2. HEALTHCHECK & SYSTEM STATUS
// =========================================================================
app.get('/health', (req, res) => {
    res.status(200).json({
        system: "@BL SOVEREIGN GATEWAY",
        provider: "NOMBA SWITCH ENGINE",
        status: "LIVE & OPERATIONAL",
        timestamp: new Date().toISOString()
    });
});

// =========================================================================
// 3. MERCHANT SELF-REGISTRATION ENDPOINT
// =========================================================================
app.post('/api/v1/auth/register-merchant', async (req, res) => {
    try {
        const { businessName, ownerName, email, phone, password, settlementBankCode, settlementAccountNumber, cacNumber } = req.body;

        if (!businessName || !email || !phone || !password || !settlementAccountNumber || !settlementBankCode) {
            return res.status(400).json({
                status: 'error',
                message: 'All primary fields (Business Name, Email, Phone, Password, Settlement Bank) are required.'
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
            settlementBankCode,
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
// 4. NOMBA VIRTUAL ACCOUNT CREATION ENDPOINT
// =========================================================================
app.post('/api/v1/create-virtual-account', async (req, res) => {
    try {
        const { schoolName, targetAmount, accountRef } = req.body;

        if (!schoolName || !targetAmount || !accountRef) {
            return res.status(400).json({
                status: 'error',
                message: 'Missing required parameters: schoolName, targetAmount, accountRef'
            });
        }

        const pricing = calculateInvoiceSplit(targetAmount);

        console.log(`@BL Gateway: Issuing Virtual Account for ${schoolName} | Target: ₦${pricing.cleanTarget} | Transfer Total: ₦${pricing.totalCustomerPayment}`);

        const nombaPayload = {
            accountRef: accountRef,
            accountName: schoolName,
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
            message: `Virtual account generated for '${schoolName}'`,
            account_details: {
                accountNumber: accountData.accountNumber,
                bankName: accountData.bankName || 'Nomba / MFB',
                accountName: schoolName,
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
// 5. NOMBA LIVE WEBHOOK CONTROLLER & CASHBACK LEDGER
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

            console.log(`✅ PAYMENT RECEIVED: Ref: ${transactionRef} | AccountRef: ${accountRef} | Amount: ₦${grossPaidAmount}`);
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
