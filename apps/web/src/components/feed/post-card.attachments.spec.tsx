import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostCard } from './post-card';

const api = vi.hoisted(() => ({ get: vi.fn().mockResolvedValue({ data: { bookmarked: false } }), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'u2', role: 'MEMBER' } }) }));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));

describe('PostCard attachments', () => {
  it('plays attached audio and videos from their signed links, without download buttons', () => {
    const post: any = {
      id: 'p1', content: 'Monday', type: 'ANNOUNCEMENT', authorId: 'a', isPinned: false, createdAt: new Date().toISOString(),
      author: { id: 'a', name: 'Admin', avatarUrl: null, role: 'ADMIN' }, _count: { comments: 0, reactions: 0 }, reactions: [],
      attachments: [
        { id: 'x1', filename: 'Montag.m4a', url: '/uploads/uploads/a/m.m4a?exp=1&sig=a', mimeType: 'audio/mp4', size: 1 },
        { id: 'x2', filename: 'Hallo.mp4', url: '/uploads/videos/v.mp4?exp=1&sig=b', mimeType: 'video/mp4', size: 1 },
      ],
    };
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <PostCard post={post} />
      </QueryClientProvider>,
    );
    const audio = container.querySelector('audio')!;
    expect(audio.getAttribute('src')).toBe('/uploads/uploads/a/m.m4a?exp=1&sig=a');
    expect(audio.getAttribute('controlslist')).toBe('nodownload');
    expect(container.querySelector('video')!.getAttribute('src')).toBe('/uploads/videos/v.mp4?exp=1&sig=b');
  });
});
