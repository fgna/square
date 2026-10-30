import { BadRequestException, NotFoundException } from '@nestjs/common';
import { IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';

/** An uploaded picture or a photo hotlinked from Unsplash (their guidelines require hotlinking). */
export const COVER_URL = /^(\/uploads\/[^\s?#]+|https:\/\/images\.unsplash\.com\/[^\s]+)$/;

export class CoverCreditDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsUrl({ protocols: ['https'], require_protocol: true, host_whitelist: ['unsplash.com'] })
  url: string;

  @IsOptional()
  @IsString()
  @Matches(/^unsplash$/)
  source?: string;
}

export interface CoverSearchResult {
  id: string;
  thumbUrl: string;
  url: string;
  credit: { name: string; url: string; source: 'unsplash' };
  downloadLocation: string;
  alt: string | null;
}

/**
 * Photo search in Unsplash for event covers, only when UNSPLASH_ACCESS_KEY is
 * set. The key stays on the server. Note for operators: hotlinked photos are
 * loaded from Unsplash's servers by members' browsers.
 */
export class UnsplashCovers {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env, private readonly fetchFn: typeof fetch = fetch) {}

  enabled(): boolean {
    return !!this.env.UNSPLASH_ACCESS_KEY;
  }

  private headers() {
    if (!this.enabled()) throw new NotFoundException('Image library not configured');
    return { Authorization: `Client-ID ${this.env.UNSPLASH_ACCESS_KEY}`, 'Accept-Version': 'v1' };
  }

  /** Attribution links must carry utm parameters naming the application. */
  private credited(url: string) {
    const app = encodeURIComponent(this.env.UNSPLASH_APP_NAME || 'square');
    return `${url}${url.includes('?') ? '&' : '?'}utm_source=${app}&utm_medium=referral`;
  }

  async search(query: string): Promise<CoverSearchResult[]> {
    const q = query.trim();
    if (q.length < 2) throw new BadRequestException('Search term too short');
    const res = await this.fetchFn(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&content_filter=high`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new BadRequestException('Image search failed');
    const body: any = await res.json();
    return (body.results ?? []).map((p: any) => ({
      id: p.id,
      thumbUrl: p.urls?.small,
      url: p.urls?.regular,
      credit: { name: p.user?.name ?? 'Unsplash', url: this.credited(p.user?.links?.html ?? 'https://unsplash.com'), source: 'unsplash' as const },
      downloadLocation: p.links?.download_location,
      alt: p.alt_description ?? null,
    }));
  }

  /** Unsplash asks to report a photo as downloaded when it is chosen. */
  async markChosen(downloadLocation: string) {
    if (!/^https:\/\/api\.unsplash\.com\/photos\/[A-Za-z0-9_-]+\/download(\?.*)?$/.test(downloadLocation)) {
      throw new BadRequestException('Invalid download location');
    }
    await this.fetchFn(downloadLocation, { headers: this.headers() }).catch(() => undefined);
    return { ok: true };
  }
}
