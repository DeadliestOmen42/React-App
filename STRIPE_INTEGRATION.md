# Stripe / Billing Integration Guide

This guide covers integrating Stripe for subscriptions and one-time purchases into your AI Music Studio app.

## Setup

### 1. Create Stripe Account
- Go to https://stripe.com and create a new account.
- Get your API keys from Dashboard > API Keys.
- Store keys in `.env`:
  ```
  STRIPE_SECRET_KEY=sk_live_...
  STRIPE_PUBLISHABLE_KEY=pk_live_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  ```

### 2. Install Stripe SDK
```bash
npm install stripe
```

### 3. Create Products and Prices
In Stripe Dashboard, create products:
- **Starter**: 100 credits/month ($9.99) → `price_starter`
- **Pro**: 500 credits/month ($29.99) → `price_pro`
- **Enterprise**: Custom pricing

Copy price IDs and add to `.env`.

## Server Implementation

### Checkout Session Endpoint

Add to `server/index.cjs`:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/create-checkout', async (req, res) => {
  try {
    const { priceId, userId } = req.body;
    if (!priceId || !userId) {
      return res.status(400).json({ error: 'priceId and userId required' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      client_reference_id: userId,
      metadata: { userId },
    });

    res.json({ sessionId: session.id });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});
```

### Webhook Handler

Handle Stripe events (no JSON body parsing needed for signature verification):

```javascript
const express = require('express');

app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.sendStatus(400);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;
        
        // Update database: grant subscription, add credits
        console.log('Subscription created for user:', userId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('Subscription updated:', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('Subscription cancelled:', subscription.id);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log('Payment succeeded:', invoice.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log('Payment failed:', invoice.id);
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
```

### Subscription Status Endpoint

```javascript
app.get('/api/subscription/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Query your database for user subscription info
    // Example: SELECT * FROM subscriptions WHERE user_id = userId
    
    res.json({
      userId,
      status: 'active',
      plan: 'Pro',
      creditsRemaining: 450,
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err) {
    console.error('Error fetching subscription:', err);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});
```

## Frontend Implementation

### Call Checkout Endpoint

```javascript
import { loadStripe } from '@stripe/js';

async function handleUpgrade(priceId) {
  try {
    const res = await fetch('http://localhost:3000/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priceId,
        userId: 'user_123', // from your auth system
      }),
    });

    const { sessionId } = await res.json();
    const stripe = await loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
    await stripe.redirectToCheckout({ sessionId });
  } catch (err) {
    console.error('Checkout error:', err);
  }
}
```

## Environment Variables

### `.env`
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:3000
```

### `.env.example`
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:3000
```

## Webhook Setup

1. Stripe Dashboard → **Developers > Webhooks** → **Add endpoint**
2. URL: `https://your-app.com/api/stripe-webhook`
3. Events to receive:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy signing secret → add to `.env` as `STRIPE_WEBHOOK_SECRET`

## Local Testing

### Test Cards
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- Any future expiry, any CVC

### Test Webhooks Locally
```bash
npm install -g stripe
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

## Database Schema Example

Store subscription data per user:

```sql
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan VARCHAR(50),
  status VARCHAR(50),
  credits INT DEFAULT 0,
  renewal_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE credit_usage (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  credits_used INT,
  action VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## References

- [Stripe Checkout Docs](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Node.js SDK](https://github.com/stripe/stripe-node)
- [Stripe Testing](https://stripe.com/docs/testing)
