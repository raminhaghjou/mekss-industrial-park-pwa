import { IsNotEmpty, IsEnum, IsOptional, IsString, IsNumber, IsArray, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EmergencyType, EmergencySeverity, EmergencyStatus } from '@prisma/client';

export class CreateEmergencyAlertDto {
  @ApiProperty({ description: 'Title of the emergency alert', example: 'هشدار جدی - نشت گاز' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Detailed description of the emergency', example: 'گزارش نشت گاز در بخش شرقی مجتمع - فورا محل را تخلیه کنید' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ description: 'Type of emergency', enum: EmergencyType, example: EmergencyType.GAS_LEAK })
  @IsNotEmpty()
  @IsEnum(EmergencyType)
  type: EmergencyType;

  @ApiProperty({ description: 'Severity level', enum: EmergencySeverity, example: EmergencySeverity.CRITICAL })
  @IsNotEmpty()
  @IsEnum(EmergencySeverity)
  severity: EmergencySeverity;

  @ApiProperty({ description: 'ID of the park', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  parkId: number;

  @ApiProperty({ description: 'Location/Area affected', example: 'بخش شرقی - انبار شماره 3' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ description: 'GPS coordinates', example: { lat: 35.6892, lng: 51.3890 } })
  @IsOptional()
  coordinates?: {
    lat: number;
    lng: number;
  };

  @ApiProperty({ description: 'Affected factory IDs', type: [Number], example: [1, 2, 3] })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  affectedFactories?: number[];

  @ApiProperty({ description: 'Affected area radius in meters', example: 500 })
  @IsOptional()
  @IsNumber()
  affectedRadius?: number;

  @ApiProperty({ description: 'Instructions for affected personnel', example: 'فورا محل را تخلیه کرده و در نقطه امن تجمع کنید' })
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiProperty({ description: 'Contact information for emergency response', example: 'تماس با مرکز کنترل: 12345678' })
  @IsOptional()
  @IsString()
  contactInfo?: string;

  @ApiProperty({ description: 'Emergency image URLs', type: [String], example: ['https://example.com/emergency1.jpg'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiProperty({ description: 'Additional emergency documents', type: [String], example: ['https://example.com/safety-guide.pdf'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documents?: string[];

  @ApiProperty({ description: 'Whether to send SMS alert', example: true })
  @IsOptional()
  sendSmsAlert?: boolean = true;

  @ApiProperty({ description: 'Whether to send push notification', example: true })
  @IsOptional()
  sendPushNotification?: boolean = true;

  @ApiProperty({ description: 'Whether to sound emergency alarm', example: true })
  @IsOptional()
  triggerAlarm?: boolean = true;
}
