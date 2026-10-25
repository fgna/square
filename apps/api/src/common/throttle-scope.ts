import type { ExecutionContext } from '@nestjs/common';

/**
 * In @nestjs/throttler every throttler registered in forRoot applies to every
 * route. A throttler built with this skipIf only counts on routes (or
 * controllers) that declare it with @Throttle({ <name>: … }); everywhere
 * else it is skipped. The strict "auth" limits thus stay on sign-in,
 * registration and password routes instead of limiting chat polling or the
 * health check.
 */
export function onlyWhereDeclared(name: string) {
  return (context: ExecutionContext) => {
    const key = `THROTTLER:LIMIT${name}`;
    const declared = Reflect.getMetadata(key, context.getHandler()) ?? Reflect.getMetadata(key, context.getClass());
    return declared === undefined;
  };
}
