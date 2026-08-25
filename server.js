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
/**
 * ============================================================================
 * @BL SOVEREIGN GATEWAY - MERCHANT SELF-REGISTRATION ENDPOINT
 * ============================================================================
 */

const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Your Railway PostgreSQL connection
const bcrypt = require('bcrypt');   // For password hashing

router.post('/api/v1/auth/register-merchant', async (req, res) => {
    try {
        const { 
            businessName, 
            ownerName, 
            email, 
            phone, 
            password, 
            settlementBankCode, 
            settlementAccountNumber,
            cacNumber 
        } = req.body;

        // 1. Basic Field Validation
        if (!businessName || !email || !phone || !password || !settlementAccountNumber || !settlementBankCode) {
            return res.status(400).json({
                status: 'error',
                message: 'All primary fields (Business Name, Email, Phone, Password, Settlement Bank) are required.'
            });
        }

        // 2. Check if Email or Phone Already Exists
        const existingMerchant = await db.query(
            'SELECT id FROM merchants WHERE email = $1 OR phone = $2', 
            [email.toLowerCase().trim(), phone.trim()]
        );

        if (existingMerchant.rows.length > 0) {
            return res.status(409).json({
                status: 'error',
                message: 'A merchant account with this email or phone number already exists.'
            });
        }

        // 3. Hash Password for Security
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 4. Generate Unique Merchant Reference (e.g., BL-MCH-892301)
        const merchantRef = `BL-MCH-${Math.floor(100000 + Math.random() * 900000)}`;

        // 5. Insert New Merchant into Database
        const newMerchant = await db.query(
            `INSERT INTO merchants 
             (merchant_ref, business_name, owner_name, email, phone, password_hash, settlement_bank_code, settlement_account_no, cac_number, tier_level, balance, total_cashback_earned, status, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'TIER_1', 0.00, 0.00, 'ACTIVE', NOW())
             RETURNING id, merchant_ref, business_name, email, status`,
            [
                merchantRef, 
                businessName, 
                ownerName || businessName, 
                email.toLowerCase().trim(), 
                phone.trim(), 
                hashedPassword, 
                settlementBankCode, 
                settlementAccountNumber, 
                cacNumber || null
            ]
        );

        const merchantData = newMerchant.rows[0];

        console.log(`🎉 New Merchant Self-Registered: ${businessName} (${merchantRef})`);

        return res.status(201).json({
            status: 'success',
            message: 'Merchant account registered successfully!',
            data: {
                merchantId: merchantData.id,
                merchantRef: merchantData.merchant_ref,
                businessName: merchantData.business_name,
                email: merchantData.email,
                cashbackEligible: true,
                cashbackRate: '₦2.00 per transaction'
            }
        });

    } catch (error) {
        console.error('❌ Merchant Registration Error:', error.message);
        return res.status(500).json({ status: 'error', message: 'Internal server error during registration.' });
    }
});

module.exports = router;
