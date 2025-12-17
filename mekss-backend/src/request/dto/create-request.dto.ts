import { IsNotEmpty, IsEnum, IsOptional, IsString, IsNumber, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RequestType, RequestPriority, RequestStatus } from '@prisma/client';

class RequestMetadataDto {
  @ApiProperty({ description: 'Additional metadata fields', example: { factoryId: 1, serviceType: 'electricity' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreateRequestDto {
  @ApiProperty({ description: 'Title of the request', example: 'درخواست مجوز فعالیت کارخانه' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Description of the request', example: 'درخواست مجوز برای راه‌اندازی خط تولید جدید' })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiProperty({ description: 'Type of request', enum: RequestType, example: RequestType.FACTORY_REGISTRATION })
  @IsNotEmpty()
  @IsEnum(RequestType)
  type: RequestType;

  @ApiProperty({ description: 'Priority level', enum: RequestPriority, example: RequestPriority.MEDIUM })
  @IsNotEmpty()
  @IsEnum(RequestPriority)
  priority: RequestPriority;

  @ApiProperty({ description: 'ID of the factory making the request', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  factoryId: number;

  @ApiProperty({ description: 'ID of the park', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  parkId: number;

  @ApiProperty({ description: 'Request metadata', type: RequestMetadataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RequestMetadataDto)
  metadata?: RequestMetadataDto;

  @ApiProperty({ description: 'Array of document file URLs', type: [String], example: ['https://example.com/doc1.pdf'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documents?: string[];
}
