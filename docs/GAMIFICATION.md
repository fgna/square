# Gamification API (initial delivery of #3)

Requires #2 capabilities. Set `SQUARE_CAPABILITIES` to an allowlist containing
`gamification`, or leave the variable unset (full-feature default).
Without it, all `/api/gamification/**` endpoints return 404.

The ledger and inventory live in Square's database. Every balance change creates
an immutable `GameTransaction`; the wallet cache is atomically maintained.
The migration adds database checks preventing negative balances.

## Flow

1. An authenticated **ADMIN** defines a reward with `POST /api/gamification/admin/rewards`:
   `{"code":"sample-action","amount":10}`.
2. A trusted administrator issues a reward to a known member using
   `POST /api/gamification/admin/events`:
   `{"userId":"...","rewardCode":"sample-action","eventKey":"external-app:event-123"}`.
   Repeating the same user/eventKey/rewardCode returns `duplicate:true` without re-crediting.
   A reused key for a different reward is rejected.
3. An ADMIN creates a product at `POST /api/gamification/admin/items` with
   `{"name":"Profile badge","price":5,"cosmetic":true}`.
4. A signed-in member calls `POST /api/gamification/purchase` with
   `{"itemId":"...","requestKey":"checkout-123"}`. Repeating the same purchase returns
   `duplicate:true`. An already-owned item cannot be purchased again.
5. Members inspect `GET /api/gamification/wallet`, `/transactions`, `/inventory` and `/items`.
   Member IDs are derived from the JWT, never trusted from client input.

Only administrators can issue reward events or configure rewards/items.
Third-party applications need a trusted server-side integration that authenticates
with appropriate admin privileges; **do not expose admin credentials to clients**.
Application-specific reward eligibility stays outside Square.

This first delivery does not include application-scoped service credentials,
refunds, item quantities, or integration tests against PostgreSQL. It needs
Prisma migration deployment and focused tests before acceptance.
