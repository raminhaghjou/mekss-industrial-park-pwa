import { PartialType } from '@nestjs/swagger';
import { CreateRequestDto } from './create-request.dto';
import { IsOptional, IsEnum, IsString, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';

export class UpdateRequestDto extends PartialType(CreateRequestDto) {
  @ApiProperty({ description: 'Status of the request', enum: RequestStatus, example: RequestStatus.APPROVED })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;

  @ApiProperty({ description: 'Admin comments on the request', example: 'درخواست شما تایید شد' })
  @IsOptional()
  @IsString()
  adminComments?: string;

  @ApiProperty({ description: 'Additional data for approval/rejection', example: { rejectionReason: 'مدارک ناقص است' } })
  @IsOptional()
  @IsObject()
  reviewData?: Record<string, any>;
}

export class ApproveRequestDto {
  @ApiProperty({ description: 'Admin comments', example: 'درخواست تایید شد' })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiProperty({ description: 'Additional approval data', example: { licenseNumber: '12345' } })
  @IsOptional()
  @IsObject()
  approvalData?: Record<string, any>;
}

export class RejectRequestDto {
  @ApiProperty({ description: 'Reason for rejection', example: 'مدارک ناقص است' })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({ description: 'Additional rejection data', example: { requiredDocuments: ['مدرک 1', 'مدرک 2'] } })
  @IsOptional()
  @IsObject()
  rejectionData?: Record<string, any>;
}
