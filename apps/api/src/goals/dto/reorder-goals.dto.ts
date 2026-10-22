import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderGoalsDto {
  @ApiProperty({ example: ['cuid1', 'cuid2', 'cuid3'] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];
}
