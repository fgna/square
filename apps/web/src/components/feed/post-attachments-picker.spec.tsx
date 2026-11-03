import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostAttachmentsPicker } from './post-attachments-picker';

const api = vi.hoisted(() => ({ post: vi.fn().mockResolvedValue({ data: { id: 'up1' } }) }));
vi.mock('@/lib/api-client', () => ({ default: api }));

describe('PostAttachmentsPicker', () => {
  it('uploads an audio file as multipart form data and adds it to the post', async () => {
    const onChange = vi.fn();
    const { container } = render(<PostAttachmentsPicker value={[]} onChange={onChange} />);
    const input = container.querySelector('input[type="file"][accept*="audio"]') as HTMLInputElement;

    await userEvent.upload(input, new File(['x'], 'Montag.m4a', { type: 'audio/mp4' }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith([{ label: 'Montag.m4a', uploadId: 'up1' }]));
    expect(api.post.mock.calls[0][0]).toBe('/uploads/file');
    expect(api.post.mock.calls[0][2].headers['Content-Type']).toBe('multipart/form-data');
  });
});
