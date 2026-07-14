# Wayfinder (local markdown tracker)

Map: [MAP.md](./MAP.md)

## Frontier (open, unblocked, unclaimed)

_None — map complete for planning. Implementation follows the locked spec._

## Closed

| Ticket | Gist |
|---|---|
| [T01](./tickets/T01-destination-mode.md) | A+C: decision-locked written spec; no build in map |
| [T02](./tickets/T02-demo-surface.md) | `tasteroll.html` only |
| [T03](./tickets/T03-roll-scope.md) | A+B visual + layout; not copy/identity |
| [T04](./tickets/T04-click-and-lock.md) | Full re-roll + locks; shuffle + shareable id |
| [T05](./tickets/T05-control-chrome.md) | Fixed header strip outside the roll |
| [T06](./tickets/T06-quality-floor.md) | Always-on rails + banlist + a11y |
| [T07](./tickets/T07-first-load.md) | Random legal roll every visit |
| [T08](./tickets/T08-chance-inventory.md) | Chance-minted roll-result inventory |
| [T09](./tickets/T09-roll-payload.md) | Landing-aligned ref × vibe × mode × sig |
| [T10](./tickets/T10-apply-contract.md) | Per-chip whole-page apply effects |
| [T11](./tickets/T11-stable-content.md) | Real product page content, fixed |
| [T12](./tickets/T12-legal-matrix.md) | Illegal only unrenderable; **1536** when complete; soft bans void |
| [T13](./tickets/T13-spec-artifact.md) | Spec at `docs/spec/tasteroll-live-demo.md` |
| [T14](./tickets/T14-section-inventory.md) | Fixed product sections 1–8 |

## Workflow after wayfinder

1. Finish remaining decision tickets (frontier grilling).
2. Write the **locked demo spec** from closed decisions (path from T13).
3. Hand off to implementation (outside this map): build `tasteroll.html` + mint inventory.
