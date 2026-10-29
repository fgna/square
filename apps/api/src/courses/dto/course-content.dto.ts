import { IsString, IsOptional, MinLength, MaxLength, IsInt, Min, Max, IsIn, ValidateIf, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModuleDto {
  @ApiProperty({ example: 'Getting started' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;
}

export class UpdateModuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;
}

export class CreateLessonDto {
  @ApiProperty({ example: 'Welcome' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Rich text (HTML) shown under the video' })
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  content?: string;

  @ApiPropertyOptional({ description: 'YouTube, Vimeo or Loom link; null or empty removes it' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(500)
  videoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Drip courses: days after the member started until this lesson opens' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  releaseAfterDays?: number;
}

export class UpdateLessonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(500)
  videoUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3650)
  releaseAfterDays?: number;

  @ApiPropertyOptional({ description: 'Show members a link to download the video from Vimeo/Loom' })
  @IsOptional()
  @IsBoolean()
  videoDownloadable?: boolean;
}

export class UpdateAttachmentDto {
  @ApiProperty({ description: 'false: members can only view it in the lesson' })
  @IsBoolean()
  downloadable: boolean;
}

export class MoveDto {
  @ApiProperty({ enum: ['up', 'down'] })
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}

export class MoveLessonToModuleDto {
  @ApiProperty({ description: 'Module of the same course the lesson moves to (appended at its end)' })
  @IsString()
  moduleId: string;
}

export class AddAttachmentDto {
  @ApiProperty({ description: 'Id returned by POST /uploads/file' })
  @IsString()
  @MinLength(1)
  uploadId: string;
}
