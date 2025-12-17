import { IsNotEmpty, IsEnum, IsOptional, IsString, IsNumber, IsArray, IsDateString, IsBoolean, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdvertisementType, AdvertisementStatus, AdvertisementPlacement } from '@prisma/client';

export class CreateAdvertisementDto {
  @ApiProperty({ description: 'Title of the advertisement', example: 'تبلیغات ویژه - تخفیف 50%' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Description/content of the advertisement', example: 'تخفیف ویژه 50% برای تمام محصولات تا پایان ماه' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ description: 'Type of advertisement', enum: AdvertisementType, example: AdvertisementType.PROMOTION })
  @IsNotEmpty()
  @IsEnum(AdvertisementType)
  type: AdvertisementType;

  @ApiProperty({ description: 'Placement area', enum: AdvertisementPlacement, example: AdvertisementPlacement.HOME_BANNER })
  @IsNotEmpty()
  @IsEnum(AdvertisementPlacement)
  placement: AdvertisementPlacement;

  @ApiProperty({ description: 'ID of the park', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  parkId: number;

  @ApiProperty({ description: 'ID of the factory (optional)', example: 1 })
  @IsOptional()
  @IsNumber()
  factoryId?: number;

  @ApiProperty({ description: 'Advertisement image URL', example: 'https://example.com/ad-banner.jpg' })
  @IsNotEmpty()
  @IsUrl()
  imageUrl: string;

  @ApiProperty({ description: 'Target URL for click action', example: 'https://example.com/offer' })
  @IsOptional()
  @IsUrl()
  targetUrl?: string;

  @ApiProperty({ description: 'Start date (ISO string)', example: '2025-01-01T00:00:00Z' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date (ISO string)', example: '2025-01-31T23:59:59Z' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Display priority (higher number = higher priority)', example: 1 })
  @IsOptional()
  @IsNumber()
  priority?: number = 1;

  @ApiProperty({ description: 'Maximum daily impressions', example: 1000 })
  @IsOptional()
  @IsNumber()
  maxDailyImpressions?: number;

  @ApiProperty({ description: 'Maximum total impressions', example: 10000 })
  @IsOptional()
  @IsNumber()
  maxTotalImpressions?: number;

  @ApiProperty({ description: 'Whether advertisement is active', example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiProperty({ description: 'Additional metadata', type: Object, example: { color: 'red', size: 'large' } })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Tags for categorization', type: [String], example: ['تخفیف', 'محصولات'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
