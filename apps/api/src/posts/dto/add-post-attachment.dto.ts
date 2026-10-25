import { IsOptional, IsString, Matches } from 'class-validator';

/** Either an audio upload (POST /uploads/file) or a video uploaded to the platform. */
export class AddPostAttachmentDto {
  @IsOptional()
  @IsString()
  uploadId?: string;

  @IsOptional()
  @Matches(/^\/uploads\/videos\/[0-9a-f-]{36}\.mp4$/)
  videoUrl?: string;
}
