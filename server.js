const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Environment Variables from Railway
const SECRET_HASH = process.env.FLW_SECRET_HASH;
const SQUAD_SECRET_KEY = process.env.SQUAD_SECRET_KEY;
const SQUAD_BASE_URL = 'https://api.squadco.com';

// ==========================================
// 💡 @BL SOVEREIGN TIERED MARKUP ENGINE
// ==========================================
function calculateConvenienceFee(baseAmount) {
    let markup = 0;

    if (baseAmount <= 20000) {
        markup = 20; // ₦20 for transactions up to ₦20,000
    } else if (baseAmount <= 50000) {
        markup = 25; // ₦25 for transactions between ₦20,001 and ₦50,000
    } else {
        markup = 30; // ₦30 for transactions above ₦50,000
    }

    const totalAmount = baseAmount + markup;
    const totalAmountInKobo = Math.round(totalAmount * 100); // Squad expects amount in Kobo

    return {
        baseAmount,
        markup,
        totalAmount,
        totalAmountInKobo
    };
}

// ==========================================
// 1. FLUTTERWAVE WEBHOOK ENDPOINT
// ==========================================
app.post('/webhook', (req, res) => {
    const signature = req.headers['verif-hash'];
    
    if (!signature || (signature !== SECRET_HASH)) {
        console.log("@BL Alert: Unauthorized Webhook Attempt Blocked.");
        return res.status(401).end();
    }

    const payload = req.body;
    console.log(`@BL Sovereign: Processing Trade Ref: ${payload.tx_ref}`);
    
    if (payload.status === 'successful') {
        console.log(`CONFIRMED: ${payload.amount} ${payload.currency} received from ${payload.customer.email}`);
    }

    res.status(200).end();
});

// ==========================================
// 2. SQUAD SUB-MERCHANT REGISTRATION ENDPOINT
// ==========================================
app.post('/api/v1/register-merchant', async (req, res) => {
    try {
        const { displayName, accountName, email } = req.body;

        if (!displayName || !accountName || !email) {
            return res.status(400).json({ status: 'error', message: 'Missing parameters' });
        }

        console.log(`@BL Gateway: Onboarding merchant - ${displayName}`);

        const response = await axios.post(`${SQUAD_BASE_URL}/merchant/create-sub-account`, {
            display_name: displayName,
            account_name: accountName,
            email: email
        }, {
            headers: {
                'Authorization': `Bearer ${SQUAD_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return res.status(200).json(response.data);

    } catch (error) {
        console.error("@BL Error:", error.response ? error.response.data : error.message);
        return res.status(502).json({
            status: 'error',
            message: 'Failed to communicate with Squad engine',
            details: error.response ? error.response.data : error.message
        });
    }
});

// ==========================================
// 3. TRANSACTION CHARGE ENDPOINT (WITH MARKUP)
// ==========================================
app.post('/api/v1/initiate-payment', async (req, res) => {
    try {
        const { email, amount, subAccountId, transactionRef } = req.body;

        if (!email || !amount || !subAccountId) {
            return res.status(400).json({ status: 'error', message: 'Missing payment details' });
        }

        // Apply Tiered Fee Markup Logic
        const feeCalculation = calculateConvenienceFee(Number(amount));

        console.log(`@BL Fee Calculation: Base=₦${feeCalculation.baseAmount}, Markup=₦${feeCalculation.markup}, Final=₦${feeCalculation.totalAmount}`);

        // Hit Squad Payment Initiation Endpoint
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
                'Authorization': `Bearer ${SQUAD_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return res.status(200).json({
            status: 'success',
            markup_applied: `₦${feeCalculation.markup}`,
            breakdown: feeCalculation,
            squad_response: response.data
        });

    } catch (error) {
        console.error("@BL Payment Error:", error.response ? error.response.data : error.message);
        return res.status(502).json({
            status: 'error',
            message: 'Failed to initiate transaction on Squad',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Port configuration
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`@BL Rail with Tiered Markup Engine is LIVE on port ${PORT}`));
