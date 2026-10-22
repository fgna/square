import { describe, it, expect } from 'vitest';
import { createParamDecorator, SetMetadata } from '@nestjs/common';
import helloWorld from './index';

describe('hello-world plugin API', () => {
  it('registers a controller that greets the signed-in member', () => {
    const { controllers = [] } = helloWorld.register({
      pluginId: 'hello-world',
      Roles: (...roles) => SetMetadata('roles', roles),
      CurrentUser: createParamDecorator(() => undefined),
    });

    expect(controllers).toHaveLength(1);
    expect(new controllers[0]().greeting('Alex')).toEqual({ name: 'Alex' });
  });
});
