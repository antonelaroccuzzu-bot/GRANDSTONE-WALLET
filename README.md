# GRANDSTONE WALLET

A secure, AI-assisted financial platform for digital assets and supported fiat currencies.

## Product direction

- Account and portfolio dashboard
- Wallet architecture with protected signing and recovery
- Market data, charts, and order management
- Exchange integrations for live trading, enabled only after provider setup and security review
- AI assistant, portfolio insights, scam-risk checks, and Trade Guardian warnings
- User-defined limits, audit trails, and explicit order confirmation

## Security principles

- Never commit API keys, passwords, seed phrases, or private keys.
- Keep server secrets in the deployment platform's environment-variable settings.
- Never expose wallet recovery phrases or raw private keys to the server or admin dashboard.
- Restrict exchange API keys to the minimum permissions required; disable withdrawals.
- AI risk warnings do not override hard security, compliance, or account limits.
- Live trading must be disabled until authentication, authorization, risk limits, and order handling have been tested.

## Build status

Initial project foundation. Provider integrations and live trading are not configured yet.
