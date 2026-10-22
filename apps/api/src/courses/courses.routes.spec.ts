/**
 * Route registration guard.
 *
 * Stacking two HTTP-method decorators on one handler (@Put + @Patch) registers
 * only the outermost one — the other verb 404s at the router, never reaching
 * the service. That is invisible in service-level tests, so this asserts the
 * metadata Nest actually reads.
 */
import { describe, it, expect } from 'vitest';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import { CoursesController } from './courses.controller';

function routesOf(controller: any) {
  const proto = controller.prototype;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => ({
      handler: name,
      path: Reflect.getMetadata(PATH_METADATA, proto[name]),
      method: Reflect.getMetadata(METHOD_METADATA, proto[name]),
    }))
    .filter((route) => route.method !== undefined);
}

describe('CoursesController route registration', () => {
  const routes = routesOf(CoursesController);

  it('registers PATCH /:id — publishing a course from the admin UI uses it', () => {
    const patch = routes.find(
      (r) => r.method === RequestMethod.PATCH && r.path === ':id',
    );
    expect(patch).toBeDefined();
  });

  it('registers PUT /:id as well', () => {
    const put = routes.find((r) => r.method === RequestMethod.PUT && r.path === ':id');
    expect(put).toBeDefined();
  });

  it('PUT and PATCH are separate handlers, not one stacked method', () => {
    const put = routes.find((r) => r.method === RequestMethod.PUT && r.path === ':id');
    const patch = routes.find((r) => r.method === RequestMethod.PATCH && r.path === ':id');
    expect(put!.handler).not.toBe(patch!.handler);
  });

  it('no handler carries more than one HTTP method', () => {
    const byHandler = new Map<string, number>();
    for (const route of routes) {
      byHandler.set(route.handler, (byHandler.get(route.handler) ?? 0) + 1);
    }
    expect([...byHandler.values()].every((count) => count === 1)).toBe(true);
  });
});
