import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';

const MAX_GOALS = 5;

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.goal.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
    });
  }

  async create(userId: string, dto: CreateGoalDto) {
    const count = await this.prisma.goal.count({ where: { userId } });
    if (count >= MAX_GOALS) {
      throw new BadRequestException(`You can have at most ${MAX_GOALS} goals`);
    }

    return this.prisma.goal.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        progress: dto.progress ?? 0,
        status: dto.status,
        order: count,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal || goal.userId !== userId) {
      throw new NotFoundException('Goal not found');
    }

    return this.prisma.goal.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : dto.targetDate === null ? null : undefined,
        progress: dto.progress,
        status: dto.status,
      },
    });
  }

  async delete(id: string, userId: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal || goal.userId !== userId) {
      throw new NotFoundException('Goal not found');
    }

    await this.prisma.goal.delete({ where: { id } });
    return { message: 'Goal deleted' };
  }

  async reorder(userId: string, ids: string[]) {
    const goals = await this.prisma.goal.findMany({ where: { userId } });
    const goalIds = new Set(goals.map((g) => g.id));

    // Verify all provided IDs belong to the user
    for (const id of ids) {
      if (!goalIds.has(id)) {
        throw new BadRequestException(`Goal ${id} not found`);
      }
    }

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.goal.update({
          where: { id },
          data: { order: index },
        }),
      ),
    );

    return this.findAll(userId);
  }
}
