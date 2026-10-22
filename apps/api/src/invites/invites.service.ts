import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../email/email.service';
import { mailDay } from '../email/mail-format';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

@Injectable()
export class InvitesService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async createInvite(email: string, invitedById: string) {
    const existing = await this.prisma.invite.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (existing) throw new BadRequestException('An active invite already exists for this email');

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.invite.create({
      data: { email, token, invitedById, expiresAt },
      select: { id: true, email: true, token: true, expiresAt: true, createdAt: true },
    });

    // Creating an invite used to send nothing: the admin had to copy the link
    // and deliver it by hand. The link is still returned for that fallback.
    const emailSent = await this.sendInviteEmail(invite.email, invite.token, invite.expiresAt, invitedById);
    return { ...invite, emailSent };
  }

  /** True only if a mail server is configured and accepted the message. */
  private async sendInviteEmail(to: string, token: string, expiresAt: Date, invitedById: string): Promise<boolean> {
    if (!this.email.isConfigured) return false;

    const [inviter, settings] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: invitedById }, select: { name: true } }),
      this.prisma.platformSettings.findFirst({ select: { platformName: true } }),
    ]);
    const platform = settings?.platformName || 'unsere Community';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const link = `${appUrl}/register?invite=${encodeURIComponent(token)}`;
    const until = mailDay(expiresAt);

    return this.email.send({
      to,
      subject: inviter?.name ? `${inviter.name} lädt dich zu ${platform} ein` : `Einladung zu ${platform}`,
      html: `<p>Hallo,</p>
<p>${inviter?.name ? `${escapeHtml(inviter.name)} lädt dich ein` : 'Du bist eingeladen'}, bei <strong>${escapeHtml(platform)}</strong> mitzumachen.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 20px;background:#c5a880;color:#090d16;font-weight:600;border-radius:8px;text-decoration:none;">Einladung annehmen</a></p>
<p style="color:#6b7280;font-size:13px;">Die Einladung gilt bis zum ${until}. Falls der Knopf nicht funktioniert, kopiere diesen Link in deinen Browser:<br>${link}</p>`,
    });
  }

  async listInvites(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.invite.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          token: true,
          usedAt: true,
          expiresAt: true,
          createdAt: true,
          invitedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.invite.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async validateInvite(token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.usedAt) throw new BadRequestException('Invite already used');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');
    return { valid: true, email: invite.email };
  }

  async consumeInvite(token: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) return null;
    return this.prisma.invite.update({ where: { token }, data: { usedAt: new Date() } });
  }

  async revokeInvite(id: string) {
    await this.prisma.invite.delete({ where: { id } });
    return { message: 'Invite revoked' };
  }
}
