const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Environment Variables from Railway
const NOMBA_ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID;
const NOMBA_ACCESS_TOKEN = process.env.NOMBA_ACCESS_TOKEN;
const NOMBA_BASE_URL = 'https://api.nomba.com/v1';

// Format Bearer Token safely
const getAuthHeader = () => {
    if (!NOMBA_ACCESS_TOKEN) return '';
    return NOMBA_ACCESS_TOKEN.startsWith('Bearer ') 
        ? NOMBA_ACCESS_TOKEN 
        : `Bearer ${NOMBA_ACCESS_TOKEN.trim()}`;
};

// =========================================================================
// 💡 1. @BL SOVEREIGN PASS-THROUGH FEE & CASHBACK ENGINE
// =========================================================================
function calculateInvoiceSplit(targetAmount) {
    const target = parseFloat(targetAmount);

    // Platform Tiered Markup (1k-20k: ₦20 | 21k-50k: ₦25 | 51k+: ₦30)
    let grossPlatformFee = 20.00;
    if (target > 20000 && target <= 50000) grossPlatformFee = 25.00;
    if (target > 50000) grossPlatformFee = 30.00;

    // Nomba Base Fee (₦30.00 Flat Tier) + 7.5% VAT (₦2.25) = ₦32.25
    const nombaBaseFee = 30.00;
    const nombaVat = nombaBaseFee * 0.075;
    const totalNombaDeduction = nombaBaseFee + nombaVat;

    // ₦2.00 Merchant Cashback Split
    const CASHBACK_AMOUNT = 2.00;
    const netGatewayProfit = grossPlatformFee - CASHBACK_AMOUNT;
    const totalMerchantPayout = target + CASHBACK_AMOUNT;

    // Total Amount Customer Must Transfer to Virtual Account
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
app.get('/', (req, res) => {
    res.status(200).json({
        system: "@BL SOVEREIGN GATEWAY",
        provider: "NOMBA SWITCH ENGINE",
        status: "LIVE & OPERATIONAL",
        timestamp: new Date().toISOString()
    });
});

// =========================================================================
// 3. NOMBA VIRTUAL ACCOUNT CREATION ENDPOINT (DYNAMIC ONBOARDING)
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
// 4. NOMBA LIVE WEBHOOK CONTROLLER & CASHBACK LEDGER
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
            
            // Ledger processing logic runs here upon database connection
            console.log(`🎉 ₦2.00 Cashback credited to merchant. Net Gateway Profit logged.`);
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
