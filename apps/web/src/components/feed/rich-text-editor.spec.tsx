import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RichTextEditor, normalizeLinkUrl } from './rich-text-editor';

describe('RichTextEditor link with visible text', () => {
  it('inserts a link that shows the text and points to the address', async () => {
    const onChange = vi.fn();
    render(<RichTextEditor content="<p>Hallo </p>" onChange={onChange} />);

    await userEvent.click(screen.getByTitle('Add link'));
    await userEvent.type(screen.getByLabelText('Text to display'), 'Zur Anmeldung');
    await userEvent.type(screen.getByLabelText('Link (address)'), 'beispiel.de/anmeldung');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const html = onChange.mock.calls.at(-1)![0] as string;
    expect(html).toMatch(/<a [^>]*href="https:\/\/beispiel\.de\/anmeldung"[^>]*>Zur Anmeldung<\/a>/);
  });

  it('refuses anything that is not a web or mail address', async () => {
    render(<RichTextEditor content="<p></p>" onChange={vi.fn()} />);

    await userEvent.click(screen.getByTitle('Add link'));
    await userEvent.type(screen.getByLabelText('Link (address)'), 'javascript:alert(1)');

    expect(screen.getByText(/Please enter a web address/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });
});

describe('normalizeLinkUrl', () => {
  it('adds https and keeps mail addresses', () => {
    expect(normalizeLinkUrl('beispiel.de')).toBe('https://beispiel.de/');
    expect(normalizeLinkUrl('http://x.de/a?b=1')).toBe('http://x.de/a?b=1');
    expect(normalizeLinkUrl('mailto:info@beispiel.de')).toBe('mailto:info@beispiel.de');
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkUrl('  ')).toBeNull();
  });
});
