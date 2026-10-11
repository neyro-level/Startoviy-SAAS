# АМС Старт — private surface detail

**Status:** Active extension. [06_DESIGN_SYSTEM.md](06_DESIGN_SYSTEM.md) owns
cross-surface design and acceptance; this file owns private composition detail.

## VERIFIED composition

`PrivateApplicationLayout` derives principal/nav/notification summary on the
server and passes DTOs into AppShell. Private surface uses theme-app and the
root semantic roles in globals.css: sidebar → PageHeader → cards/content.
Admin uses shared filters/table/pagination/forms; mobileRenderer creates cards
rather than a second table system. Notifications uses filters/feed/pagination.
Actual routes/access and required noindex/no-store policy belong to [02](02_PRODUCT_STRUCTURE.md).

## Shared interaction boundary

Reuse existing Button, Field/Input, NativeSelect, Checkbox, Dialog/Sheet,
loading/empty/error/status components. Pending actions protect duplicate submit;
server permission and scoped command checks remain mandatory. A hidden UI
control is not access enforcement. Forms, names and errors use safe DTOs;
unknown data is not fabricated as a KPI. No provider-specific vocabulary,
raw brand colors or second theme owner belongs in the reusable shell.

## REQUIRES CHECK

Use06 matrix for drawer/collapse, long project/user names, mobile cards,
empty/filter/error/loading states, destructive confirmation, keyboard/labels,
contrast and post-logout cache isolation. Complete organization/project
switcher and account/MFA surfaces remain TARGET until implemented and tested.
Dashboard demo «Готово» is not delivery/release evidence.
