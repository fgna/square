import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CourseCard } from './course-card';

const course = {
  id: 'c1', title: 'Führen statt Reagieren', description: 'Warum Du …', isPublished: true,
  coverUrl: 'https://images.unsplash.com/p1',
  coverCredit: { name: 'Jane Doe', url: 'https://unsplash.com/@jane?utm_source=square&utm_medium=referral', source: 'unsplash' },
} as any;

describe('CourseCard cover', () => {
  it('names the Unsplash photographer without nesting links in the card', () => {
    const { container } = render(<CourseCard course={course} />);
    expect(screen.getByText(/Jane Doe/)).toBeTruthy();
    expect(container.querySelectorAll('a a')).toHaveLength(0);
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  it('shows no credit for an uploaded cover', () => {
    render(<CourseCard course={{ ...course, coverUrl: '/uploads/uploads/u1/c.jpg', coverCredit: null }} />);
    expect(screen.queryByText(/Unsplash/)).toBeNull();
  });
});
