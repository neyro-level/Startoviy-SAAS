# АМС Старт — public surface detail

**Status:** Active extension. [06_DESIGN_SYSTEM.md](06_DESIGN_SYSTEM.md) owns
cross-surface tokens, primitive reuse, typography and acceptance targets.
This extension owns only public composition detail; CSS owns actual values.

## VERIFIED composition

`StartLanding` scopes theme-public/start-landing: header wordmark and login →
neutral hero copy/CTA → decorative data visual → footer legal/demo contacts.
`LegalDocument` provides public header, legal heading/version/date, content
and footer. Offline/404 reuse this vocabulary without private payloads.
Public typography is Manrope with fallback from globals.css; scoped public
roles are used by MarketingButton/login/legal compositions. Generic UI
primitives stay independent of those roles.

## Content and states

[02](02_PRODUCT_STRUCTURE.md) owns the exact PAGE/H1/CTA order; PRD owns facts.
Contact delivery stays disabled until a derived product configures a verified
receiver; demo contacts/legal placeholders are not a real offer/operator.
Login has pending/error states; complete setup/TOTP/recovery surfaces are
TARGET and must preserve Base UI keyboard/focus/label behavior.

## REQUIRES CHECK

Apply06 viewport/state matrix to landing, legal, dialogs, footer,404 and offline:
long copy, overflow, focus, contrast and reduced motion. Static conformance
alone never means this visual review passed. A derived product changes identity,
content and actual fact inputs without importing a donor brand or extra UI kit.
