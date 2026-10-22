/**
 * There is no page per event; the events list scrolls to the card named in
 * the fragment. /events/<id> was a 404.
 */
export function eventUrl(appUrl: string, eventId: string): string {
  return `${appUrl}/events#event-${eventId}`;
}
