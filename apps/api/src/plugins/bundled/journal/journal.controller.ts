import { Controller, Get, Put, Post, Delete, Body, Param, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JournalService } from './journal.service';
import { UpsertJournalDto } from './dto/upsert-journal.dto';
import { CreatePromptDto, UpdatePromptDto, CreateCategoryDto, UpdateCategoryDto } from './dto/create-prompt.dto';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { Roles } from '../../../auth/decorators/roles.decorator';

@ApiTags('journal')
@ApiBearerAuth()
// Mounted under /api/p/journal by the plugin registry.
@Controller()
export class JournalController {
  constructor(private journalService: JournalService) {}

  @Get()
  @ApiOperation({ summary: 'List journal entries for a month' })
  @ApiQuery({ name: 'month', required: false, example: '2026-06' })
  findAll(@CurrentUser() user: any, @Query('month') month?: string) {
    return this.journalService.findAll(user.id, month);
  }

  @Get('method')
  @ApiOperation({ summary: 'Get active journal field definition' })
  getMethodFields(@Query('locale') locale?: string) {
    return this.journalService.getMethodFields(locale);
  }

  @Get('prompts')
  @ApiOperation({ summary: 'Get daily journal prompts' })
  getDailyPrompts(@Query('locale') locale?: string) {
    return this.journalService.getDailyPrompts(locale);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get journal streak stats' })
  getStats(@CurrentUser() user: any) {
    return this.journalService.getStats(user.id);
  }

  // ── Admin: Prompt Categories ─────────────────────────────────────────

  @Get('admin/categories')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all prompt categories (admin)' })
  getCategories() {
    return this.journalService.getCategories();
  }

  @Post('admin/categories')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a prompt category (admin)' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.journalService.createCategory(dto);
  }

  @Patch('admin/categories/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a prompt category (admin)' })
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.journalService.updateCategory(id, dto);
  }

  @Delete('admin/categories/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a prompt category (admin)' })
  deleteCategory(@Param('id') id: string) {
    return this.journalService.deleteCategory(id);
  }

  // ── Admin: Prompts ───────────────────────────────────────────────────

  @Get('admin/prompts')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all prompts (admin)' })
  @ApiQuery({ name: 'categoryId', required: false })
  getPrompts(@Query('categoryId') categoryId?: string) {
    return this.journalService.getPrompts(categoryId);
  }

  @Post('admin/prompts')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a prompt (admin)' })
  createPrompt(@Body() dto: CreatePromptDto) {
    return this.journalService.createPrompt(dto);
  }

  @Patch('admin/prompts/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a prompt (admin)' })
  updatePrompt(@Param('id') id: string, @Body() dto: UpdatePromptDto) {
    return this.journalService.updatePrompt(id, dto);
  }

  @Delete('admin/prompts/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a prompt (admin)' })
  deletePrompt(@Param('id') id: string) {
    return this.journalService.deletePrompt(id);
  }

  // ── User: Journal entries ────────────────────────────────────────────

  @Put('method-entry/:date')
  @ApiOperation({ summary: 'Save a method-defined journal entry (pack mode)' })
  upsertMethodEntry(@CurrentUser() user: { id: string }, @Param('date') date: string, @Body() body: unknown) {
    return this.journalService.upsertPackEntry(user.id, date, body);
  }

  @Get(':date')
  @ApiOperation({ summary: 'Get journal entry for a specific date' })
  findOne(@CurrentUser() user: any, @Param('date') date: string) {
    return this.journalService.findOne(user.id, date);
  }

  @Put(':date')
  @ApiOperation({ summary: 'Create or update journal entry for a date' })
  upsert(
    @CurrentUser() user: any,
    @Param('date') date: string,
    @Body() dto: UpsertJournalDto,
  ) {
    return this.journalService.upsert(user.id, date, dto);
  }

  @Delete(':date')
  @ApiOperation({ summary: 'Delete journal entry for a date' })
  remove(@CurrentUser() user: any, @Param('date') date: string) {
    return this.journalService.delete(user.id, date);
  }
}
