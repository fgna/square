import { Body, Controller, Get, Headers, Post, SetMetadata } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { GamificationService } from './gamification.service';
import { authorizeRewardIssuer } from './reward-issuer';
import { IS_PUBLIC_KEY } from '../auth/guards/jwt-auth.guard';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

class RewardDefinitionDto {
  @IsString() @MinLength(1) @MaxLength(80) code!: string;
  @IsInt() @Min(1) @Max(1000000) amount!: number;
}
class RewardEventDto {
  @IsString() @MinLength(1) @MaxLength(128) userId!: string;
  @IsString() @MinLength(1) @MaxLength(128) eventKey!: string;
  @IsString() @MinLength(1) @MaxLength(80) rewardCode!: string;
}
class ItemDto {
  @IsString() @MinLength(1) @MaxLength(160) name!: string;
  @IsInt() @Min(0) @Max(1000000) price!: number;
  @IsOptional() @IsBoolean() cosmetic?: boolean;
}
class EquipmentDto {
  @IsString() @MinLength(1) @MaxLength(48) slot!: string;
  @IsOptional() @IsString() @MaxLength(128) itemId?: string | null;
  @IsString() @MinLength(1) @MaxLength(40) variant!: string;
}
class PurchaseDto {
  @IsString() @MinLength(1) @MaxLength(128) itemId!: string;
  @IsString() @MinLength(1) @MaxLength(128) requestKey!: string;
}

@Controller('gamification')
export class GamificationController {
  constructor(private readonly game: GamificationService) {}

  @Get('wallet')
  wallet(@CurrentUser('id') userId: string) { return this.game.wallet(userId); }

  @Get('transactions')
  history(@CurrentUser('id') userId: string) { return this.game.history(userId); }

  @Get('inventory')
  inventory(@CurrentUser('id') userId: string) { return this.game.inventory(userId); }

  @Get('equipment')
  equipment(@CurrentUser('id') userId: string) { return this.game.equipment(userId); }

  @Post('equipment')
  equip(@CurrentUser('id') userId: string, @Body() dto: EquipmentDto) {
    return this.game.equip(userId, dto.slot, dto.itemId ?? null, dto.variant);
  }

  @Get('items')
  items() { return this.game.items(); }

  @Post('purchase')
  purchase(@CurrentUser('id') userId: string, @Body() dto: PurchaseDto) {
    return this.game.purchase(userId, dto.itemId, dto.requestKey);
  }

  // Authenticated by a scoped server-side issuer token instead of a user JWT.
  // The global capability guard still denies the route when gamification is off.
  @SetMetadata(IS_PUBLIC_KEY, true)
  @Post('issuer/events')
  issueExternalReward(@Headers('authorization') bearer: string | undefined, @Body() dto: RewardEventDto) {
    const issuerId = authorizeRewardIssuer(bearer, dto.rewardCode);
    return this.game.issueReward(dto.userId, dto.rewardCode, issuerId + ':' + dto.eventKey);
  }

  @Roles('ADMIN')
  @Post('admin/rewards')
  defineReward(@Body() dto: RewardDefinitionDto) { return this.game.defineReward(dto.code, dto.amount); }

  @Roles('ADMIN')
  @Post('admin/events')
  issueReward(@Body() dto: RewardEventDto) {
    return this.game.issueReward(dto.userId, dto.rewardCode, dto.eventKey);
  }

  @Roles('ADMIN')
  @Post('admin/items')
  defineItem(@Body() dto: ItemDto) { return this.game.defineItem(dto.name, dto.price, dto.cosmetic ?? false); }
}
