import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            posts: true,
            courses: true,
            events: true,
          },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            posts: true,
            courses: true,
            events: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findContentByCategory(
    slug: string,
    type?: 'posts' | 'courses' | 'events',
    page = 1,
    limit = 20,
  ) {
    limit = Math.max(1, Math.min(limit, 100));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;

    const category = await this.prisma.category.findUnique({
      where: { slug },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const result: { posts?: any; courses?: any; events?: any } = {};

    if (!type || type === 'posts') {
      const [data, total] = await Promise.all([
        this.prisma.postCategory.findMany({
          // Hidden posts and draft courses were listed here too.
          where: { categoryId: category.id, post: { isHidden: false } },
          skip: type === 'posts' ? skip : undefined,
          take: type === 'posts' ? limit : limit,
          include: {
            post: {
              select: {
                id: true,
                content: true,
                createdAt: true,
                author: {
                  select: { id: true, name: true, avatarUrl: true },
                },
                _count: { select: { comments: true, reactions: true } },
              },
            },
          },
        }),
        this.prisma.postCategory.count({
          where: { categoryId: category.id, post: { isHidden: false } },
        }),
      ]);

      result.posts = data.map((pc) => pc.post);
    }

    if (!type || type === 'courses') {
      const data = await this.prisma.courseCategory.findMany({
        where: { categoryId: category.id, course: { isPublished: true } },
        skip: type === 'courses' ? skip : undefined,
        take: type === 'courses' ? limit : limit,
        include: {
          course: {
            select: {
              id: true,
              title: true,
              description: true,
              createdAt: true,
              _count: { select: { modules: true, progress: true } },
            },
          },
        },
      });

      result.courses = data.map((cc) => cc.course);
    }

    if (!type || type === 'events') {
      // Upcoming only, soonest first: a repeating event has one row per date.
      const data = await this.prisma.eventCategory.findMany({
        where: { categoryId: category.id, event: { startsAt: { gte: new Date() } } },
        orderBy: { event: { startsAt: 'asc' } },
        skip: type === 'events' ? skip : undefined,
        take: type === 'events' ? limit : limit,
        include: {
          event: {
            select: {
              id: true,
              title: true,
              description: true,
              startsAt: true,
              endsAt: true,
              location: true,
              _count: { select: { rsvps: true } },
            },
          },
        },
      });

      result.events = data.map((ec) => ec.event);
    }

    return {
      category: { id: category.id, name: category.name, slug: category.slug },
      ...result,
      page,
      limit,
    };
  }

  async create(dto: CreateCategoryDto) {
    try {
      const maxSort = await this.prisma.category.aggregate({
        _max: { sortOrder: true },
      });

      return await this.prisma.category.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          icon: dto.icon,
          color: dto.color,
          sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Category with this name or slug already exists');
      }
      throw err;
    }
  }

  async update(id: string, dto: Partial<CreateCategoryDto>) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    try {
      return await this.prisma.category.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
          ...(dto.color !== undefined && { color: dto.color }),
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Category with this name or slug already exists');
      }
      throw err;
    }
  }

  async delete(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.prisma.category.delete({ where: { id } });
    return { message: 'Category deleted' };
  }
}
