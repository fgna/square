import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Same rules for the text as CreatePostDto — an edit must not bypass them. */
export class UpdatePostDto {
  @ApiProperty({ example: 'Hello again, community!' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content: string;
}
