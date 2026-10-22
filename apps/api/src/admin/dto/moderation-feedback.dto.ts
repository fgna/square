import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ModerationFeedbackDto {
  @ApiProperty({ example: 'Please leave out the advertising link — the rest is welcome.' })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  feedback: string;
}
