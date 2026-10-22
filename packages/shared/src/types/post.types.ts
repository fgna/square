export enum ReactionType {
  LIKE = 'LIKE',
  HEART = 'HEART',
  CELEBRATE = 'CELEBRATE',
  INSIGHTFUL = 'INSIGHTFUL',
}

export interface Author {
  id: string;
  name: string;
  avatarUrl?: string | null;
  role: string;
}

export interface Reaction {
  id: string;
  type: ReactionType;
  userId: string;
  postId: string;
  user?: Author;
  createdAt: string;
}

export interface Comment {
  id: string;
  content: string;
  postId: string;
  authorId: string;
  author: Author;
  createdAt: string;
  updatedAt: string;
}

export interface PollOption {
  id: string;
  text: string;
  order: number;
  _count: { votes: number };
  votes?: { id: string }[];
}

export interface Poll {
  id: string;
  question: string;
  endsAt?: string | null;
  createdAt: string;
  options: PollOption[];
  votes?: { optionId: string }[];
}

export interface Post {
  id: string;
  content: string;
  authorId: string;
  author: Author;
  comments: Comment[];
  reactions: Reaction[];
  poll?: Poll | null;
  isPinned: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    comments: number;
    reactions: number;
  };
}

export interface PaginatedPosts {
  data: Post[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
