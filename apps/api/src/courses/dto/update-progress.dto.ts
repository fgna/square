import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProgressDto {
  @ApiProperty({ description: 'ID of the completed lesson' })
  @IsString()
  lessonId: string;
}
