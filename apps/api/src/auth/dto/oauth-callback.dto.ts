import { IsString, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OAuthCallbackDto {
  @ApiProperty({ example: '4/0AX4XfWh...' })
  @IsString()
  @MaxLength(4096)
  code: string;

  @ApiProperty({ example: 'http://localhost:3000/auth/callback/google' })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(2048)
  redirectUri: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  state?: string;
}
