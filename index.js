const subaccount_id = "RS_8696E144DE45A2F10B7CCD94F043C51D"; // Aileru ID

// This function generates the payment link for Aileru
function generateAileruLink(amount, email, name) {
    const payload = {
        tx_ref: "BL-AILERU-" + Date.now(),
        amount: amount,
        currency: "NGN",
        payment_options: "card, banktransfer, ussd",
        subaccounts: [{ id: subaccount_id }],
        customer: { email: email, name: name },
        customizations: {
            title: "@BL Sovereign: Real Schools",
            description: "Tuition & Fees Collection",
            logo: "https://your-logo-url.png"
        }
    };
    return payload;
}
