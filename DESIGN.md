---
name: EthioMLS
description: Verified Addis Ababa MLS — imperial gold on deep slate, marketplace-dense trust catalog
colors:
  brand-50: "#fffbeb"
  brand-100: "#fef3c7"
  brand-200: "#fde68a"
  brand-500: "#d97706"
  brand-600: "#d97706"
  brand-700: "#b45309"
  brand-800: "#92400e"
  accent-gold: "#d97706"
  slate-deep: "#0f172a"
  slate-obsidian: "#1e293b"
  surface: "#ffffff"
  surface-muted: "#f8fafc"
  ink: "#334155"
  ink-muted: "#64748b"
  border: "#e2e8f0"
  semantic-success: "#059669"
  semantic-danger: "#dc2626"
typography:
  display:
    fontFamily: "Manrope, Noto Sans Ethiopic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  headline:
    fontFamily: "Manrope, Noto Sans Ethiopic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "Manrope, Noto Sans Ethiopic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontFamily: "Manrope, Noto Sans Ethiopic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, Noto Sans Ethiopic, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  lg: "0.5rem"
  xl: "0.75rem"
  card: "1rem"
  "2xl": "1rem"
  full: "9999px"
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.25rem"
  xl: "1.5rem"
  "2xl": "2rem"
components:
  button-primary:
    backgroundColor: "{colors.brand-600}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "0.625rem 1.25rem"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.brand-700}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "{colors.slate-deep}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "0.75rem 1.25rem"
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0.5rem 1rem"
  chip-filter:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0.5rem 1rem"
  chip-verified:
    backgroundColor: "{colors.accent-gold}"
    textColor: "{colors.surface}"
    rounded: "{rounded.full}"
    padding: "0.25rem 0.625rem"
  card-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "1.25rem"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.slate-deep}"
    rounded: "{rounded.xl}"
    padding: "0.75rem 1rem"
---

# Design System: EthioMLS

## Overview

**Creative North Star: "The Verified Gateway"**

EthioMLS looks like a secured entrance into Addis inventory: a deep-slate civic frame, a warm imperial-gold trust signal, and a marketplace-dense catalog beyond the gate. The product sells confidence (verified listings, escrow/clearance framing), so the UI reads as authoritative without becoming a dark dashboard—paper-light canvases carry most screens; slate and gold mark brand chrome and verification moments.

Density favors scan-and-act property work: compact pills, tight filter clusters, listing cards that pack specs before flourish. Motion stays short and purposeful (`rise-in` ~420ms ease)—presence, not decoration.

**Key Characteristics:**
- Imperial gold on deep slate as the brand spine
- Marketplace-dense controls and listing density
- Hybrid depth: soft card lift on catalogs; flatter marketing canvases
- Ethiopic-capable type stack (Manrope + Noto Sans Ethiopic)
- VERIFIED / trust seals as first-class visual language, not afterthought badges

## Colors

A single warm accent (imperial gold) on a cool slate authority field, with white/muted paper surfaces for reading density.

### Primary
- **Imperial Gold** (`#d97706`): CTAs, verified seals, BrandMark plinth/door accents, focus rings. Rarity still matters—gold should mark action and trust, not flood backgrounds.

### Neutral
- **Deep Slate** (`#0f172a`): Header chrome, BrandMark tile, secondary solid buttons, high-authority panels.
- **Obsidian Slate** (`#1e293b`): Secondary dark surface / tonal step off deep slate.
- **Surface White** (`#ffffff`): Cards, inputs, elevated panels.
- **Muted Paper** (`#f8fafc`): Page wash; pairs with faint gold/slate radial gradients in `body` background.
- **Ink** (`#334155`) / **Ink Muted** (`#64748b`): Body and secondary text.
- **Border Mist** (`#e2e8f0`): Default strokes on cards and fields.

### Named Rules
**The Gateway Seal Rule.** Gold marks verification and primary action. If a screen uses gold as large fill decoration unrelated to trust or CTA, it has left the Gateway.

**The Paper Beyond the Gate Rule.** Catalog and form work live on light surfaces; deep slate is the gate frame, not the default page fill.

## Typography

**Display Font:** Manrope (with `ui-sans-serif`, `system-ui`)
**Body Font:** Manrope
**Ethiopic Font:** Noto Sans Ethiopic (always available beside Latin)

**Character:** Confident geometric sans for Latin; Ethiopic must never fall back to a Latin-only face. Hierarchy is weight- and size-led, not ornamental display faces.

