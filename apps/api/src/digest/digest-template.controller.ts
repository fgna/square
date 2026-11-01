import { Controller, Get, Post, Patch, Delete, Body, Param, Header, Query, StreamableFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DigestTemplateService } from './digest-template.service';
import { CreateDigestTemplateDto } from './dto/create-digest-template.dto';
import { UpdateDigestTemplateDto } from './dto/update-digest-template.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DigestService } from '../email/digest.service';
import { digestSchedule } from '../email/digest-render';
import { UnsplashCovers } from '../events/cover-image';

@ApiTags('digest-templates')
@ApiBearerAuth()
@Controller('digest-templates')
export class DigestTemplateController {
  private readonly covers = new UnsplashCovers();

  constructor(
    private digestTemplateService: DigestTemplateService,
    private digests: DigestService,
  ) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all digest templates (Admin only)' })
  findAll() {
    return this.digestTemplateService.findAll();
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a digest template (Admin only)' })
  create(@Body() dto: CreateDigestTemplateDto) {
    return this.digestTemplateService.create(dto);
  }

  @Get('schedule')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'When daily and weekly digests are sent (DIGEST_DAILY_TIME, DIGEST_WEEKLY)' })
  schedule() {
    return digestSchedule();
  }

  @Post(':id/test')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Send the weekly digest with this template and current content to me (Admin only)' })
  sendTest(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.digests.sendTest(user.id, id);
  }

  @Get('preview/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Preview rendered digest template HTML (Admin only)' })
  @Header('Content-Type', 'text/html')
  async preview(@Param('id') id: string): Promise<StreamableFile> {
    const html = await this.digestTemplateService.renderPreview(id);
    return new StreamableFile(Buffer.from(html, 'utf-8'));
  }

  // ── Cover photos from Unsplash (only with UNSPLASH_ACCESS_KEY), before ':id' ──

  @Get('covers/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Whether a photo library is configured for digest covers' })
  coverStatus() {
    return { unsplash: this.covers.enabled() };
  }

  @Get('covers/search')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Search photos for a digest cover (Admin only)' })
  searchCovers(@Query('q') q = '') {
    return this.covers.search(q);
  }

  @Post('covers/chosen')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Report a chosen library photo, as the library requires (Admin only)' })
  coverChosen(@Body() body: { downloadLocation: string }) {
    return this.covers.markChosen(String(body?.downloadLocation ?? ''));
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get a digest template by ID (Admin only)' })
  findOne(@Param('id') id: string) {
    return this.digestTemplateService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a digest template (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateDigestTemplateDto) {
    return this.digestTemplateService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a digest template (Admin only)' })
  remove(@Param('id') id: string) {
    return this.digestTemplateService.delete(id);
  }

  @Post(':id/activate')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Set a digest template as the active one (Admin only)' })
  activate(@Param('id') id: string) {
    return this.digestTemplateService.setActive(id);
  }
}
