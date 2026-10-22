import { BadRequestException, Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

interface ChatMessage { role: 'user' | 'assistant'; content: string }

@Injectable()
export class AiCoachService {
  private readonly client = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

  isConfigured(): boolean { return !!this.client && !!process.env.COMMUNITY_AI_SYSTEM_PROMPT?.trim(); }

  async chat(_userId: string, message: string, history: ChatMessage[]) {
    if (!this.client || !this.isConfigured()) throw new BadRequestException('AI service is not configured');
    if (typeof message !== 'string' || !message.trim() || message.length > 2000)
      throw new BadRequestException('Invalid message');
    const validHistory = Array.isArray(history) && history.length <= 10 &&
      history.every(item => (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' && item.content.length <= 2000);
    if (!validHistory) throw new BadRequestException('Invalid history');
    const response = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: process.env.COMMUNITY_AI_SYSTEM_PROMPT!,
      messages: [...history.map(item => ({ role: item.role, content: item.content })), { role: 'user', content: message }],
    });
    return { message: response.content.filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text).join('') };
  }
}
