import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { StartPagePicker } from './start-page-picker';
import { encodeLastPage } from '@/lib/start-page';
import enMessages from '../../../messages/en.json';

function clearCookies() {
  for (const name of ['start-page', 'last-page']) document.cookie = `${name}=; path=/; max-age=0`;
}

function renderPicker() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <StartPagePicker />
    </NextIntlClientProvider>,
  );
}

describe('StartPagePicker', () => {
  beforeEach(clearCookies);

  it('shows the dashboard as chosen where the instance keeps it', () => {
    renderPicker();
    expect(screen.getByRole('radio', { name: 'Always the dashboard' })).toHaveAttribute('aria-checked', 'true');
  });

  it("shows this device's saved choice", () => {
    document.cookie = 'start-page=last; path=/';
    renderPicker();
    expect(screen.getByRole('radio', { name: 'Pick up where you left off' })).toHaveAttribute('aria-checked', 'true');
  });

  it('saves the choice for this device and forgets the last page when choosing the dashboard', async () => {
    document.cookie = `last-page=${encodeLastPage('/feed/p1', Date.now())}; path=/`;
    renderPicker();
    await userEvent.click(screen.getByRole('radio', { name: 'Pick up where you left off' }));
    expect(document.cookie).toContain('start-page=last');
    await userEvent.click(screen.getByRole('radio', { name: 'Always the dashboard' }));
    expect(document.cookie).toContain('start-page=home');
    expect(document.cookie).not.toContain('last-page=');
  });
});
