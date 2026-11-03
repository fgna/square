import { IsString, IsOptional, IsUrl, IsInt, Min, MinLength, MaxLength, ValidateIf } from 'class-validator';
import { isHostedVideo } from '../../videos/hosted-video';

export class CreateRecordingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  description?: string;

  /** A link (Vimeo, YouTube, Loom, cloud folder) or a video uploaded to the platform (/uploads/videos/<id>.mp4). */
  @IsString()
  @ValidateIf((dto: CreateRecordingDto) => !isHostedVideo(dto.url))
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  thumbnailUrl?: string;
}
