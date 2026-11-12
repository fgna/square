import { IsString, IsOptional, IsBoolean, IsArray, MinLength, MaxLength, ArrayMaxSize, Matches, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { COVER_URL, CoverCreditDto } from '../../events/cover-image';

export class CreateDigestTemplateDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  headerHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  footerHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  sections?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{3,8}$/, { message: 'accentColor must be a valid hex color' })
  accentColor?: string;

  /** An uploaded picture (/uploads/…) or an address; null removes it. */
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(\/uploads\/[^\s?#]+|https?:\/\/[^\s]+)$/, { message: 'logoUrl must be an uploaded picture or a web address' })
  @MaxLength(2048)
  logoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Picture at the top of the e-mail: uploaded (/uploads/…) or an Unsplash photo; null removes it' })
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
  isActive?: boolean;
}
