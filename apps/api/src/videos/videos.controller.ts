import { Body, Controller, Delete, Get, Header, Param, ParseIntPipe, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { VIDEO_CHUNK_BYTES } from './hosted-video';
import { VideosService } from './videos.service';

/**
 * Admin-only upload of videos hosted by the platform itself. Not rate-limited:
 * a video of one hour is about 60–120 chunks, more than the per-route limits
 * allow, and only admins can reach these routes.
 */
@ApiTags('videos')
@ApiBearerAuth()
@Controller('videos/uploads')
@Roles('ADMIN')
// Both throttlers by name: SkipThrottle() alone only skips "default".
@SkipThrottle({ default: true, auth: true })
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @Post()
  @ApiOperation({ summary: 'Start a video upload (Admin only, MP4)' })
  start(@CurrentUser() user: { id: string }, @Body() body: { filename: string; size: number }) {
    return this.videos.start(user.id, body);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'How much of an upload the server has (to resume)' })
  status(@Param('id') id: string) {
    return this.videos.status(id);
  }

  @Put(':id/chunks/:index')
  @UseInterceptors(FileInterceptor('chunk', { storage: undefined, limits: { fileSize: VIDEO_CHUNK_BYTES } }))
  @ApiOperation({ summary: 'Upload one chunk of a video' })
  chunk(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.videos.appendChunk(id, index, file?.buffer);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Finish a video upload; returns the video path for a lesson or recording' })
  complete(@Param('id') id: string) {
    return this.videos.complete(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel an unfinished video upload' })
  abort(@Param('id') id: string) {
    return this.videos.abort(id);
  }
}
