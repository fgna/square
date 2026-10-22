import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTestimonialCommentDto {
  @ApiProperty({ example: 'Congratulations — well deserved!' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
