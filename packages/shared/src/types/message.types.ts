export interface MessageSender {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  sender: MessageSender;
  createdAt: string;
}

export interface ConversationParticipant {
  id: string;
  userId: string;
  lastReadAt: string | null;
  user: MessageSender;
}

export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  messages: Pick<Message, 'id' | 'content' | 'senderId' | 'createdAt'>[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedMessages {
  data: Message[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
