import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { BookmarksService } from './bookmarks.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ReportPostDto } from './dto/report-post.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('posts')
@ApiBearerAuth()
@Controller('posts')
export class PostsController {
  constructor(
    private postsService: PostsService,
    private bookmarksService: BookmarksService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all posts' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'type', required: false, enum: ['DISCUSSION', 'QUESTION', 'ANNOUNCEMENT', 'INTRODUCTION', 'SUCCESS_STORY', 'TOPIC_SUGGESTION'] })
  @ApiQuery({ name: 'prioritize', required: false, enum: ['interests'], description: 'Prioritize posts matching user interests' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('type') type?: string,
    @Query('prioritize') prioritize?: string,
    @CurrentUser() user?: any,
  ) {
    return this.postsService.findAll(Number(page), Number(limit), user?.id, type, prioritize);
  }

  @Get('bookmarks')
  @ApiOperation({ summary: "List current user's bookmarked posts" })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getBookmarks(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @CurrentUser() user: any,
  ) {
    return this.bookmarksService.findAll(user.id, Number(page), Number(limit));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get post by ID' })
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new post (optionally with a poll)' })
  create(@Body() dto: CreatePostDto, @CurrentUser() user: any) {
    return this.postsService.create(dto, user.id, user.role);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a post' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: any,
  ) {
    return this.postsService.update(id, dto.content, user.id, user.role);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.postsService.delete(id, user.id, user.role);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a post' })
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: any,
  ) {
    return this.postsService.addComment(id, dto, user.id);
  }

  @Post(':id/reactions/:type')
  @ApiOperation({ summary: 'Toggle a reaction on a post' })
  toggleReaction(
    @Param('id') id: string,
    @Param('type') type: string,
    @CurrentUser() user: any,
  ) {
    return this.postsService.toggleReaction(id, type, user.id);
  }

  @Post(':id/poll/vote')
  @ApiOperation({ summary: 'Vote on a poll option (creates or changes vote)' })
  votePoll(
    @Param('id') postId: string,
    @Body() body: { optionId: string },
    @CurrentUser() user: any,
  ) {
    return this.postsService.votePoll(postId, body.optionId, user.id);
  }

  @Delete(':id/poll/vote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove own vote from a poll' })
  unvotePoll(@Param('id') postId: string, @CurrentUser() user: any) {
    return this.postsService.unvotePoll(postId, user.id);
  }

  @Post(':id/report')
  @ApiOperation({ summary: 'Report a post to the admins' })
  report(@Param('id') id: string, @Body() dto: ReportPostDto, @CurrentUser() user: { id: string }) {
    return this.postsService.report(id, user.id, dto.reason);
  }

  @Post(':id/bookmark')
  @ApiOperation({ summary: 'Toggle bookmark on a post' })
  toggleBookmark(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookmarksService.toggle(user.id, id);
  }

  @Get(':id/bookmark')
  @ApiOperation({ summary: 'Check if current user bookmarked a post' })
  checkBookmark(@Param('id') id: string, @CurrentUser() user: any) {
    return this.bookmarksService.isBookmarked(user.id, id).then((bookmarked) => ({ bookmarked }));
  }
}
