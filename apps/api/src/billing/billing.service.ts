import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BillingService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(BillingService.name);

  constructor(private prisma: PrismaService) {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
  }

  private requireStripe(): Stripe {
    if (!this.stripe) throw new BadRequestException('Billing is not configured');
    return this.stripe;
  }

  async createCheckoutSession(userId: string, successUrl: string, cancelUrl: string) {
    const stripe = this.requireStripe();
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) throw new BadRequestException('Billing is not configured');

    const customerId = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, email: true, stripeCustomerId: true, membershipTier: true },
      });

      if (user.membershipTier === 'PREMIUM') {
        throw new BadRequestException('Already on Premium plan');
      }

      if (user.stripeCustomerId) return user.stripeCustomerId;

      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id },
      });
      await tx.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });
      return customer.id;
    });

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId },
    });

    return { url: session.url };
  }

  async createPortalSession(userId: string, returnUrl: string) {
    const stripe = this.requireStripe();

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stripeCustomerId: true },
    });

    if (!user.stripeCustomerId) {
      throw new BadRequestException('No billing account found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const stripe = this.requireStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new BadRequestException('Webhook secret not configured');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        this.logger.warn(`Payment failed for invoice ${(event.data.object as Stripe.Invoice).id}`);
        break;
    }

    return { received: true };
  }

  async getSubscriptionStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { membershipTier: true, stripeCustomerId: true, stripeSubscriptionId: true },
    });

    const result: {
      tier: string;
      hasSubscription: boolean;
      subscriptionStatus?: string;
      cancelAtPeriodEnd?: boolean;
    } = {
      tier: user.membershipTier,
      hasSubscription: !!user.stripeSubscriptionId,
    };

    if (user.stripeSubscriptionId && this.stripe) {
      try {
        const sub = await this.stripe.subscriptions.retrieve(user.stripeSubscriptionId) as Stripe.Subscription;
        result.subscriptionStatus = sub.status;
        result.cancelAtPeriodEnd = sub.cancel_at_period_end;
      } catch {
        result.subscriptionStatus = 'unknown';
      }
    }

    return result;
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId || !session.subscription) return;

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        membershipTier: 'PREMIUM',
        stripeSubscriptionId: subscriptionId,
      },
    });

    this.logger.log(`User ${userId} upgraded to PREMIUM via checkout`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });
    if (!user) return;

    const isActive = ['active', 'trialing'].includes(subscription.status);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        membershipTier: isActive ? 'PREMIUM' : 'FREE',
        stripeSubscriptionId: subscription.id,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });
    if (!user) return;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        membershipTier: 'FREE',
        stripeSubscriptionId: null,
      },
    });

    this.logger.log(`User ${user.id} downgraded to FREE — subscription cancelled`);
  }
}
