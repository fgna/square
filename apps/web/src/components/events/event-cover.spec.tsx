import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventCover } from './event-cover';

describe('EventCover', () => {
  it('shows an uploaded picture without credit', () => {
    const { container } = render(<EventCover url="/uploads/uploads/u/pic.jpg" title="Workshop" />);
    expect(container.querySelector('img')!.getAttribute('src')).toBe('/uploads/uploads/u/pic.jpg');
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('credits the photographer of a library photo with links', () => {
    render(
      <EventCover
        url="https://images.unsplash.com/photo-1"
        credit={{ name: 'Ann', url: 'https://unsplash.com/@ann?utm_source=square&utm_medium=referral' }}
        title="Workshop"
      />,
    );
    expect(screen.getByRole('link', { name: 'Ann' })).toHaveAttribute('href', 'https://unsplash.com/@ann?utm_source=square&utm_medium=referral');
    expect(screen.getByRole('link', { name: 'Unsplash' })).toHaveAttribute('href', 'https://unsplash.com/?utm_source=square&utm_medium=referral');
  });

  it('renders nothing without a picture', () => {
    const { container } = render(<EventCover url={null} title="Workshop" />);
    expect(container.firstChild).toBeNull();
  });
});
