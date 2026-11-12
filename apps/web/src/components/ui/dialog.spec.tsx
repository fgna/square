import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dialog, DialogContent, DialogTitle } from './dialog';

describe('Radix dialog stacking', () => {
  it('renders its content above the backdrop so visible actions are not obscured', () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Test dialog</DialogTitle>
          <button type="button">Continue</button>
        </DialogContent>
      </Dialog>,
    );

    const content = screen.getByRole('dialog');
    const backdrop = document.querySelector('.fixed.inset-0');
    expect(backdrop).not.toBeNull();
    expect(backdrop).toHaveClass('z-50');
    expect(content).toHaveClass('z-[51]');
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });
});
