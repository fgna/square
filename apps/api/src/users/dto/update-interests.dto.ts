import { IsArray, IsString, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateInterestsDto {
  @ApiProperty({ description: 'Array of category IDs', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  categoryIds!: string[];
}
