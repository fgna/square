import { IsString, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, MaxLength, MinLength, Matches } from 'class-validator';
import { PROPOSED_DATE } from '../proposal-dates';

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
  /** "start" or "start/end" (ISO 8601 interval). */
  @IsString({ each: true })
  @Matches(PROPOSED_DATE, { each: true, message: 'Each date must be "start" or "start/end"' })
  proposedDates: string[];
}
