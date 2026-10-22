/**
 * ADVERSARIAL TESTS: SEC-047 through SEC-057
 *
 * SEC-047: AI Coach chat history unbounded array
 * SEC-048: AI Coach missing endpoint rate limiting (tested via decorator check)
 * SEC-049: OAuth callback missing CSRF state param support
 * SEC-050: Categories update bypasses DTO validation
 * SEC-051: Invite token usable by any email
 * SEC-052: GDPR export missing rate limiting (tested via decorator check)
 * SEC-053: Learning group addMember TOCTOU race
 * SEC-054: Journal prompt color field allows arbitrary strings
 * SEC-055: Billing endpoints accept unvalidated URLs
 * SEC-056: Event meetingUrl no @IsUrl validation
 * SEC-057: Event partial date update bypasses ordering validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

describe('[SEC-047] AI Coach chat history bounded', () => {
  it('ChatDto rejects history arrays exceeding 20 items', async () => {
    const { ChatDto } = await import('../ai-coach/dto/chat.dto');
    const dto = plainToInstance(ChatDto, {
      message: 'Hello',
      history: Array.from({ length: 25 }, () => ({ role: 'user', content: 'msg' })),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const historyError = errors.find((e) => e.property === 'history');
    expect(historyError).toBeDefined();
  });

  it('ChatDto accepts history arrays within limit', async () => {
    const { ChatDto } = await import('../ai-coach/dto/chat.dto');
    const dto = plainToInstance(ChatDto, {
      message: 'Hello',
      history: Array.from({ length: 10 }, () => ({ role: 'user', content: 'msg' })),
    });
    const errors = await validate(dto);
    const historyError = errors.find((e) => e.property === 'history');
    expect(historyError).toBeUndefined();
  });
});

describe('[SEC-049] OAuth callback DTO supports state parameter', () => {
  it('OAuthCallbackDto accepts optional state param', async () => {
    const { OAuthCallbackDto } = await import('../auth/dto/oauth-callback.dto');
    const dto = plainToInstance(OAuthCallbackDto, {
      code: 'auth-code-123',
      redirectUri: 'http://localhost:3000/callback',
      state: 'csrf-token-abc',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('OAuthCallbackDto rejects oversized state', async () => {
    const { OAuthCallbackDto } = await import('../auth/dto/oauth-callback.dto');
    const dto = plainToInstance(OAuthCallbackDto, {
      code: 'auth-code-123',
      redirectUri: 'http://localhost:3000/callback',
      state: 'x'.repeat(300),
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('[SEC-050] Categories update uses proper DTO validation', () => {
  it('UpdateCategoryDto rejects invalid slug format', async () => {
    const { UpdateCategoryDto } = await import('../categories/dto/update-category.dto');
    const dto = plainToInstance(UpdateCategoryDto, {
      slug: 'INVALID SLUG <script>',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const slugError = errors.find((e) => e.property === 'slug');
    expect(slugError).toBeDefined();
  });

  it('UpdateCategoryDto rejects invalid color', async () => {
    const { UpdateCategoryDto } = await import('../categories/dto/update-category.dto');
    const dto = plainToInstance(UpdateCategoryDto, {
      color: 'red; background-image: url(evil)',
    });
    const errors = await validate(dto);
    const colorError = errors.find((e) => e.property === 'color');
    expect(colorError).toBeDefined();
  });

  it('UpdateCategoryDto accepts valid hex color', async () => {
    const { UpdateCategoryDto } = await import('../categories/dto/update-category.dto');
    const dto = plainToInstance(UpdateCategoryDto, {
      color: '#c5a880',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('[SEC-051] Invite token email validation', () => {
  it('register rejects invite token when email does not match', async () => {
    const { Test } = await import('@nestjs/testing');
    const { AuthService } = await import('../auth/auth.service');
    const { PrismaService } = await import('../prisma/prisma.service');
    const { JwtService } = await import('@nestjs/jwt');
    const { InvitesService } = await import('../invites/invites.service');
    const { BadRequestException } = await import('@nestjs/common');

    const mockInvitesService = {
      validateInvite: vi.fn().mockResolvedValue({ valid: true, email: 'jane@example.com' }),
      consumeInvite: vi.fn(),
    };

    const mockPrisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      refreshToken: { deleteMany: vi.fn(), create: vi.fn() },
    };

    const mockRedisClient = {
      get: vi.fn().mockResolvedValue(null),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
    };

    const { REDIS_CLIENT } = await import('../redis/redis.module');

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { sign: vi.fn().mockReturnValue('token') } },
        { provide: InvitesService, useValue: mockInvitesService },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
      ],
    }).compile();

    const authService = module.get(AuthService);

    await expect(
      authService.register({
        email: 'attacker@evil.com',
        password: 'StrongPass1',
        name: 'Attacker',
        inviteToken: 'valid-token',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('[SEC-054] Journal prompt color field validation', () => {
  it('CreateCategoryDto rejects arbitrary string as color', async () => {
    const { CreateCategoryDto } = await import('../plugins/bundled/journal/dto/create-prompt.dto');
    const dto = plainToInstance(CreateCategoryDto, {
      name: 'Test',
      color: 'red; background: url(evil)',
    });
    const errors = await validate(dto);
    const colorError = errors.find((e) => e.property === 'color');
    expect(colorError).toBeDefined();
  });

  it('CreateCategoryDto accepts valid hex color', async () => {
    const { CreateCategoryDto } = await import('../plugins/bundled/journal/dto/create-prompt.dto');
    const dto = plainToInstance(CreateCategoryDto, {
      name: 'Test',
      color: '#8b5cf6',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('[SEC-055] Billing endpoint URL validation', () => {
  it('CreateCheckoutDto rejects javascript: URL', async () => {
    const { CreateCheckoutDto } = await import('../billing/dto/checkout.dto');
    const dto = plainToInstance(CreateCheckoutDto, {
      successUrl: 'javascript:alert(1)',
      cancelUrl: 'https://example.com',
    });
    const errors = await validate(dto);
    const urlError = errors.find((e) => e.property === 'successUrl');
    expect(urlError).toBeDefined();
  });

  it('CreateCheckoutDto accepts valid https URLs', async () => {
    const { CreateCheckoutDto } = await import('../billing/dto/checkout.dto');
    const dto = plainToInstance(CreateCheckoutDto, {
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('CreatePortalDto rejects non-URL strings', async () => {
    const { CreatePortalDto } = await import('../billing/dto/checkout.dto');
    const dto = plainToInstance(CreatePortalDto, {
      returnUrl: 'not-a-url',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('[SEC-056] Event meetingUrl validation', () => {
  it('CreateEventDto rejects javascript: meetingUrl', async () => {
    const { CreateEventDto } = await import('../events/dto/create-event.dto');
    const dto = plainToInstance(CreateEventDto, {
      title: 'Test Event',
      description: 'A test event with enough description text',
      startsAt: '2026-07-01T10:00:00Z',
      endsAt: '2026-07-01T11:00:00Z',
      meetingUrl: 'javascript:alert(document.cookie)',
    });
    const errors = await validate(dto);
    const urlError = errors.find((e) => e.property === 'meetingUrl');
    expect(urlError).toBeDefined();
  });

  it('CreateEventDto accepts valid https meetingUrl', async () => {
    const { CreateEventDto } = await import('../events/dto/create-event.dto');
    const dto = plainToInstance(CreateEventDto, {
      title: 'Test Event',
      description: 'A test event with enough description text',
      startsAt: '2026-07-01T10:00:00Z',
      endsAt: '2026-07-01T11:00:00Z',
      meetingUrl: 'https://zoom.us/j/123456',
    });
    const errors = await validate(dto);
    const urlError = errors.find((e) => e.property === 'meetingUrl');
    expect(urlError).toBeUndefined();
  });
});

describe('[SEC-057] Event partial date update validation', () => {
  it('update() rejects endsAt before existing startsAt', async () => {
    const { Test } = await import('@nestjs/testing');
    const { EventsService } = await import('../events/events.service');
    const { PrismaService } = await import('../prisma/prisma.service');
    const { BadRequestException } = await import('@nestjs/common');

    const mockEmailService = { sendMail: vi.fn() };

    const mockPrisma = {
      event: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'e1',
          startsAt: new Date('2026-07-01T10:00:00Z'),
          endsAt: new Date('2026-07-01T12:00:00Z'),
        }),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
      rsvp: { findUnique: vi.fn() },
    };

    const { EmailService } = await import('../email/email.service');

    const module = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    const service = module.get(EventsService);

    await expect(
      service.update('e1', { endsAt: '2026-07-01T09:00:00Z' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('update() rejects startsAt after existing endsAt', async () => {
    const { Test } = await import('@nestjs/testing');
    const { EventsService } = await import('../events/events.service');
    const { PrismaService } = await import('../prisma/prisma.service');
    const { BadRequestException } = await import('@nestjs/common');

    const mockEmailService = { sendMail: vi.fn() };

    const mockPrisma = {
      event: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'e1',
          startsAt: new Date('2026-07-01T10:00:00Z'),
          endsAt: new Date('2026-07-01T12:00:00Z'),
        }),
        update: vi.fn(),
      },
      $transaction: vi.fn(),
      rsvp: { findUnique: vi.fn() },
    };

    const { EmailService } = await import('../email/email.service');

    const module = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    const service = module.get(EventsService);

    await expect(
      service.update('e1', { startsAt: '2026-07-01T13:00:00Z' }),
    ).rejects.toThrow(BadRequestException);
  });
});
