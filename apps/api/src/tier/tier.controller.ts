import { Controller, Get, Post, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TierService } from './tier.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('tier')
@ApiBearerAuth()
@Controller('tier')
export class TierController {
  constructor(private service: TierService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user tier info' })
  getTierInfo(@CurrentUser() user: any) {
    return this.service.getTierInfo(user.id);
  }

  @Post('upgrade')
  @ApiOperation({ summary: 'Upgrade to Premium' })
  upgrade(@CurrentUser() user: any) {
    return this.service.upgradeTier(user.id);
  }

  @Post('admin/:userId/:tier')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin: set user tier' })
  setTier(@Param('userId') userId: string, @Param('tier') tier: string) {
    return this.service.setTier(userId, tier);
  }
}
