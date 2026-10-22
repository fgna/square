import { Controller, Get, Post, Patch, Delete, Body, Param, Query, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TestimonialsService, TestimonialStatus } from './testimonials.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { CreateTestimonialCommentDto } from './dto/create-testimonial-comment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../auth/guards/jwt-auth.guard';

@ApiTags('testimonials')
@Controller('testimonials')
export class TestimonialsController {
  constructor(private testimonialsService: TestimonialsService) {}

  @Get()
  @SetMetadata(IS_PUBLIC_KEY, true)
  @ApiOperation({ summary: 'List approved testimonials' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.testimonialsService.findAll(Number(page), Number(limit));
  }

  @Get('my-likes')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'IDs of the testimonials the caller has liked' })
  listMyLikes(@CurrentUser() user: any) {
    return this.testimonialsService.listMyLikes(user.id);
  }

  @Get('admin')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List testimonials including pending ones (Admin only)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'all'] })
  findAllForAdmin(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status = 'pending',
  ) {
    const allowed: TestimonialStatus[] = ['pending', 'approved', 'all'];
    const safeStatus = allowed.includes(status as TestimonialStatus)
      ? (status as TestimonialStatus)
      : 'pending';
    return this.testimonialsService.findAllForAdmin(Number(page), Number(limit), safeStatus);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a testimonial (requires approval)' })
  create(@Body() dto: CreateTestimonialDto, @CurrentUser() user: any) {
    return this.testimonialsService.create(user.id, dto);
  }

  @Patch(':id/approve')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve a testimonial (Admin only)' })
  approve(@Param('id') id: string) {
    return this.testimonialsService.setApproval(id, true);
  }

  @Patch(':id/unapprove')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke approval, hiding it again (Admin only)' })
  unapprove(@Param('id') id: string) {
    return this.testimonialsService.setApproval(id, false);
  }

  @Patch(':id/feature')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle featured status (Admin only)' })
  toggleFeatured(@Param('id') id: string) {
    return this.testimonialsService.toggleFeatured(id);
  }

  @Post(':id/like')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Like or unlike a testimonial (toggles)' })
  toggleLike(@Param('id') id: string, @CurrentUser() user: any) {
    return this.testimonialsService.toggleLike(id, user.id);
  }

  @Get(':id/comments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List comments on a testimonial' })
  listComments(@Param('id') id: string) {
    return this.testimonialsService.listComments(id);
  }

  @Post(':id/comments')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Comment on a testimonial' })
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateTestimonialCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.testimonialsService.addComment(id, user.id, dto.content);
  }

  @Delete('comments/:commentId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete own comment (admins may delete any)' })
  deleteComment(@Param('commentId') commentId: string, @CurrentUser() user: any) {
    return this.testimonialsService.deleteComment(commentId, user.id, user.role === 'ADMIN');
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a testimonial (Admin only)' })
  remove(@Param('id') id: string) {
    return this.testimonialsService.delete(id);
  }
}
