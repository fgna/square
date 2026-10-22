import { IsArray, IsOptional, IsString } from 'class-validator';

export class VoteProposalDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dateVotes?: string[];
}
