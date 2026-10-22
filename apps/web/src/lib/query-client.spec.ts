/**
 * Every failed mutation is reported through describeError(), so what it
 * produces is the only thing standing between a user and a silent failure.
 */
import { describe, it, expect } from 'vitest';
import { describeError, shouldReportQueryError } from './query-client';

describe('describeError', () => {
  it('prefers the server message over anything generic', () => {
    const error = {
      response: { status: 400, data: { message: 'Title needs at least 3 characters.' } },
    };

    expect(describeError(error)).toBe('Title needs at least 3 characters.');
  });

  it('joins the list NestJS returns for multiple field errors', () => {
    const error = {
      response: {
        status: 400,
        data: { message: ['title must be longer', 'description must be longer'] },
      },
    };

    expect(describeError(error)).toBe('title must be longer · description must be longer');
  });

  it('explains a network failure rather than blaming the input', () => {
    expect(describeError({ message: 'Network Error' })).toBe(
      'Could not reach the server. Check your connection.',
    );
  });

  it.each([
    [403, 'You do not have permission to do that.'],
    [404, 'That item no longer exists.'],
    [413, 'That file is too large.'],
    [429, 'Too many attempts. Please wait a moment.'],
    [500, 'The server had a problem. Please try again.'],
    [503, 'The server had a problem. Please try again.'],
  ])('turns a bare %i into something a person can act on', (status, expected) => {
    expect(describeError({ response: { status } })).toBe(expected);
  });

  it('falls back rather than returning an empty string', () => {
    expect(describeError({ response: { status: 418, data: {} } })).toBe('Something went wrong.');
    expect(describeError({})).not.toBe('');
  });

  it('ignores a blank server message instead of showing whitespace', () => {
    const error = { response: { status: 500, data: { message: '   ' } } };

    expect(describeError(error)).toBe('The server had a problem. Please try again.');
  });
});

describe('shouldReportQueryError', () => {
  const firstLoad = { state: { data: undefined } };
  const notFound = (message: string) => ({ response: { status: 404, data: { message } } });

  it('reports a route the API does not have, which is what emptied the moderation page', () => {
    expect(shouldReportQueryError(notFound('Cannot GET /api/admin/posts'), firstLoad)).toBe(true);
  });

  it('stays quiet on an ordinary 404, which the page renders as "nothing here"', () => {
    expect(shouldReportQueryError(notFound('Journal entry not found'), firstLoad)).toBe(false);
  });

  it('reports server errors and unreachable servers on first load', () => {
    expect(shouldReportQueryError({ response: { status: 500 } }, firstLoad)).toBe(true);
    expect(shouldReportQueryError({ message: 'Network Error' }, firstLoad)).toBe(true);
  });

  it('leaves 401 to the refresh interceptor', () => {
    expect(shouldReportQueryError({ response: { status: 401 } }, firstLoad)).toBe(false);
  });

  it('does not interrupt when a background refresh fails and data is already shown', () => {
    expect(shouldReportQueryError({ response: { status: 500 } }, { state: { data: [] } })).toBe(false);
  });

  it('respects queries that opt out', () => {
    expect(
      shouldReportQueryError({ response: { status: 500 } }, { meta: { silent: true }, state: { data: undefined } }),
    ).toBe(false);
  });
});
