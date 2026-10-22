import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssessmentsService } from './assessments.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';

@Controller('assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get('questions')
  getQuestions(@Query('locale') locale?: string) {
    return this.assessments.getQuestions(locale);
  }

  @Post()
  submit(
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitAssessmentDto,
  ) {
    return this.assessments.submit(user.id, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assessments.findAll(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
    );
  }

  // Deletes all of the member's own assessments and answers, so a new one
  // starts without the old answers in view.
  @Delete()
  deleteAll(@CurrentUser() user: { id: string }) {
    return this.assessments.deleteAll(user.id);
  }

  @Get('latest')
  findLatest(@CurrentUser() user: { id: string }) {
    return this.assessments.findLatest(user.id);
  }

  @Get('recommendations')
  getRecommendations(@CurrentUser() user: { id: string }, @Query('locale') locale?: string) {
    return this.assessments.getRecommendations(user.id, locale);
  }

  @Get('admin/mode')
  @Roles('ADMIN')
  getAdminMode() {
    return { readOnly: this.assessments.isPackManaged() };
  }

  @Get('admin/pack-identity')
  @Roles('ADMIN')
  getAdminPackIdentity() {
    return this.assessments.getPackIdentity();
  }

  @Get('admin/questions')
  @Roles('ADMIN')
  getAdminQuestions() {
    return this.assessments.getAdminQuestions();
  }

  @Post('admin/questions')
  @Roles('ADMIN')
  createQuestion(@Body() body: { questionId: string; dimension: string; text: string; sortOrder?: number }) {
    return this.assessments.createQuestion(body);
  }

  @Patch('admin/questions/:id')
  @Roles('ADMIN')
  updateQuestion(@Param('id') id: string, @Body() body: { text?: string; dimension?: string; isActive?: boolean; sortOrder?: number }) {
    return this.assessments.updateQuestion(id, body);
  }

  @Delete('admin/questions/:id')
  @Roles('ADMIN')
  deleteQuestion(@Param('id') id: string) {
    return this.assessments.deleteQuestion(id);
  }
}
