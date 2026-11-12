import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { UpsertNoteDto } from './dto/upsert-note.dto';
import {
  CreateModuleDto,
  UpdateModuleDto,
  CreateLessonDto,
  UpdateLessonDto,
  MoveDto, MoveLessonToModuleDto,
  AddAttachmentDto,
  UpdateAttachmentDto,
} from './dto/course-content.dto';
import { PartialType } from '@nestjs/swagger';

// Partial<CreateCourseDto> is erased at runtime, so the ValidationPipe had
// nothing to check on updates; PartialType keeps the validators.
class UpdateCourseDto extends PartialType(CreateCourseDto) {}
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UnsplashCovers } from '../events/cover-image';

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  private readonly covers = new UnsplashCovers();

  constructor(private coursesService: CoursesService) {}

  @Get()
  @ApiOperation({ summary: 'Get courses (all for admins, published-only for members)' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @CurrentUser() user: any,
  ) {
    return this.coursesService.findAll(Number(page), Number(limit), user?.id, user?.role);
  }

  // ── Cover photos from Unsplash (only with UNSPLASH_ACCESS_KEY) ──────────
  // Declared before ':id' so "covers" is not read as a course id. Same
  // library as event covers, under /courses so it works without events.

  @Get('covers/status')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Whether a photo library is configured for course covers' })
  coverStatus() {
    return { unsplash: this.covers.enabled() };
  }

  @Get('covers/search')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Search photos for a course cover (Admin only)' })
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
  @ApiOperation({ summary: 'Get course by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.coursesService.findOne(id, user?.id, user?.role);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new course (Admin only)' })
  create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  // Both verbs must be declared on their own handler: stacking @Put and @Patch
  // on one method registers only the outermost one, so PATCH used to 404.
  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a course (Admin only)' })
  replace(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a course (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.coursesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a course (Admin only)' })
  remove(@Param('id') id: string) {
    return this.coursesService.delete(id);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Get course progress for current user' })
  getProgress(@Param('id') id: string, @CurrentUser() user: any) {
    return this.coursesService.getProgress(id, user.id);
  }

  @Put(':id/progress')
  @ApiOperation({ summary: 'Set course progress by percentage' })
  setProgress(
    @Param('id') id: string,
    @Body() body: { percentage: number },
    @CurrentUser() user: any,
  ) {
    return this.coursesService.updateProgress(id, user.id, body.percentage);
  }


  @Post(':id/progress')
  @ApiOperation({ summary: 'Mark a lesson as complete' })
  completeLesson(
    @Param('id') id: string,
    @Body() dto: UpdateProgressDto,
    @CurrentUser() user: any,
  ) {
    return this.coursesService.completeLesson(id, user.id, dto.lessonId);
  }

  @Get('lessons/:lessonId/notes')
  @ApiOperation({ summary: 'Get the current user\'s note for a lesson' })
  getNote(@Param('lessonId') lessonId: string, @CurrentUser() user: any) {
    return this.coursesService.getNote(user.id, lessonId);
  }

  @Put('lessons/:lessonId/notes')
  @ApiOperation({ summary: 'Create or update the current user\'s note for a lesson' })
  upsertNote(
    @Param('lessonId') lessonId: string,
    @Body() dto: UpsertNoteDto,
    @CurrentUser() user: any,
  ) {
    return this.coursesService.upsertNote(user.id, lessonId, dto.content);
  }

  @Get('lessons/:lessonId')
  @ApiOperation({ summary: 'Get a specific lesson' })
  getLesson(@Param('lessonId') lessonId: string, @CurrentUser() user: any) {
    return this.coursesService.getLesson(lessonId, user?.role, user?.id);
  }

  // ── Course content (admin) ──────────────────────────────────────────────

  @Post(':id/modules')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add a module to a course (Admin only)' })
  createModule(@Param('id') id: string, @Body() dto: CreateModuleDto) {
    return this.coursesService.createModule(id, dto.title);
  }

  @Patch('modules/:moduleId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Rename a module (Admin only)' })
  updateModule(@Param('moduleId') moduleId: string, @Body() dto: UpdateModuleDto) {
    return this.coursesService.updateModule(moduleId, dto.title);
  }

  @Delete('modules/:moduleId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a module and its lessons (Admin only)' })
  deleteModule(@Param('moduleId') moduleId: string) {
    return this.coursesService.deleteModule(moduleId);
  }

  @Post('modules/:moduleId/move')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Move a module up or down (Admin only)' })
  moveModule(@Param('moduleId') moduleId: string, @Body() dto: MoveDto) {
    return this.coursesService.moveModule(moduleId, dto.direction);
  }

  @Post('modules/:moduleId/lessons')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add a lesson to a module (Admin only)' })
  createLesson(@Param('moduleId') moduleId: string, @Body() dto: CreateLessonDto) {
    return this.coursesService.createLesson(moduleId, dto);
  }

  @Patch('lessons/:lessonId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Edit a lesson (Admin only)' })
  updateLesson(@Param('lessonId') lessonId: string, @Body() dto: UpdateLessonDto) {
    return this.coursesService.updateLesson(lessonId, dto);
  }

  @Delete('lessons/:lessonId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a lesson (Admin only)' })
  deleteLesson(@Param('lessonId') lessonId: string) {
    return this.coursesService.deleteLesson(lessonId);
  }

  @Post('lessons/:lessonId/move')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Move a lesson up or down within its module (Admin only)' })
  moveLesson(@Param('lessonId') lessonId: string, @Body() dto: MoveDto) {
    return this.coursesService.moveLesson(lessonId, dto.direction);
  }

  @Post('lessons/:lessonId/module')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Move a lesson to another module of the same course (Admin only)' })
  moveLessonToModule(@Param('lessonId') lessonId: string, @Body() dto: MoveLessonToModuleDto) {
    return this.coursesService.moveLessonToModule(lessonId, dto.moduleId);
  }

  @Post('lessons/:lessonId/attachments')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Attach an uploaded file to a lesson (Admin only)' })
  addAttachment(@Param('lessonId') lessonId: string, @Body() dto: AddAttachmentDto) {
    return this.coursesService.addAttachment(lessonId, dto.uploadId);
  }

  @Patch('attachments/:attachmentId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Allow or stop downloading a lesson file (Admin only)' })
  updateAttachment(@Param('attachmentId') attachmentId: string, @Body() dto: UpdateAttachmentDto) {
    return this.coursesService.updateAttachment(attachmentId, dto.downloadable);
  }

  @Delete('attachments/:attachmentId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove a file from a lesson (Admin only)' })
  deleteAttachment(@Param('attachmentId') attachmentId: string) {
    return this.coursesService.deleteAttachment(attachmentId);
  }
}
