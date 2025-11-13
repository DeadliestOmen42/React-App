# Stripe / Billing Placeholder

This file explains where to integrate Stripe:

1. Create a Stripe account and products/prices.
2. Implement `POST /api/create-checkout` to call Stripe's Checkout Sessions API.
3. Use webhooks to grant subscription entitlements / add credits to user accounts.

This project contains a frontend mock purchase flow. Replace with your server-side implementation.
