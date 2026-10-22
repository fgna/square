import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventsService } from './events.service';

/** Nightly: removes recordings older than RECORDING_RETENTION_DAYS, if set. */
@Injectable()
export class RecordingRetentionService {
  private readonly logger = new Logger(RecordingRetentionService.name);

  constructor(private events: EventsService) {}

  @Cron('30 3 * * *', { name: 'recording-retention' })
  async run() {
    try {
      await this.events.deleteExpiredRecordings();
    } catch (err) {
      this.logger.error('Recording retention failed', err as Error);
    }
  }
}
