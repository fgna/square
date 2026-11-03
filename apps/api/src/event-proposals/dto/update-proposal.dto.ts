import { IsString, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, MaxLength, MinLength, Matches } from 'class-validator';
import { PROPOSED_DATE } from '../proposal-dates';

/** Admins correct a proposal; votes for dates that are dropped are removed. */
export class UpdateProposalDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @Matches(PROPOSED_DATE, { each: true, message: 'Each date must be "start" or "start/end"' })
  proposedDates?: string[];
}
