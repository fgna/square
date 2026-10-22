import { IsBoolean } from 'class-validator';

export class UpdateEventRemindersDto {
  @IsBoolean()
  eventReminders: boolean;
}
