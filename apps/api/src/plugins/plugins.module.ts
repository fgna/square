import { DynamicModule, Global, Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import type { PluginApiContext, PluginContentPack, PluginJournalEntries, PluginTaskAttempts } from '@community/plugin-sdk/api';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { apiPlugins } from './registry.generated';
import { JournalEntryStore } from './data/journal-entries.store';
import { TaskAttemptStore } from './data/task-attempts.store';
import { ContentPackService } from './data/content-pack.service';

/** The Core services behind the SDK's data and contentPack, available app-wide. */
@Global()
@Module({
  providers: [JournalEntryStore, TaskAttemptStore, ContentPackService],
  exports: [JournalEntryStore, TaskAttemptStore, ContentPackService],
})
export class PluginDataModule {}

const SERVICES = Symbol('plugin services');

/** Forwards calls to a service that is only created when the app starts. */
function late<T extends object>(name: string, get: () => T | undefined): T {
  return new Proxy({} as T, {
    get: (_, method) => (...args: unknown[]) => {
      const service = get();
      if (!service) throw new Error(`Plugin service "${name}" is used before the app has started`);
      return (service as Record<string | symbol, (...a: unknown[]) => unknown>)[method](...args);
    },
  });
}

/**
 * Mounts the installed plugins (scripts/plugins.mjs) under /api/p/<plugin id>.
 * The global guards apply as for Core routes: sign-in is required unless a
 * route is public, Roles() restricts by role, and throttling counts as usual.
 */
@Module({})
export class PluginsModule {
  static register(plugins = apiPlugins): DynamicModule {
    const services: { journal?: PluginJournalEntries; tasks?: PluginTaskAttempts; contentPack?: PluginContentPack } = {};
    const data = { journal: late('data.journal', () => services.journal), tasks: late('data.tasks', () => services.tasks) };
    const contentPack = late('contentPack', () => services.contentPack);

    const mounted = plugins.map(({ id, plugin }) => {
      const ctx: PluginApiContext = { pluginId: id, Roles, CurrentUser, data, contentPack };
      const { controllers = [], providers = [] } = plugin.register(ctx);
      // One module class per plugin, so the router can give each its prefix.
      const module = class {};
      Object.defineProperty(module, 'name', { value: `Plugin_${id.replace(/-/g, '_')}` });
      Module({ controllers, providers })(module);
      return { path: `p/${id}`, module };
    });
    return {
      module: PluginsModule,
      imports: [PluginDataModule, ...mounted.map((m) => m.module), RouterModule.register(mounted)],
      providers: [
        {
          // Created at start-up; binds the real services behind the context.
          provide: SERVICES,
          inject: [JournalEntryStore, TaskAttemptStore, ContentPackService],
          useFactory: (journal: JournalEntryStore, tasks: TaskAttemptStore, pack: ContentPackService) => Object.assign(services, { journal, tasks, contentPack: pack }),
        },
      ],
    };
  }
}
