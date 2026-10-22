import { IsEnum } from 'class-validator';

export enum EmailDigestFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  NONE = 'NONE',
}

export class UpdateDigestDto {
  @IsEnum(EmailDigestFrequency)
  frequency: EmailDigestFrequency;
}
