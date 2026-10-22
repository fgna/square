import { Module } from '@nestjs/common';
import { InvitesService } from './invites.service';

@Module({
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
