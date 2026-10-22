import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum MembershipTierEnum {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
}

export class UpdateTierDto {
  @ApiProperty({ description: 'User ID to update', example: 'uuid-here' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: MembershipTierEnum, example: 'PREMIUM' })
  @IsEnum(MembershipTierEnum)
  tier: MembershipTierEnum;
}
