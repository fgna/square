import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  icalEvent?: string;
  /** Must match the METHOD inside icalEvent; mail clients read it from the MIME type. */
  icalMethod?: 'REQUEST' | 'CANCEL';
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth:
          process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
            : undefined,
      });
      this.logger.log(`Email transport configured: ${host}:${process.env.SMTP_PORT || '587'}`);
    } else {
      this.logger.warn('SMTP_HOST not set — emails will be logged but not sent');
    }
  }

  /** False when SMTP_HOST is not set: send() then only logs, and nothing reaches anyone. */
  get isConfigured(): boolean {
    return this.transporter !== null;
  }

  async send(payload: EmailPayload): Promise<boolean> {
    const from = process.env.SMTP_FROM || 'noreply@community.local';

    if (!this.transporter) {
      this.logger.log(`[DRY RUN] To: ${payload.to} | Subject: ${payload.subject}`);
      if (payload.icalEvent) {
        this.logger.log(`[DRY RUN] ICS attachment included`);
      }
      return true;
    }

    try {
      const attachments: any[] = (payload.attachments || []).map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }));

      if (payload.icalEvent) {
        attachments.push({
          filename: payload.icalMethod === 'CANCEL' ? 'cancel.ics' : 'invite.ics',
          content: payload.icalEvent,
          contentType: `text/calendar; method=${payload.icalMethod ?? 'REQUEST'}`,
        });
      }

      await this.transporter.sendMail({
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        attachments,
        ...(payload.icalEvent
          ? {
              alternatives: [
                {
                  contentType: `text/calendar; method=${payload.icalMethod ?? 'REQUEST'}`,
                  content: payload.icalEvent,
                },
              ],
            }
          : {}),
      });
      this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${payload.to}`, error);
      return false;
    }
  }
}
