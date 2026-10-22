import { Controller, Post, Get, Body, Param, Req, SetMetadata, HttpCode, HttpStatus, RawBody } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { BillingService } from './billing.service';
import { CreateCheckoutDto, CreatePortalDto } from './dto/checkout.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../auth/guards/jwt-auth.guard';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Create Stripe Checkout session for upgrade' })
  async createCheckout(@CurrentUser() user: any, @Body() dto: CreateCheckoutDto) {
    return this.billingService.createCheckoutSession(user.id, dto.successUrl, dto.cancelUrl);
  }

  @Post('portal')
  @ApiOperation({ summary: 'Create Stripe Customer Portal session' })
  async createPortal(@CurrentUser() user: any, @Body() dto: CreatePortalDto) {
    return this.billingService.createPortalSession(user.id, dto.returnUrl);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current subscription status' })
  async getStatus(@CurrentUser() user: any) {
    return this.billingService.getSubscriptionStatus(user.id);
  }

  @Get('admin/:userId/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get subscription status for a user (Admin)' })
  async getAdminStatus(@Param('userId') userId: string) {
    return this.billingService.getSubscriptionStatus(userId);
  }

  @Post('webhook')
  @SetMetadata(IS_PUBLIC_KEY, true)
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async handleWebhook(@RawBody() rawBody: Buffer, @Req() req: any) {
    const signature = req.headers['stripe-signature'] as string;
    return this.billingService.handleWebhook(rawBody, signature);
  }
}
