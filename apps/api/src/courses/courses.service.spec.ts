import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { CoursesService } from './courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  course: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  progress: {
    upsert: vi.fn(),
  },
  lesson: {
    findUnique: vi.fn(),
  },
};

describe('CoursesService', () => {
  let service: CoursesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated courses', async () => {
      const mockCourses = [{ id: '1', title: 'Course 1', isPublished: true }];
      mockPrisma.course.findMany.mockResolvedValue(mockCourses);
      mockPrisma.course.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);
      expect(result.data).toEqual(mockCourses);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a course by id', async () => {
      const mockCourse = { id: '1', title: 'Course 1', modules: [] };
      mockPrisma.course.findUnique.mockResolvedValue(mockCourse);

      const result = await service.findOne('1');
      expect(result.id).toBe('1');
    });

    it('should throw NotFoundException for non-existent course', async () => {
      mockPrisma.course.findUnique.mockResolvedValue(null);
      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProgress', () => {
    it('should upsert progress record', async () => {
      mockPrisma.course.findUnique.mockResolvedValue({ id: '1' });
      mockPrisma.progress.upsert.mockResolvedValue({
        userId: 'user-1',
        courseId: '1',
        percentage: 50,
      });

      const result = await service.updateProgress('1', 'user-1', 50);
      expect(result.percentage).toBe(50);
    });
  });
});
