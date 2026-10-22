import { describe, it, expect, vi } from 'vitest';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from './http-exception.filter';

function buildHost(request: any, response: any): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();

  function buildResponse() {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return response;
  }

  it('includes the request id in the JSON error body', () => {
    const request = { method: 'GET', url: '/api/posts', id: 'req-123' };
    const response = buildResponse();

    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), buildHost(request, response));

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-123', path: '/api/posts' }),
    );
  });

  it('includes the request id for unhandled (non-HttpException) errors', () => {
    const request = { method: 'POST', url: '/api/courses', id: 'req-456' };
    const response = buildResponse();

    filter.catch(new Error('boom'), buildHost(request, response));

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-456', message: 'Internal server error' }),
    );
  });

  it('works when the request has no id (e.g. request-id generation disabled)', () => {
    const request = { method: 'GET', url: '/api/health' };
    const response = buildResponse();

    filter.catch(new HttpException('ok', HttpStatus.OK), buildHost(request, response));

    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ requestId: undefined }));
  });
});
