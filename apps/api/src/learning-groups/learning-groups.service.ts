import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';
import { NotificationsService } from '../notifications/notifications.service';

const MAX_MEMBERS = 8;

@Injectable()
export class LearningGroupsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateGroupDto) {
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.learningGroup.create({
        data: {
          name: dto.name,
          description: dto.description,
          createdById: userId,
        },
      });

      // Creator automatically joins as a member
      await tx.learningGroupMember.create({
        data: {
          groupId: group.id,
          userId,
        },
      });

      return tx.learningGroup.findUnique({
        where: { id: group.id },
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          members: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
          _count: { select: { members: true, messages: true } },
        },
      });
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.learningGroup.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { members: true, messages: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(groupId: string, userId: string) {
    const group = await this.prisma.learningGroup.findUnique({
      where: { id: groupId },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            sender: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        _count: { select: { members: true, messages: true } },
      },
    });

    if (!group) {
      throw new NotFoundException('Learning group not found');
    }

    const isMember = group.members.some((m) => m.userId === userId);

    // SEC-036: Non-members should only see minimal info (name, description, member count)
    // Hide actual member list details and messages
    if (!isMember) {
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        createdById: group.createdById,
        createdBy: group.createdBy,
        isMember,
        memberCount: group._count.members,
        members: [],
        messages: [],
        _count: group._count,
      };
    }

    // The creator sees who has been invited but not yet answered.
    const invites =
      group.createdById === userId
        ? await this.prisma.learningGroupInvite.findMany({
            where: { groupId },
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          })
        : [];

    return {
      ...group,
      isMember,
      invites,
      memberCount: group._count.members,
      messages: group.messages.reverse(),
    };
  }

  /**
   * Invites someone to the group. Adding used to make them a member on the
   * spot, without asking; now they get an invitation (and a notification)
   * and join only by accepting it. Open invitations count towards the
   * member limit, so accepting can never overfill a group.
   */
  async addMember(groupId: string, targetUserId: string, requestingUserId: string) {
    const invite = await this.prisma.$transaction(async (tx) => {
      // Lock the group row to serialize concurrent invitations
      await tx.$queryRaw`SELECT id FROM "LearningGroup" WHERE id = ${groupId} FOR UPDATE`;

      const group = await tx.learningGroup.findUnique({
        where: { id: groupId },
        include: { members: true, invites: true },
      });

      if (!group) {
        throw new NotFoundException('Learning group not found');
      }

      if (group.createdById !== requestingUserId) {
        throw new ForbiddenException('Only the group creator can invite members');
      }

      if (group.members.length + group.invites.length >= MAX_MEMBERS) {
        throw new BadRequestException(`Group cannot exceed ${MAX_MEMBERS} members, including open invitations`);
      }

      const targetUser = await tx.user.findUnique({
        where: { id: targetUserId },
      });
      if (!targetUser) {
        throw new NotFoundException('User not found');
      }

      if (group.members.some((m) => m.userId === targetUserId)) {
        throw new BadRequestException('User is already a member of this group');
      }
      if (group.invites.some((i) => i.userId === targetUserId)) {
        throw new BadRequestException('User has already been invited');
      }

      return tx.learningGroupInvite.create({
        data: { groupId, userId: targetUserId, invitedById: requestingUserId },
      });
    });

    await this.notifications.create(targetUserId, requestingUserId, 'GROUP_INVITE', groupId, 'learningGroup');
    return { message: 'Invitation sent', inviteId: invite.id };
  }

  /** Invitations waiting for the current user's answer. */
  async myInvites(userId: string) {
    return this.prisma.learningGroupInvite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        group: { select: { id: true, name: true, description: true, _count: { select: { members: true } } } },
        invitedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async acceptInvite(inviteId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.learningGroupInvite.findUnique({ where: { id: inviteId } });
      if (!invite || invite.userId !== userId) throw new NotFoundException('Invitation not found');

      await tx.$queryRaw`SELECT id FROM "LearningGroup" WHERE id = ${invite.groupId} FOR UPDATE`;
      const members = await tx.learningGroupMember.count({ where: { groupId: invite.groupId } });
      if (members >= MAX_MEMBERS) {
        throw new BadRequestException(`Group already has ${MAX_MEMBERS} members`);
      }

      await tx.learningGroupMember.create({ data: { groupId: invite.groupId, userId } });
      await tx.learningGroupInvite.delete({ where: { id: inviteId } });
      return { message: 'Joined', groupId: invite.groupId };
    });
  }

  /** The invitee declines, or the group creator withdraws the invitation. */
  async removeInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.learningGroupInvite.findUnique({
      where: { id: inviteId },
      include: { group: { select: { createdById: true } } },
    });
    if (!invite || (invite.userId !== userId && invite.group.createdById !== userId)) {
      throw new NotFoundException('Invitation not found');
    }
    await this.prisma.learningGroupInvite.delete({ where: { id: inviteId } });
    return { message: 'Invitation removed' };
  }

  async removeMember(groupId: string, targetUserId: string, requestingUserId: string) {
    const group = await this.prisma.learningGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) {
      throw new NotFoundException('Learning group not found');
    }

    // Creator can remove anyone; members can only remove themselves
    const isCreator = group.createdById === requestingUserId;
    const isSelfLeave = targetUserId === requestingUserId;

    if (!isCreator && !isSelfLeave) {
      throw new ForbiddenException('Only the group creator can remove members');
    }

    // Creator cannot leave their own group (must delete it)
    if (isSelfLeave && isCreator) {
      throw new BadRequestException('Group creator cannot leave. Delete the group instead.');
    }

    const membership = group.members.find((m) => m.userId === targetUserId);
    if (!membership) {
      throw new NotFoundException('User is not a member of this group');
    }

    await this.prisma.learningGroupMember.delete({
      where: { id: membership.id },
    });

    return { message: 'Member removed' };
  }

  async sendMessage(groupId: string, userId: string, dto: SendGroupMessageDto) {
    // Verify membership
    const membership = await this.prisma.learningGroupMember.findFirst({
      where: { groupId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    return this.prisma.learningGroupMessage.create({
      data: {
        groupId,
        senderId: userId,
        content: dto.content,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async getMessages(groupId: string, userId: string, page = 1, limit = 50) {
    // Verify membership
    const membership = await this.prisma.learningGroupMember.findFirst({
      where: { groupId, userId },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    limit = Math.max(1, Math.min(limit, 100));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.learningGroupMessage.findMany({
        where: { groupId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.learningGroupMessage.count({ where: { groupId } }),
    ]);

    return {
      data: data.reverse(),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async join(groupId: string, userId: string) {
    // SEC-035: Wrap in $transaction to prevent TOCTOU race condition
    // where concurrent joins could exceed MAX_MEMBERS
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LearningGroup" WHERE id = ${groupId} FOR UPDATE`;

      const group = await tx.learningGroup.findUnique({
        where: { id: groupId },
        include: { _count: { select: { members: true } } },
      });
      if (!group) throw new NotFoundException('Learning group not found');

      if (group._count.members >= MAX_MEMBERS) {
        throw new BadRequestException(`Group cannot exceed ${MAX_MEMBERS} members`);
      }

      const existing = await tx.learningGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (existing) throw new BadRequestException('Already a member');

      // Groups are joined by invitation only (the creator invites, the member
      // accepts). Without this check anyone who knew a group's id could walk in.
      const invite = await tx.learningGroupInvite.findUnique({
        where: { groupId_userId: { groupId, userId } },
      });
      if (!invite) throw new ForbiddenException('You can only join a learning group you have been invited to');

      await tx.learningGroupMember.create({ data: { groupId, userId } });
      await tx.learningGroupInvite.delete({ where: { id: invite.id } });
      return { joined: true };
    });
  }

  async leave(groupId: string, userId: string) {
    const group = await this.prisma.learningGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Learning group not found');

    if (group.createdById === userId) {
      throw new ForbiddenException('Group creator cannot leave. Delete the group instead.');
    }

    await this.prisma.learningGroupMember.deleteMany({ where: { groupId, userId } });
    return { joined: false };
  }

  async deleteGroup(groupId: string, userId: string) {
    const group = await this.prisma.learningGroup.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Learning group not found');
    }

    if (group.createdById !== userId) {
      throw new ForbiddenException('Only the group creator can delete it');
    }

    await this.prisma.learningGroup.delete({ where: { id: groupId } });

    return { message: 'Learning group deleted' };
  }
}
