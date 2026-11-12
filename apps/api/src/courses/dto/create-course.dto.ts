import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, IsIn, IsArray, ArrayMaxSize, Matches, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { COVER_URL, CoverCreditDto } from '../../events/cover-image';

export class CreateCourseDto {
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

  @ApiPropertyOptional({ description: 'Uploaded picture (/uploads/…) or Unsplash photo URL; null removes it' })
  @IsOptional()
  @Matches(COVER_URL, { message: 'coverUrl must be an uploaded picture or an Unsplash photo' })
  coverUrl?: string | null;

  @ApiPropertyOptional({ description: 'Photographer credit for an Unsplash photo' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CoverCreditDto)
  coverCredit?: CoverCreditDto | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ enum: ['ALL_AT_ONCE', 'DRIP'] })
  @IsOptional()
  @IsIn(['ALL_AT_ONCE', 'DRIP'])
  releaseMode?: 'ALL_AT_ONCE' | 'DRIP';

  @ApiPropertyOptional({ description: 'Categories (topics) this belongs to; shown under Explore', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  categoryIds?: string[];
}
