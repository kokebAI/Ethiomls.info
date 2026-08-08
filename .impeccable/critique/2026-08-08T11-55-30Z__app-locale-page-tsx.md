---
target: public home / hero + search funnel
total_score: 19
max_score: 32
na_heuristics: 7,10
p0_count: 1
p1_count: 2
timestamp: 2026-08-08T11-55-30Z
slug: app-locale-page-tsx
---
Method: dual-agent (A: 8e873887-9a7d-4714-803d-28aaeb70ee01 · B: dd2b3413-efe7-483a-b70b-8e8a68530c12)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Live stats animate to 0; weak submit progress |
| 2 | Match System / Real World | 3 | Intent + Amharic + clusters native; Latin sub-city slugs leak |
| 3 | User Control and Freedom | 3 | Easy to edit funnel; weak empty-result recovery |
| 4 | Consistency and Standards | 2 | Nested cards; H2 before H1; EN/AM promise split |
| 5 | Error Prevention | 2 | Empty budget blocked; verified claim vs zero inventory |
| 6 | Recognition Rather Than Recall | 3 | Single-panel funnel keeps state visible |
| 7 | Flexibility and Efficiency | n/a | Persuade home |
| 8 | Aesthetic and Minimalist Design | 2 | Hierarchy noise; empty hybrid elevation |
| 9 | Error Recovery | 2 | Weak empty-catalog guidance |
| 10 | Help and Documentation | n/a | Persuade home |
| **Total** | | **19/32** | Thin craft, trust risk |

## Design Specificity Verdict

**LLM assessment:** **co-opted.** Amharic-first copy, Addis corridors, and NBE FX are product-true, but composition is a white SaaS search card + delayed brand H1 + empty metric tiles. Verified Gateway seals and marketplace presence are barely embodied.

**Deterministic scan:** CLI detect on `app/[locale]/page.tsx` and `conversational-funnel.tsx` returned **0** static findings. Browser inject on `https://ethiomls.info/am` surfaced ~11 runtime findings. Agree with Assessment A on hierarchy/nesting; detector adds real **low-contrast** (gold/white ~3.2:1) and **skipped-heading**. Treat kickers/eyebrow/illustration rules as noisy FP candidates; keep low-contrast + skipped-heading.

**Visual overlays:** Injection succeeded via live-server `:8400`. Overlays were active in the browser session during Assessment B; no guarantee they remain after server stop.

## Overall Impression

Right primary job (guided search) in the wrong order for a trust marketplace: form and motto lead, brand and verified inventory trail, then counters at zero. Biggest opportunity: restage the first viewport as a Verified Gateway into real (or honestly absent) inventory—not an empty ops form.

## What's Working

1. **Product-true funnel skeleton** — intent × Addis cluster × budget + FX is the correct MLS job.
2. **Slate + gold motto band** — closest live expression of Verified Gateway materials.
3. **Gold primary CTA** — strongest action affordance on the page.

## Priority Issues

### [P0] Live market counters read as zero under “verified” language
- **Why:** Social-proofs emptiness; collapses diaspora/investor trust before browse.
- **Fix:** Hide zero stats; show live inventory teaser or honest empty state without fake scale.
- **Suggested command:** `/impeccable clarify` (copy/state) + `/impeccable layout` (proof plane)

### [P1] Inverted hierarchy — funnel H2 / form before brand H1 and trust proof
- **Why:** First inch feels like a utility widget, not EthioMLS.
- **Fix:** Brand-first hero; one promise; seals; then search. Align heading order (no h1→h3 skip).
- **Suggested command:** `/impeccable layout` + `/impeccable typeset`

### [P1] No marketplace / verification presence above the fold
- **Why:** DESIGN.md Verified Gateway + guest teaser not staged; homepage could be any search SaaS.
- **Fix:** Teaser listings or verified badges; reduce decorative skyline as sole visual.
- **Suggested command:** `/impeccable bolder` or `/impeccable shape` for home surface

### [P2] PWA install toast competes with (can obscure) primary CTA on mobile
- **Why:** Interrupts first decision; detector also flags toast chrome (`gpt-thin-border-wide-shadow`).
- **Fix:** Defer install prompt until after first search/scroll; never cover submit.
- **Suggested command:** `/impeccable quieter` + `/impeccable adapt`

### [P2] Gold/white contrast ~3.2:1 on kickers and CTA text
- **Why:** Detector low-contrast warnings; hurts readability and a11y.
- **Fix:** Darken gold text on white, or use slate text with gold accents; ensure CTA text meets 4.5:1.
- **Suggested command:** `/impeccable colorize` + `/impeccable audit`

## Persona Red Flags

**Diaspora buyer:** ETB-default FX; escrow/verified seals unstaged; zeros contradict confidence; EN metadata sells trust the UI doesn’t show.

**Local Amharic buyer:** Must complete guided form before browse; no “just show homes”; Latinized sub-city slugs break immersion.

**Broker / delala:** Buyer funnel dominates; list-property path is quiet secondary; no broker value on home.

## Minor Observations

- Count-up animation to **0** is worse than omitting stats.
- Nested card shell (home-client + funnel) matches detector `nested-cards`.
- Locale chip ~10.4px (`አማ`) undersized; compact but fails floor.
- EN vs AM brand promise diverge.
- Off-plan % field is good progressive disclosure but invisible to most.

## Questions to Consider

1. If production inventory is thin, should home **hide counters** rather than advertise zero?
2. Is this page a **search tool** or a **trust gateway**—and if the latter, why does the first inch open with a form?
3. Should diaspora land **USD-first** with seal proof before budget arithmetic?
