import { Controller, Get, Patch, Post, Delete, Param, Body, Query, Put, StreamableFile, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { DeleteUserDto } from './dto/delete-user.dto';
import { InvitesService } from '../invites/invites.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ModerationFeedbackService } from './moderation-feedback.service';
import { ModerationFeedbackDto } from './dto/moderation-feedback.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private reportsService: ReportsService,
    private invitesService: InvitesService,
    private moderationFeedback: ModerationFeedbackService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  getAllUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getAllUsers(Number(page), Number(limit));
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role' })
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.adminService.updateUserRole(id, dto.role, actor.id);
  }

  @Patch('users/:id/toggle-active')
  @ApiOperation({ summary: 'Toggle user active status' })
  toggleUserActive(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    return this.adminService.toggleUserActive(id, actor.id);
  }

  @Post('users/:id/delete')
  @ApiOperation({ summary: "Delete a member's account (same deletion as deleting one's own account)" })
  deleteUser(
    @Param('id') id: string,
    @Body() dto: DeleteUserDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.adminService.deleteUser(id, dto.confirmEmail, actor.id);
  }

  @Patch('posts/:id/hide')
  @ApiOperation({ summary: 'Toggle post visibility' })
  hidePost(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    return this.adminService.hidePost(id, actor.id);
  }

  @Patch('posts/:id/pin')
  @ApiOperation({ summary: 'Toggle post pin status' })
  pinPost(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    return this.adminService.pinPost(id, actor.id);
  }

  @Get('moderation')
  @ApiOperation({ summary: 'Get moderation queue' })
  getModerationQueue(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    // Hidden posts by default; `visible` lists posts a moderator may hide,
    // `reported` the posts members have reported.
    const queue = status === 'visible' || status === 'reported' ? status : 'hidden';
    return this.adminService.getModerationQueue(Number(page), Number(limit), queue);
  }

  @Post('posts/:id/hide-with-feedback')
  @ApiOperation({ summary: 'Hide a post and send its author private feedback' })
  hideWithFeedback(
    @Param('id') id: string,
    @Body() dto: ModerationFeedbackDto,
    @CurrentUser() actor: { id: string },
  ) {
    return this.moderationFeedback.hideWithFeedback(id, actor.id, dto.feedback);
  }

  @Patch('posts/:id/dismiss-reports')
  @ApiOperation({ summary: 'Close the open reports on a post without hiding it' })
  dismissReports(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    return this.adminService.dismissReports(id, actor.id);
  }

  @Get('audit-log')
  @ApiOperation({ summary: 'Get audit log' })
  getAuditLog(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.adminService.getAuditLog(Number(page), Number(limit));
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get platform analytics' })
  getAnalytics() {
    return this.adminService.getAnalytics();
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get platform settings' })
  getPlatformSettings() {
    return this.adminService.getPlatformSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update platform settings' })
  updatePlatformSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.adminService.updatePlatformSettings(dto);
  }

  @Post('invites')
  @ApiOperation({ summary: 'Create an invite' })
  createInvite(@Body() dto: CreateInviteDto, @CurrentUser() user: { id: string }) {
    return this.invitesService.createInvite(dto.email, user.id);
  }

  @Get('invites')
  @ApiOperation({ summary: 'List all invites' })
  listInvites(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.invitesService.listInvites(Number(page), Number(limit));
  }

  @Delete('invites/:id')
  @ApiOperation({ summary: 'Revoke an invite' })
  revokeInvite(@Param('id') id: string) {
    return this.invitesService.revokeInvite(id);
  }

  @Get('reports/members')
  @ApiOperation({ summary: 'Export members as CSV' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="members.csv"')
  async exportMembers(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<StreamableFile> {
    const csv = await this.reportsService.exportMembersCsv(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }

  @Get('reports/posts')
  @ApiOperation({ summary: 'Export posts as CSV' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="posts.csv"')
  async exportPosts(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<StreamableFile> {
    const csv = await this.reportsService.exportPostsCsv(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }

  @Get('reports/events')
  @ApiOperation({ summary: 'Export events as CSV' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="events.csv"')
  async exportEvents(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<StreamableFile> {
    const csv = await this.reportsService.exportEventsCsv(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }

  @Get('reports/course-progress')
  @ApiOperation({ summary: 'Export course progress as CSV' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="course-progress.csv"')
  async exportCourseProgress(): Promise<StreamableFile> {
    const csv = await this.reportsService.exportCourseProgressCsv();
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }
}
