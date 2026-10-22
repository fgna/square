import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum ChallengeStatusEnum {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export class UpsertChallengeDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  reflection?: string;

  @IsEnum(ChallengeStatusEnum)
  @IsOptional()
  status?: ChallengeStatusEnum;
}
