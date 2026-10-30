export enum RsvpStatus {
  GOING = 'GOING',
  MAYBE = 'MAYBE',
  NOT_GOING = 'NOT_GOING',
}

export interface EventRsvp {
  id: string;
  eventId: string;
  userId: string;
  status: RsvpStatus;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

export interface CommunityEvent {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
  isVirtual: boolean;
  meetingUrl?: string | null;
  /** Uploaded picture (/uploads/…) or Unsplash photo URL. */
  coverUrl?: string | null;
  /** Photographer credit for a library photo. */
  coverCredit?: { name: string; url: string; source?: string } | null;
  maxRsvps?: number | null;
  /** Shared by every occurrence of a repeating event; null for one-off events. */
  seriesId?: string | null;
  categories?: { category: { id: string; name: string; slug: string } }[];
  rsvps: EventRsvp[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    rsvps: number;
  };
  userRsvp?: EventRsvp | null;
}

export interface PaginatedEvents {
  data: CommunityEvent[];
  total: number;
  /** Like total, but each series counts once. */
  distinctTotal?: number;
  page: number;
  limit: number;
  totalPages: number;
}
