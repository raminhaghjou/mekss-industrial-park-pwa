import { ApiProperty } from '@nestjs/swagger';
import { AnnouncementType, AnnouncementPriority, AnnouncementStatus } from '@prisma/client';

export class AnnouncementResponseDto {
  @ApiProperty({ description: 'Announcement ID' })
  id: number;

  @ApiProperty({ description: 'Announcement title' })
  title: string;

  @ApiProperty({ description: 'Announcement content' })
  content: string;

  @ApiProperty({ description: 'Announcement type', enum: AnnouncementType })
  type: AnnouncementType;

  @ApiProperty({ description: 'Priority level', enum: AnnouncementPriority })
  priority: AnnouncementPriority;

  @ApiProperty({ description: 'Publication status', enum: AnnouncementStatus })
  status: AnnouncementStatus;

  @ApiProperty({ description: 'Park ID (null for system-wide)' })
  parkId?: number;

  @ApiProperty({ description: 'Park name (if applicable)' })
  parkName?: string;

  @ApiProperty({ description: 'Target audience roles' })
  targetRoles: string[];

  @ApiProperty({ description: 'Target factory IDs' })
  targetFactories: number[];

  @ApiProperty({ description: 'Scheduled publish time' })
  scheduledFor?: Date;

  @ApiProperty({ description: 'Publication time' })
  publishedAt?: Date;

  @ApiProperty({ description: 'Expiration time' })
  expiresAt?: Date;

  @ApiProperty({ description: 'Image URLs' })
  images: string[];

  @ApiProperty({ description: 'Attachment URLs' })
  attachments: string[];

  @ApiProperty({ description: 'View count' })
  viewCount: number;

  @ApiProperty({ description: 'Creator name' })
  createdByName: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class AnnouncementListResponseDto {
  @ApiProperty({ description: 'List of announcements', type: [AnnouncementResponseDto] })
  announcements: AnnouncementResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;
}

export class AnnouncementStatsDto {
  @ApiProperty({ description: 'Total announcements' })
  total: number;

  @ApiProperty({ description: 'Published announcements' })
  published: number;

  @ApiProperty({ description: 'Draft announcements' })
  draft: number;

  @ApiProperty({ description: 'Scheduled announcements' })
  scheduled: number;

  @ApiProperty({ description: 'View statistics by type' })
  viewsByType: Record<string, number>;
}
