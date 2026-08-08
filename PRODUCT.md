# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Equal marketplace for Addis Ababa property: **buyer/renter clients**, **property owners**, **independent brokers (delala)**, and **corporate developers**, plus staff roles (**office assistant**, **admin**) that operate verification and publish workflows. Primary product job is matching verified residential and commercial inventory (sale, rent, off-plan) to people who need it—especially where trust and foreign-buyer friction matter—while giving listing-side roles tools to manage inventory and get audited live.

## Product Purpose

EthioMLS (ethiomls.info) is an Ethiopian Multiple Listing Service centered on Addis Ababa: homes and commercial space for buy, rent, and off-plan. Success means participants can discover or publish **verified** inventory with confidence—not another unverified classifieds feed.

## Positioning

**Verified listings plus escrow / foreign-buyer clearance trust.** Neighboring portals can list inventory; EthioMLS’s durable claim is trust machinery around verification and clearance (including proclamation-framed compliance UX), not listing volume alone.

## Operating Context

- Geography is Addis Ababa with **sub-city** location codes (not free-text areas).
- Money surfaces use **ETB and USD**, with NBE rate awareness in search/budget.
- Terminology: **delala** = broker; MLS IDs on properties; **escrow milestones** and **foreign clearance** are first-class domain concepts.
- Profession roles land in role hubs after login; only the client role keeps the public catalog as the default post-login home.
- Sister ops: bridges toward **AGT CRM** for lead/assistant flows; SMS (**HaHu**), optional **Fayda** for developers, payment enums (**Telebirr / CBE Birr**).

## Capabilities and Constraints

- Guided search → filtered listings (intent, sub-city, budget); listing create/manage; projects and developer workspaces; admin audit/scrape/import/ops hubs.
- Guest users see a **teaser** of listing value; price band details, contact, and fuller media unlock after signed-in access (confirmed product rule).
- Auth is **Ethiopia phone-first** (+251 9/7), with email / Google paths for diaspora-friendly signup (confirmed).
- Locales: **`am` default**, plus `en`, `om`, `ti`, with Ethiopic script support required (confirmed). Platform is installable **PWA** (web), not a native store app.
- Undecided / do not invent: whether escrow and clearance are fully live ops vs messaging; paid subscription launch state; hard WCAG target; whether the existing BrandMark (deep slate + amber gold) is a permanent brand lock beyond current code.

## Brand Commitments

- Name: **EthioMLS** (public framing “EthioMLS Real Estate” in PWA copy).
- Voice today: clear, compliance-aware, diaspora- and investor-capable; bilingual marketing urgency in English SEO alongside shorter local taglines.
- Assets in repo: inline `BrandMark` SVG, PWA icons under `public/icons/`, fonts Manrope + Noto Sans Ethiopic. BrandMark permanence was **not** locked in init—treat as incumbent UI evidence until explicitly committed.

## Evidence on Hand

- Product copy and compliance strings in `locales/*/common.json`.
- Role hubs, catalog gating, schema, seeds, and ops docs (e.g. NBE rate instruction).
- No separate brand book, testimonials pack, or partner-logo kit in-repo—future work must not fabricate social proof.

## Product Principles

1. **Trust before volume** — verified + clearance framing outranks listing count aesthetics.
2. **Marketplace fairness** — buyer, owner, broker, and developer jobs are all first-class; do not collapse the product to a single consumer funnel.
3. **Language is product** — Amharic-default with real Ethiopic support is non-negotiable.
4. **Respect the gate** — guest tease vs signed-in unlock is intentional information architecture.
5. **Phone-native Ethiopia** — local phone identity stays primary; diaspora paths are adapters, not replacements.

## Accessibility & Inclusion

No hard WCAG target was set in init. Ethiopic script support and four-locale coverage are product requirements; pinch/zoom and motion preferences are implementation concerns, not yet formalized as product standards.
