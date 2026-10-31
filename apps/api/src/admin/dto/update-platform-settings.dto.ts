import { IsString, IsOptional, IsBoolean, IsUrl, MaxLength, Matches, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  platformName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  /** Square home-screen icon: an own upload ("/uploads/…"), or null/"" to remove it. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  appIconUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'primaryColor must be a hex colour (#rrggbb)' })
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'accentColor must be a hex colour (#rrggbb)' })
  accentColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowSignups?: boolean;

  @ApiPropertyOptional({ description: 'Show the public Android app download entry (off by default)' })
  @IsOptional()
  @IsBoolean()
  androidAppDownloadEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Public HTTPS APK download URL; empty or null removes it when disabled' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  androidAppDownloadUrl?: string | null;

  @ApiPropertyOptional({ description: 'Loom, Vimeo or YouTube link for new members; empty or null removes it' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(500)
  welcomeVideoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Send members a daily journal reminder (off by default)' })
  @IsOptional()
  @IsBoolean()
  journalReminders?: boolean;

  @ApiPropertyOptional({ description: 'Default reminder time in the platform time zone, "HH:MM"' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'journalReminderTime must be HH:MM' })
  journalReminderTime?: string;
}
