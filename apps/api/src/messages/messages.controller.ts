import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('messages')
@ApiBearerAuth()
@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List all conversations for current user' })
  listConversations(@CurrentUser() user: any) {
    return this.messagesService.listConversations(user.id);
  }

  @Post('conversations/:userId')
  @ApiOperation({ summary: 'Get or create a direct conversation with another user' })
  getOrCreateConversation(
    @Param('userId') otherUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.getOrCreateConversation(user.id, otherUserId);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Get messages in a conversation' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMessages(
    @Param('id') conversationId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.getMessages(conversationId, user.id, Number(page), Number(limit));
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  sendMessage(
    @Param('id') conversationId: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.sendMessage(conversationId, dto, user.id);
  }
}
