import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTestimonialDto {
  @ApiProperty({ example: 'This community changed my career trajectory!' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ example: 'Senior Product Manager' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  role?: string;
}
