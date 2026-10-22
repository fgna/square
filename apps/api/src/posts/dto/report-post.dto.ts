import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReportPostDto {
  @ApiProperty({ example: 'Spam' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason: string;
}
