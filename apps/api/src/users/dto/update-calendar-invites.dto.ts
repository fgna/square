import { IsBoolean } from 'class-validator';

export class UpdateCalendarInvitesDto {
  @IsBoolean()
  calendarInvites: boolean;
}
