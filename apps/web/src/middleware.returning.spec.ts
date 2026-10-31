import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

describe('start page for returning members', () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => { process.env.NEXT_PUBLIC_APP_URL = original; });

  function visit(cookie?: string) {
    process.env.NEXT_PUBLIC_APP_URL = 'https://community.example.com';
    return middleware(new NextRequest('https://community.example.com/', cookie ? { headers: { cookie } } : undefined));
  }

  it('sends a browser that signed in here before to the sign-in form', () => {
    const response = visit('returning-member=1');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://community.example.com/login');
  });

  it('shows newcomers the start page', () => {
    expect(visit().headers.get('location')).toBeNull();
  });

  it('still sends signed-in members to their start page', () => {
    expect(visit('auth-session=1; returning-member=1').headers.get('location')).toBe('https://community.example.com/dashboard');
  });
});
