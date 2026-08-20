---
target: Landing page (/)
total_score: 20
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 3
timestamp: 2026-08-20T11-06-56Z
slug: src-pages-landing-tsx
---
Method: dual-agent (A: design-review · B: detector+evidence)

Target: src/pages/Landing.tsx
Mode: Persuade
Date: 2026-08-20

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3/4 | Form spinner + success state. No loading signal for heavy SVG mockups. |
| 2 | Match System / Real World | 3/4 | Draft -> Publish uses code-style arrow. One benefit written from operator POV. |
| 3 | User Control and Freedom | 3/4 | Post-submit "Send another" label jarring. Low stakes on landing page. |
| 4 | Consistency and Standards | 2/4 | Font system broken at three layers. Two-tier feature hierarchy unintentional. |
| 5 | Error Prevention | 2/4 | Zod fires on submit only, toast only. No inline errors. No placeholders on name/email. |
| 6 | Recognition Rather Than Recall | 3/4 | nav is hidden md:flex with no mobile replacement. Zero navigational recognition on mobile. |
| 7 | Flexibility and Efficiency of Use | n/a | Not applicable to marketing landing page. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Logo appears 3x. Hero logo 192px tall. Amber accent unused entire page. 8 benefit bullets. |
| 9 | Error Recovery | 2/4 | Toast-only error recovery, no inline field errors. |
| 10 | Help and Documentation | n/a | Not applicable. FAQ handles it. |
| Total | | 20/32 | Functional but below the standard the product deserves |

## Design Specificity

Partially authored, not fully inhabited. Feature copy is product-specific but layout is SaaS-template skeleton. Amber accent absent. No social proof. Neutral-professional register instead of warm-community.

## Detector Findings

Landing.tsx: exit code 0 (clean)
index.css: 1 finding - overused-font (Inter import, line 2, valid)

## Priority Issues

[P0] Zero social proof - no testimonials, no church names, no user count
[P0] No mobile navigation - nav hidden md:flex with no hamburger replacement
[P1] Duplicate hero logo ~20% of above-fold viewport
[P1] text-muted-foreground contrast ~3.5:1, fails WCAG 2.1 AA for normal text
[P1] Amber accent entirely absent - palette monochromatic sage green
[P2] Font system broken in three layers (tailwind.config, index.css, PRODUCT.md disagree)
[P2] Security features buried in And much more secondary tier

## Persona Red Flags

Church Coordinator: No pricing signal. Invite-only framed as restriction not trust signal. Benefit #8 is operator language. Dual hero CTAs dilute conversion. Transactional success message.
Curious Volunteer: Page written for coordinators not volunteers. No privacy statement near form. Form asks for org name confusing volunteers who think they are registering.
