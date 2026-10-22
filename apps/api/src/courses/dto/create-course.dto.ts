import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, IsIn, IsArray, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverUrl?: string;

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
