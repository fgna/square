import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from './s3.service';
import { randomUUID } from 'crypto';
import { decodeUploadFilename } from './decode-filename';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Slides and audio for course lessons.
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/mpeg',
  'audio/mp4',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// SEC-034: Dangerous file extensions that should always be blocked
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.com', '.scr', '.pif', '.msi',
  '.sh', '.bash', '.ps1', '.vbs', '.js', '.wsh', '.wsf',
]);

// SEC-034: Magic byte signatures for validating file content matches claimed MIME type
const MAGIC_BYTES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  'image/gif': [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  'image/webp': [Buffer.from('RIFF')], // RIFF....WEBP
  'application/pdf': [Buffer.from('%PDF')],
  // MP3 starts with an ID3 tag or directly with an MPEG frame sync.
  'audio/mpeg': [Buffer.from('ID3'), Buffer.from([0xFF, 0xFB]), Buffer.from([0xFF, 0xF3]), Buffer.from([0xFF, 0xF2])],
  'audio/wav': [Buffer.from('RIFF')],
  'audio/x-wav': [Buffer.from('RIFF')],
  'audio/wave': [Buffer.from('RIFF')],
};

@Injectable()
export class UploadsService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
  ) {}

  /**
   * SEC-034: Validate that file content magic bytes match the claimed MIME type.
   * Prevents attackers from sending executables with a spoofed Content-Type header.
   */
  private validateMagicBytes(file: Express.Multer.File): void {
    const signatures = MAGIC_BYTES[file.mimetype];
    if (signatures && file.buffer && file.buffer.length > 0) {
      const matches = signatures.some((sig) =>
        file.buffer.subarray(0, sig.length).equals(sig),
      );
      if (!matches) {
        throw new BadRequestException(
          'File content does not match declared MIME type',
        );
      }
    }
  }

  /**
   * SEC-034: Block dangerous file extensions regardless of MIME type.
   */
  private validateExtension(filename: string): void {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
    if (BLOCKED_EXTENSIONS.has(ext)) {
      throw new BadRequestException(`File extension "${ext}" is not allowed`);
    }
  }

  async uploadImage(userId: string, file: Express.Multer.File) {
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid image type. Allowed: jpeg, png, gif, webp');
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException('Image too large. Maximum 10MB');
    }
    this.validateMagicBytes(file);
    this.validateExtension(file.originalname);
    return this.processUpload(userId, file);
  }

  async uploadFile(userId: string, file: Express.Multer.File) {
    if (!FILE_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: pdf, doc, docx, xls, xlsx, ppt, pptx, mp3, m4a, wav');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File too large. Maximum 50MB');
    }
    this.validateMagicBytes(file);
    this.validateExtension(file.originalname);
    return this.processUpload(userId, file);
  }

  private async processUpload(userId: string, file: Express.Multer.File) {
    const originalName = decodeUploadFilename(file.originalname);
    const sanitized = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `uploads/${userId}/${randomUUID()}-${sanitized}`;
    const url = await this.s3.upload(key, file.buffer, file.mimetype);

    const upload = await this.prisma.upload.create({
      data: {
        userId,
        key,
        filename: originalName,
        mimeType: file.mimetype,
        size: file.size,
        url,
      },
    });

    return { url: upload.url, key: upload.key, id: upload.id };
  }

  async deleteUpload(key: string, userId: string, userRole: string) {
    const upload = await this.prisma.upload.findUnique({ where: { key } });
    if (!upload) throw new NotFoundException('Upload not found');
    if (upload.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Not authorized to delete this upload');
    }

    await this.s3.delete(key);
    await this.prisma.upload.delete({ where: { key } });
    return { message: 'Upload deleted' };
  }
}
