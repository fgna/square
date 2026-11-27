import { IsBoolean } from 'class-validator';

export class UpdateAnnouncementEmailsDto {
  @IsBoolean()
  announcementEmails: boolean;
}
