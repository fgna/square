import { IsOptional, IsString, MinLength, MaxLength, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  // require_tld: false allows IP addresses and localhost (self-hosted installs)
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @MaxLength(2048)
  avatarUrl?: string;
}
