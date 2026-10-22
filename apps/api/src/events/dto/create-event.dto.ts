import { IsString, IsOptional, IsBoolean, IsDateString, IsInt, IsUrl, MinLength, MaxLength, Min, IsIn, IsArray, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const RECURRENCE_RULES = ['DAILY', 'WEEKDAYS', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiProperty()
  @IsDateString()
  startsAt: string;

  @ApiProperty()
  @IsDateString()
  endsAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  meetingUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxRsvps?: number;

  @ApiPropertyOptional({
    enum: RECURRENCE_RULES,
    description:
      'Repeat the event. Occurrences are generated as individual events, ' +
      'capped at 12 months from the start date.',
  })
  @IsOptional()
  @IsIn(RECURRENCE_RULES)
  recurrence?: (typeof RECURRENCE_RULES)[number];

  @ApiPropertyOptional({
    description:
      'Stop repeating after this date. Leave empty to repeat for the full ' +
      '12-month horizon.',
  })
  @IsOptional()
  @IsDateString()
  recurrenceEndsAt?: string;

  @ApiPropertyOptional({ description: 'Categories (topics) this belongs to; shown under Explore', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  categoryIds?: string[];
}
