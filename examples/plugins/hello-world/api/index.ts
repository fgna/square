import { Controller, Get } from '@nestjs/common';
import type { ApiPlugin } from '@community/plugin-sdk/api';

/** GET /api/p/hello-world/greeting: greets the signed-in member. */
const helloWorld: ApiPlugin = {
  register({ CurrentUser }) {
    @Controller()
    class GreetingController {
      @Get('greeting')
      greeting(@CurrentUser('name') name: string) {
        return { name };
      }
    }
    return { controllers: [GreetingController] };
  },
};

export default helloWorld;
