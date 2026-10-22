export type NotificationType = 'REACTION' | 'COMMENT' | 'MENTION' | 'EVENT_REMINDER' | 'MESSAGE' | 'GROUP_INVITE';

export interface Notification {
  id: string;
  userId: string;
  actorId: string | null;
  actor: { id: string; name: string; avatarUrl?: string | null } | null;
  type: NotificationType;
  entityId: string | null;
  entityType: string | null;
  read: boolean;
  createdAt: string;
  /** Present when entityType is 'event'; null if the event has been deleted. */
  event?: { id: string; title: string; startsAt: string } | null;
}

export interface PaginatedNotifications {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