### Hierarchy
- **Display** (700, clamp ~1.75–2.5rem): Hero and major hub titles.
- **Headline** (700, ~1.25rem): Section and card titles (listing names, panel headers).
- **Title** (600, ~1rem): Subheads, row titles.
- **Body** (400, ~0.875rem): Descriptions, helper copy; keep lines scannable in dense UIs.
- **Label** (600, ~0.75rem): Buttons, chips, metadata, status.

### Named Rules
**The Dual-Script Rule.** Any text surface that can render Amharic (or other Ethiopic locales) must include Noto Sans Ethiopic in the stack—never Manrope alone.

## Layout

Marketplace-first spatial model: content maxes for scan width on large screens, with stacked mobile funnels. Search and role hubs use tight grids (`gap-3`–`gap-5`), rounded-2xl filter shells, and full-width CTAs on small viewports. Listing results prefer information density over large media galleries in chrome; media remains present but does not inflate card chrome.

**The Dense Catalog Rule.** Prefer compact pills and multi-field filter rows over sparse marketing whitespace on browse/search surfaces.

## Elevation & Depth

Hybrid: marketing and page canvases stay mostly flat (tonal gradients on `body`); listing cards, search shells, and admin panels use soft ambient slate shadows (`--shadow-card`, stronger `--shadow-card-hover` on interactive lift).

### Shadow Vocabulary
- **Card rest** (`0 1px 3px rgb(15 23 42 / 0.06), 0 8px 24px rgb(15 23 42 / 0.06)`): Default elevated surfaces.
- **Card hover** (`0 4px 12px rgb(15 23 42 / 0.08), 0 16px 40px rgb(15 23 42 / 0.1)`): Interactive catalog cards.

### Named Rules
**The Flat Canvas / Lifted Card Rule.** Page backgrounds do not cast shadows; discrete cards and filter shells do.

## Shapes

Fully rounded pills for actions and filters (`rounded-full`); gently curved cards (`--radius-card: 1rem` / `rounded-2xl`); fields often `rounded-xl`. BrandMark uses a 10px-rounded slate tile—geometric, not skeuomorphic.

**The Pill Action Rule.** Primary and secondary CTAs and filter chips share pill geometry so action language stays consistent across hubs.

## Components

### Buttons
- **Shape:** Pill (`rounded-full`)
- **Primary:** Imperial gold fill (`brand-600`), white label, semibold; hover `brand-700`
- **Secondary / Authority:** Deep slate / near-black fill (`slate-deep` or `slate-950`), white label—used for ops/admin emphasis without spending gold
- **Ghost / Outline:** White or transparent with `border-slate-200`, ink text
- **Focus:** Brand border + soft gold ring (`focus:ring-brand-500/20` or `brand-100`)

### Chips
- **Filter chips:** Pill, muted or white fill; selected state shifts to slate or gold depending on funnel context
- **Verified seals:** Gold (or gold-on-slate) compact pills / badges—signature of the Gateway

### Cards / Containers
- **Corner Style:** ~1rem (`rounded-2xl` / `--radius-card`)
- **Background:** White / white-90 with optional `border-slate-200/90`
- **Shadow Strategy:** `--shadow-card` at rest
- **Internal Padding:** ~1–1.5rem (`p-4`–`p-6`), denser in admin (`p-3`–`p-4`)

### Inputs / Fields
- **Style:** White fill, `border-slate-200`, `rounded-xl`, comfortable padding
- **Focus:** Brand border + light gold ring
- **Character:** Marketplace-clear; large numeric budget fields may bold up (`text-xl font-bold`)

### Navigation
- Deep slate or paper header with BrandMark + wordmark; locale controls stay visible (Amharic default is product truth)
- Role hubs prioritize task chrome over marketing nav weight

### BrandMark (signature)
- Deep slate rounded square, pale house glyph, imperial gold plinth and door—treat as the durable identity tile until PRODUCT.md locks permanence

## Do's and Don'ts

### Do:
- **Do** use Imperial Gold for primary CTAs and verification seals.
- **Do** keep listing/search UI marketplace-dense with pill filters.
- **Do** load Manrope + Noto Sans Ethiopic together on every user-facing surface.
- **Do** lift cards with `--shadow-card`; keep page washes flat.
- **Do** preserve guest-teaser vs signed-in unlock as IA (visual tease is allowed; fabricating unlocked data is not).

### Don't:
- **Don't** flood screens with gold panels or purple/indigo SaaS gradients.
- **Don't** replace the type stack with Inter/Roboto/Arial as the brand voice.
- **Don't** nest card-in-card decoration that adds chrome without new information.
- **Don't** use elastic/bounce motion—keep `ease` rise-ins short.
- **Don't** invent testimonials, partner logos, or proof seals that are not in the product evidence set.
