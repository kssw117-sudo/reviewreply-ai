// api/create-payment.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const npResponse = await fetch('https://api.nowpayments.io/v1/invoice', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.NOWPAYMENTS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        price_amount: 39,
        price_currency: 'usd',
        order_description: 'ReviewReply AI — lifetime access',
        success_url: `${process.env.PUBLIC_URL}/thanks.html`,
        cancel_url: `${process.env.PUBLIC_URL}/buy.html`
      })
    });

    const npData = await npResponse.json();

    if (!npData.invoice_url) {
      return res.status(500).json({ error: npData.message || 'Payment creation failed' });
    }

    return res.status(200).json({ paymentUrl: npData.invoice_url });
  } catch (err) {
    return res.status(500).json({ error: 'Network error: ' + err.message });
  }
}
