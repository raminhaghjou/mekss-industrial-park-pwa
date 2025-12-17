import { ApiProperty } from '@nestjs/swagger';
import { EmergencyType, EmergencySeverity, EmergencyStatus } from '@prisma/client';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class EmergencyResponseDto {
  @ApiProperty({ description: 'Emergency alert ID' })
  id: number;

  @ApiProperty({ description: 'Emergency title' })
  title: string;

  @ApiProperty({ description: 'Emergency description' })
  description: string;

  @ApiProperty({ description: 'Emergency type', enum: EmergencyType })
  type: EmergencyType;

  @ApiProperty({ description: 'Severity level', enum: EmergencySeverity })
  severity: EmergencySeverity;

  @ApiProperty({ description: 'Current status', enum: EmergencyStatus })
  status: EmergencyStatus;

  @ApiProperty({ description: 'Park ID' })
  parkId: number;

  @ApiProperty({ description: 'Park name' })
  parkName: string;

  @ApiProperty({ description: 'Location/Area affected' })
  location?: string;

  @ApiProperty({ description: 'GPS coordinates' })
  coordinates?: {
    lat: number;
    lng: number;
  };

  @ApiProperty({ description: 'Affected factory IDs' })
  affectedFactories: number[];

  @ApiProperty({ description: 'Affected area radius in meters' })
  affectedRadius?: number;

  @ApiProperty({ description: 'Instructions for affected personnel' })
  instructions?: string;

  @ApiProperty({ description: 'Contact information' })
  contactInfo?: string;

  @ApiProperty({ description: 'Emergency image URLs' })
  images: string[];

  @ApiProperty({ description: 'Emergency documents' })
  documents: string[];

  @ApiProperty({ description: 'Response team assigned' })
  responseTeam?: string;

  @ApiProperty({ description: 'Resolution notes' })
  resolutionNotes?: string;

  @ApiProperty({ description: 'Time when emergency was resolved' })
  resolvedAt?: Date;

  @ApiProperty({ description: 'Creator name' })
  createdByName: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description': 'Last update timestamp' })
  updatedAt: Date;
}

export class EmergencyListResponseDto {
  @ApiProperty({ description: 'List of emergency alerts', type: [EmergencyResponseDto] })
  emergencies: EmergencyResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;
}

export class EmergencyStatsDto {
  @ApiProperty({ description: 'Total emergency alerts' })
  total: number;

  @ApiProperty({ description: 'Active emergencies' })
  active: number;

  @ApiProperty({ description: 'Resolved emergencies' })
  resolved: number;

  @ApiProperty({ description: 'Emergencies by severity' })
  bySeverity: Record<string, number>;

  @ApiProperty({ description: 'Emergencies by type' })
  byType: Record<string, number>;

  @ApiProperty({ description: 'Average response time in minutes' })
  averageResponseTime: number;
}

export class EmergencyActionDto {
  @ApiProperty({ description: 'Action to take', example: 'assign_team' })
  @IsNotEmpty()
  @IsString()
  action: string;

  @ApiProperty({ description: 'Additional data for the action', example: { team: 'تیم آتش‌نشانی', notes: 'ارسال فوری' } })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
