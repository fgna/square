import { IsString, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, MaxLength, MinLength } from 'class-validator';

export class CreateProposalDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  proposedDates: string[];
}
