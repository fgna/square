import { IsString, IsOptional, IsBoolean, IsDateString, IsInt, IsUrl, MinLength, MaxLength, Min, IsArray, ArrayMaxSize, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { COVER_URL, CoverCreditDto } from '../cover-image';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

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

  @ApiPropertyOptional({ description: 'Categories (topics) this belongs to; shown under Explore', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ description: 'Uploaded picture (/uploads/…) or Unsplash photo URL; null removes it' })
  @IsOptional()
  @Matches(COVER_URL, { message: 'coverUrl must be an uploaded picture or an Unsplash photo' })
  coverUrl?: string | null;

  @ApiPropertyOptional({ description: 'Photographer credit for an Unsplash photo' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoverCreditDto)
  coverCredit?: CoverCreditDto | null;
  @ApiPropertyOptional({ description: 'Highlight the event; on a series it applies to all upcoming dates' })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
