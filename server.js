const express = require('express');
const app = express();
app.use(express.json());

// The Sovereign Gatekeeper (Secret Hash from your Flutterwave Settings)
const SECRET_HASH = process.env.FLW_SECRET_HASH;

app.post('/webhook', (req, res) => {
    const signature = req.headers['verif-hash'];
    
    // 1. Clinical Security Check
    if (!signature || (signature !== SECRET_HASH)) {
        console.log("@BL Alert: Unauthorized Webhook Attempt Blocked.");
        return res.status(401).end();
    }

    const payload = req.body;
    
    // 2. Sovereign Logic: Apply your specialized rules here
    console.log(`@BL Sovereign: Processing Trade Ref: ${payload.tx_ref}`);
    
    if (payload.status === 'successful') {
        // Here is where you can add logic to update a Google Sheet or database
        console.log(`CONFIRMED: ${payload.amount} ${payload.currency} received from ${payload.customer.email}`);
    }

    res.status(200).end();
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`@BL Rail is LIVE on port ${PORT}`));
