import { ApiProperty } from '@nestjs/swagger';
import { RequestType, RequestPriority, RequestStatus } from '@prisma/client';

export class RequestResponseDto {
  @ApiProperty({ description: 'Request ID' })
  id: number;

  @ApiProperty({ description: 'Request title' })
  title: string;

  @ApiProperty({ description: 'Request description' })
  description: string;

  @ApiProperty({ description: 'Request type', enum: RequestType })
  type: RequestType;

  @ApiProperty({ description: 'Request priority', enum: RequestPriority })
  priority: RequestPriority;

  @ApiProperty({ description: 'Request status', enum: RequestStatus })
  status: RequestStatus;

  @ApiProperty({ description: 'Factory ID' })
  factoryId: number;

  @ApiProperty({ description: 'Factory name' })
  factoryName: string;

  @ApiProperty({ description: 'Park ID' })
  parkId: number;

  @ApiProperty({ description: 'Park name' })
  parkName: string;

  @ApiProperty({ description: 'Request metadata' })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Admin comments' })
  adminComments?: string;

  @ApiProperty({ description: 'Array of document URLs' })
  documents: string[];

  @ApiProperty({ description: 'Who created the request' })
  createdBy: string;

  @ApiProperty({ description: 'Who last updated the request' })
  updatedBy?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Review history' })
  reviewHistory?: RequestReviewDto[];
}

export class RequestReviewDto {
  @ApiProperty({ description: 'Review action' })
  action: string;

  @ApiProperty({ description: 'Review comments' })
  comments?: string;

  @ApiProperty({ description: 'Reviewer name' })
  reviewedBy: string;

  @ApiProperty({ description: 'Review timestamp' })
  reviewedAt: Date;

  @ApiProperty({ description: 'Review data' })
  data?: Record<string, any>;
}

export class RequestListResponseDto {
  @ApiProperty({ description: 'List of requests', type: [RequestResponseDto] })
  requests: RequestResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;
}
