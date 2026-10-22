import {
  IsString,
  IsOptional,
  MaxLength,
  IsIn,
  IsObject,
  IsArray,
  IsBoolean,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const VALID_MOODS = [
  'grateful',
  'happy',
  'calm',
  'motivated',
  'reflective',
  'anxious',
  'frustrated',
  'sad',
  'tired',
  'neutral',
] as const;

export class MustDoTaskDto {
  @IsString()
  @MaxLength(500)
  text: string;

  @IsBoolean()
  done: boolean;
}

export class JournalContentDto {
  @ApiProperty({ description: 'Three things I want to achieve today', example: ['Goal 1', 'Goal 2', 'Goal 3'] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(3)
  threeGoals: string[];

  @ApiProperty({ description: 'Five must-do tasks with checkboxes' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MustDoTaskDto)
  @ArrayMaxSize(5)
  mustDoTasks: MustDoTaskDto[];

  @ApiProperty({ description: 'Who I want to be today' })
  @IsString()
  @MaxLength(5000)
  whoIWantToBe: string;

  @ApiProperty({ description: 'What I am looking forward to' })
  @IsString()
  @MaxLength(5000)
  lookingForwardTo: string;

  @ApiProperty({ description: 'Who is important today and how I want to communicate' })
  @IsString()
  @MaxLength(5000)
  importantPeople: string;

  @ApiProperty({ description: 'Free thoughts' })
  @IsString()
  @MaxLength(10000)
  thoughts: string;
}

export class UpsertJournalDto {
  @ApiProperty({ type: JournalContentDto })
  @IsObject()
  @ValidateNested()
  @Type(() => JournalContentDto)
  content: JournalContentDto;

  @ApiPropertyOptional({
    example: ['grateful', 'tired'],
    enum: VALID_MOODS,
    isArray: true,
    description: 'Multiple moods may be selected for one entry.',
  })
  @IsArray()
  @IsOptional()
  @ArrayMaxSize(VALID_MOODS.length)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  @IsIn(VALID_MOODS, { each: true })
  moods?: string[];
}
