import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService, recordingRetentionDays } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { RsvpDto } from './dto/rsvp.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AddAttachmentDto } from '../courses/dto/course-content.dto';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all events' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @CurrentUser() user: any,
  ) {
    return this.eventsService.findAll(Number(page), Number(limit), user?.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eventsService.findOne(id, user?.id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create event (Admin only)' })
  create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update event (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Delete('series/:seriesId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete every occurrence of a recurring event (Admin only)' })
  removeSeries(@Param('seriesId') seriesId: string) {
    return this.eventsService.deleteSeries(seriesId);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete event (Admin only)' })
  remove(@Param('id') id: string) {
    return this.eventsService.delete(id);
  }

  @Post(':id/rsvp')
  @ApiOperation({ summary: 'RSVP to an event' })
  rsvp(
    @Param('id') id: string,
    @Body() dto: RsvpDto,
    @CurrentUser() user: any,
  ) {
    return this.eventsService.rsvp(id, user.id, dto.status);
  }

  @Post('series/:seriesId/rsvp')
  @ApiOperation({ summary: 'RSVP to every upcoming occurrence of a series' })
  rsvpSeries(@Param('seriesId') seriesId: string, @Body() dto: RsvpDto, @CurrentUser() user: any) {
    return this.eventsService.rsvpSeries(seriesId, user.id, dto.status);
  }

  @Delete('series/:seriesId/rsvp')
  @ApiOperation({ summary: 'Withdraw the RSVPs to every upcoming occurrence of a series' })
  cancelSeriesRsvp(@Param('seriesId') seriesId: string, @CurrentUser() user: any) {
    return this.eventsService.cancelSeriesRsvp(seriesId, user.id);
  }

  @Delete(':id/rsvp')
  @ApiOperation({ summary: 'Cancel RSVP' })
  cancelRsvp(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eventsService.cancelRsvp(id, user.id);
  }

  // ── Recordings ─────────────────────────────────────────────────────────

  @Get('recordings/all')
  @ApiOperation({ summary: 'List all recordings (paginated)' })
  findAllRecordings(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.eventsService.findAllRecordings(Number(page), Number(limit));
  }

  @Get('recordings/retention')
  @ApiOperation({ summary: 'Days a recording stays available (0 = until deleted)' })
  recordingRetention() {
    return { days: recordingRetentionDays() };
  }

  @Get(':id/recordings')
  @ApiOperation({ summary: 'Get recordings for an event' })
  findRecordings(@Param('id') id: string) {
    return this.eventsService.findRecordingsByEvent(id);
  }

  @Post(':id/recordings')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Add recording to an event (Admin only)' })
  createRecording(@Param('id') id: string, @Body() dto: CreateRecordingDto) {
    return this.eventsService.createRecording(id, dto);
  }

  @Post('recordings/:recordingId/attachments')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Attach an uploaded file to a recording (Admin only)' })
  addRecordingAttachment(@Param('recordingId') recordingId: string, @Body() dto: AddAttachmentDto) {
    return this.eventsService.addRecordingAttachment(recordingId, dto.uploadId);
  }

  @Delete('recordings/attachments/:attachmentId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Remove a file from a recording (Admin only)' })
  deleteRecordingAttachment(@Param('attachmentId') attachmentId: string) {
    return this.eventsService.deleteRecordingAttachment(attachmentId);
  }

  @Delete('recordings/:recordingId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete a recording (Admin only)' })
  deleteRecording(@Param('recordingId') recordingId: string) {
    return this.eventsService.deleteRecording(recordingId);
  }
}
