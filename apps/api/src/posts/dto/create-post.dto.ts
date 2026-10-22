import { IsString, MinLength, MaxLength, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, IsDateString, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PostTypeEnum {
  DISCUSSION = 'DISCUSSION',
  QUESTION = 'QUESTION',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  INTRODUCTION = 'INTRODUCTION',
  SUCCESS_STORY = 'SUCCESS_STORY',
  TOPIC_SUGGESTION = 'TOPIC_SUGGESTION',
}

export class CreatePollDto {
  @ApiProperty({ example: 'Which frontend framework do you prefer?' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  question: string;

  @ApiProperty({ example: ['React', 'Vue', 'Svelte'] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  options: string[];

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;
}

export class CreatePostDto {
  @ApiProperty({ example: 'Hello, community!' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({ enum: PostTypeEnum, default: PostTypeEnum.DISCUSSION })
  @IsOptional()
  @IsEnum(PostTypeEnum)
  type?: PostTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => CreatePollDto)
  poll?: CreatePollDto;

  @ApiPropertyOptional({ example: ['cat_growth', 'cat_teams'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];
}
