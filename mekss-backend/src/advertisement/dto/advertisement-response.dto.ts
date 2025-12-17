import { ApiProperty } from '@nestjs/swagger';
import { AdvertisementType, AdvertisementStatus, AdvertisementPlacement } from '@prisma/client';

export class AdvertisementResponseDto {
  @ApiProperty({ description: 'Advertisement ID' })
  id: number;

  @ApiProperty({ description: 'Advertisement title' })
  title: string;

  @ApiProperty({ description: 'Advertisement description' })
  description: string;

  @ApiProperty({ description: 'Advertisement type', enum: AdvertisementType })
  type: AdvertisementType;

  @ApiProperty({ description: 'Placement area', enum: AdvertisementPlacement })
  placement: AdvertisementPlacement;

  @ApiProperty({ description: 'Park ID' })
  parkId: number;

  @ApiProperty({ description: 'Park name' })
  parkName: string;

  @ApiProperty({ description: 'Factory ID (if applicable)' })
  factoryId?: number;

  @ApiProperty({ description: 'Factory name (if applicable)' })
  factoryName?: string;

  @ApiProperty({ description: 'Advertisement image URL' })
  imageUrl: string;

  @ApiProperty({ description: 'Target URL for click action' })
  targetUrl?: string;

  @ApiProperty({ description: 'Start date' })
  startDate: Date;

  @ApiProperty({ description: 'End date' })
  endDate: Date;

  @ApiProperty({ description: 'Display priority' })
  priority: number;

  @ApiProperty({ description: 'Current status', enum: AdvertisementStatus })
  status: AdvertisementStatus;

  @ApiProperty({ description: 'Maximum daily impressions' })
  maxDailyImpressions?: number;

  @ApiProperty({ description: 'Maximum total impressions' })
  maxTotalImpressions?: number;

  @ApiProperty({ description: 'Current total impressions' })
  currentImpressions: number;

  @ApiProperty({ description: 'Current daily impressions' })
  currentDailyImpressions: number;

  @ApiProperty({ description: 'Click count' })
  clickCount: number;

  @ApiProperty({ description: 'Click-through rate (CTR)' })
  ctr: number;

  @ApiProperty({ description: 'Whether advertisement is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Additional metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Tags' })
  tags: string[];

  @ApiProperty({ description: 'Creator name' })
  createdByName: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class AdvertisementListResponseDto {
  @ApiProperty({ description: 'List of advertisements', type: [AdvertisementResponseDto] })
  advertisements: AdvertisementResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;
}

export class AdvertisementStatsDto {
  @ApiProperty({ description: 'Total advertisements' })
  total: number;

  @ApiProperty({ description: 'Active advertisements' })
  active: number;

  @ApiProperty({ description: 'Inactive advertisements' })
  inactive: number;

  @ApiProperty({ description: 'Total impressions' })
  totalImpressions: number;

  @ApiProperty({ description': 'Total clicks' })
  totalClicks: number;

  @ApiProperty({ description: 'Average CTR' })
  averageCtr: number;

  @ApiProperty({ description: 'Performance by placement' })
  performanceByPlacement: Record<string, {
    impressions: number;
    clicks: number;
    ctr: number;
  }>;
}
