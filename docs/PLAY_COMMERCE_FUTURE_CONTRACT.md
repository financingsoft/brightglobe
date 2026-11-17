# Globe Play — Commerce & Monetization Extension Contract

**Status:** Architecture reservation only · Not enabled in V1

## 1. Future scope

Reserve clean extension points for sponsored discovery, developer promotion tools, paid apps, subscriptions, in-app purchase discovery links, developer services, invoicing, tax, refunds, chargebacks and revenue settlement. This document does not authorize payments or token rewards.

## 2. Separation of concerns

Commerce must be a separate bounded context with its own legal terms, provider integration, ledger, reconciliation and finance permissions. Marketplace catalogue and ranking must not directly mutate payment state. Do not build a home-grown payment processor.

## 3. Sponsored placements

Sponsored inventory must be clearly labeled, have campaign owner, creative approval, targeting limits, budget, schedule, impression/click reporting and fraud controls. Sponsored content cannot purchase organic ratings or conceal its commercial nature.

## 4. Paid distribution

Before paid apps or subscriptions, decide seller-of-record, payment provider, refund policy, tax/VAT/GST, sanctions, consumer rights, chargebacks, regional availability and platform-specific restrictions. Do not assume a web checkout can unlock digital goods inside native iOS/Android apps without platform policy review.

## 5. Developer settlement

Future settlement requires verified legal entity, beneficial-owner checks where applicable, payout provider, tax forms, currency/minimum thresholds, reconciliation, reserve/hold policy, refund/chargeback handling and dual approval. No payout details or finance workflow are required in V1.

## 6. Rewards boundary

BG rewards remain in the BrightGlobe reward engine and are not a payment substitute. Any future reward integration uses versioned, idempotent events and separate compliance approval. Marketplace must never maintain its own token balance or write directly to reward ledgers.
