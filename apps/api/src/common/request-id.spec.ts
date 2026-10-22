import { describe, it, expect } from 'vitest';
import { normalizeRequestId } from './request-id';

describe('normalizeRequestId', () => {
  it('accepts a well-formed id', () => {
    expect(normalizeRequestId('client-supplied-id-123')).toBe('client-supplied-id-123');
  });

  it('accepts a UUID', () => {
    expect(normalizeRequestId('e9f31152-6e19-45b9-a0ae-f8ed66fd808c')).toBe(
      'e9f31152-6e19-45b9-a0ae-f8ed66fd808c',
    );
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeRequestId('  abc123  ')).toBe('abc123');
  });

  it('takes the first value when given an array (duplicate headers)', () => {
    expect(normalizeRequestId(['first-id', 'second-id'])).toBe('first-id');
  });

  it('rejects non-string values', () => {
    expect(normalizeRequestId(undefined)).toBeUndefined();
    expect(normalizeRequestId(null)).toBeUndefined();
    expect(normalizeRequestId(12345)).toBeUndefined();
  });

  it('rejects an empty string', () => {
    expect(normalizeRequestId('')).toBeUndefined();
    expect(normalizeRequestId('   ')).toBeUndefined();
  });

  it('rejects values over 128 characters', () => {
    expect(normalizeRequestId('a'.repeat(129))).toBeUndefined();
  });

  it('accepts exactly 128 characters', () => {
    expect(normalizeRequestId('a'.repeat(128))).toBe('a'.repeat(128));
  });

  it('rejects values with disallowed characters (log injection attempt)', () => {
    expect(normalizeRequestId('id\nwith-newline')).toBeUndefined();
    expect(normalizeRequestId('id"with-quote')).toBeUndefined();
    expect(normalizeRequestId('id with spaces')).toBeUndefined();
    expect(normalizeRequestId('<script>alert(1)</script>')).toBeUndefined();
  });
});
