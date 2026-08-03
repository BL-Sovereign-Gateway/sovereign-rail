const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Environment Variables from Railway
const SECRET_HASH = process.env.FLW_SECRET_HASH;
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY;

// Squad Official Base URL
const SQUAD_BASE_URL = 'https://api-d.squadco.com';

// Helper function to format Bearer Token safely
const getAuthHeader = () => {
    if (!SQUAD_SECRET_KEY) return '';
    return SQUAD_SECRET_KEY.startsWith('Bearer ') 
        ? SQUAD_SECRET_KEY 
        : `Bearer ${SQUAD_SECRET_KEY.trim()}`;
};

// =========================================================================
// 💡 1. @BL SOVEREIGN TIERED CONVENIENCE MARKUP ENGINE
// =========================================================================
function calculateConvenienceFee(baseAmount) {
    let markup = 0;

    if (baseAmount <= 20000) {
        markup = 20; // ₦20 for amounts up to ₦20,000
    } else if (baseAmount <= 50000) {
        markup = 25; // ₦25 for amounts between ₦20,001 and ₦50,000
    } else {
        markup = 30; // ₦30 for amounts above ₦50,000
    }

    const totalAmount = baseAmount + markup;
    const totalAmountInKobo = Math.round(totalAmount * 100); // Squad expects Kobo

    return {
        baseAmount,
        markup,
        totalAmount,
        totalAmountInKobo
    };
}

// =========================================================================
// 2. HEALTHCHECK & SYSTEM STATUS
// =========================================================================
app.get('/', (req, res) => {
    res.status(200).json({
        system: "@BL SOVEREIGN GATEWAY",
        status: "LIVE & OPERATIONAL",
        timestamp: new Date().toISOString()
    });
});

// =========================================================================
// 3. FLUTTERWAVE WEBHOOK ENDPOINT
// =========================================================================
app.post('/webhook', (req, res) => {
    const signature = req.headers['verif-hash'];
    
    if (!signature || (signature !== SECRET_HASH)) {
        console.log("@BL Alert: Unauthorized Webhook Attempt Blocked.");
        return res.status(401).end();
    }

    const payload = req.body;
    console.log(`@BL Sovereign Webhook: Processing Ref: ${payload.tx_ref}`);
    
    if (payload.status === 'successful') {
        console.log(`CONFIRMED: ${payload.amount} ${payload.currency} received from ${payload.customer?.email}`);
    }

    res.status(200).end();
});

// =========================================================================
// 4. DYNAMIC SQUAD SUB-MERCHANT ONBOARDING ENDPOINT
// =========================================================================
app.post('/api/v1/register-merchant', async (req, res) => {
    try {
        const { displayName, accountName, email, accountNumber, bankCode, bankName } = req.body;

        // Dynamic validation check
        if (!displayName || !accountName || !email || !accountNumber) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing required parameters. Include: displayName, accountName, email, accountNumber, bankCode, bankName.'
            });
        }

        console.log(`@BL Gateway: Onboarding merchant -> ${displayName}`);

        const squadPayload = {
            display_name: displayName,
            account_name: accountName,
            email: email,
            account_number: accountNumber,
            bank_code: bankCode || "090405",           // Default: Moniepoint MFB if omitted
            bank: bankName || "Moniepoint MFB"
        };

        const response = await axios.post(`${SQUAD_BASE_URL}/merchant/create-sub-users`, squadPayload, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            timeout: 12000
        });

        return res.status(200).json({
            status: 'success',
            message: `Sub-merchant '${displayName}' registered successfully`,
            squad_data: response.data
        });

    } catch (error) {
        console.error("@BL Sub-Merchant Onboarding Error:", error.response ? error.response.data : error.message);
        return res.status(error.response ? error.response.status : 500).json({
            status: 'error',
            message: 'Squad merchant onboarding failed or timed out',
            details: error.response ? error.response.data : error.message
        });
    }
});

// =========================================================================
// 5. TRANSACTION CHARGE ENDPOINT (WITH MARKUP APPLICATION)
// =========================================================================
app.post('/api/v1/initiate-payment', async (req, res) => {
    try {
        const { email, amount, subAccountId, transactionRef } = req.body;

        if (!email || !amount || !subAccountId) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'Missing payment parameters. Provide email, amount, and subAccountId.' 
            });
        }

        // Apply Tiered Markup
        const feeCalculation = calculateConvenienceFee(Number(amount));

        console.log(`@BL Fee Engine: Base=₦${feeCalculation.baseAmount} | Markup=₦${feeCalculation.markup} | Total Charged=₦${feeCalculation.totalAmount}`);

        const squadPayload = {
            email: email,
            amount: feeCalculation.totalAmountInKobo,
            currency: "NGN",
            initiate_type: "inline",
            sub_account_id: subAccountId,
            transaction_ref: transactionRef || `BL-${Date.now()}`
        };

        const response = await axios.post(`${SQUAD_BASE_URL}/transaction/initiate`, squadPayload, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            timeout: 12000
        });

        return res.status(200).json({
            status: 'success',
            markup_applied: `₦${feeCalculation.markup}`,
            breakdown: feeCalculation,
            squad_response: response.data
        });

    } catch (error) {
        console.error("@BL Payment Initiation Error:", error.response ? error.response.data : error.message);
        return res.status(error.response ? error.response.status : 502).json({
            status: 'error',
            message: 'Failed to initiate transaction on Squad',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Port configuration & Server Launch
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`@BL Sovereign Rail Master Template LIVE on port ${PORT}`));
