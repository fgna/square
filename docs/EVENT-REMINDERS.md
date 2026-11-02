# Event reminder expiration and delivery

Square Core owns `EVENT_REMINDER` in-app notifications and event reminder emails.
The journal plugin's daily email reminders are a separate mechanism.

## Visibility

A reminder is visible only when it refers to an existing event whose current
`startsAt` is strictly later than the request's current time. At the exact start
it expires. List pagination, totals and unread counts use the same predicate.
Deleted events and missing/invalid reminder targets are suppressed. Ordinary
notifications, including comments on past events, remain visible. No history is
deleted or marked read as a side effect.

Rescheduling follows the current event time. An old reminder can become visible
again if its event is moved into the future. Sent flags are retained, so changing
a date does not automatically replay an already claimed reminder batch.

## Delivery

The existing 15-minute scheduler and catch-up windows are retained:

- The optional day-ahead reminder is eligible more than 75 minutes and at most
  25 hours before the start.
- The near-start reminder is eligible strictly before the start and at most
  75 minutes before it.

A restart can deliver an unsent reminder still inside its applicable window;
it cannot backfill an expired window or a past event. All comparisons use UTC
instants and are independent of the server's time zone.

Each event/window is claimed with a conditional database update before external
delivery. Only one concurrent worker wins, and a retry cannot duplicate that
batch. The current event date, window and day-ahead opt-in are checked again
before each recipient and before the in-app write after email delivery. Deleted
or rescheduled candidates stop sending. Notification persistence is awaited.

This is best-effort, at-most-once batch delivery. A crash after claiming, or a
provider/persistence failure, can leave recipients without a reminder; automatic
replay is intentionally avoided because it can duplicate emails already sent.
An email handed to a provider before expiration cannot be recalled or have its
arrival time guaranteed. No network or database transaction spans email delivery.

## Instance acceptance

Use a synthetic member with event reminders enabled and synthetic GOING/MAYBE
RSVPs. Verify a future reminder appears in the bell and badge. Move its event
start into the past and refresh both: the reminder disappears while ordinary
messages remain. Delete another reminder's event and verify the same suppression.
Confirm the candidate revision before running acceptance. Do not use real member
accounts or deploy an instance without its established authorization.
