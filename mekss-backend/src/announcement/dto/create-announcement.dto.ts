import { IsNotEmpty, IsEnum, IsOptional, IsString, IsNumber, IsArray, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AnnouncementType, AnnouncementPriority } from '@prisma/client';

export class CreateAnnouncementDto {
  @ApiProperty({ description: 'Title of the announcement', example: 'اعلامیه مهم - تعمیرات شبکه برق' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Content of the announcement', example: 'به اطلاع می‌رساند روز شنبه شبکه برق منطقه قطع خواهد بود...' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({ description: 'Type of announcement', enum: AnnouncementType, example: AnnouncementType.GENERAL })
  @IsNotEmpty()
  @IsEnum(AnnouncementType)
  type: AnnouncementType;

  @ApiProperty({ description: 'Priority level', enum: AnnouncementPriority, example: AnnouncementPriority.HIGH })
  @IsNotEmpty()
  @IsEnum(AnnouncementPriority)
  priority: AnnouncementPriority;

  @ApiProperty({ description: 'ID of the park (optional for system-wide announcements)', example: 1 })
  @IsOptional()
  @IsNumber()
  parkId?: number;

  @ApiProperty({ description: 'Target audience roles', type: [String], example: ['FACTORY_OWNER', 'PARK_MANAGER'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRoles?: string[];

  @ApiProperty({ description: 'Target factory IDs (optional)', type: [Number], example: [1, 2, 3] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  targetFactories?: number[];

  @ApiProperty({ description: 'Scheduled publish time (ISO string)', example: '2025-01-01T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @ApiProperty({ description: 'Expiration time (ISO string)', example: '2025-01-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ description: 'Whether to send push notification', example: true })
  @IsOptional()
  sendNotification?: boolean = true;

  @ApiProperty({ description: 'Whether to send SMS notification', example: false })
  @IsOptional()
  sendSms?: boolean = false;

  @ApiProperty({ description: 'Array of image URLs', type: [String], example: ['https://example.com/image1.jpg'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({ description: 'Array of attachment URLs', type: [String], example: ['https://example.com/file1.pdf'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
