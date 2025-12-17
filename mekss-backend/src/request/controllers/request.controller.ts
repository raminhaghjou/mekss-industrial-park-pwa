import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request as Req,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RequestService } from '../services/request.service';
import { CreateRequestDto } from '../dto/create-request.dto';
import { UpdateRequestDto, ApproveRequestDto, RejectRequestDto } from '../dto/update-request.dto';
import { RequestResponseDto, RequestListResponseDto } from '../dto/request-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, RequestStatus, RequestType } from '@prisma/client';

@ApiTags('Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('requests')
export class RequestController {
  constructor(private readonly requestService: RequestService) {}

  @Post()
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new request' })
  @ApiResponse({ status: 201, description: 'Request created successfully', type: RequestResponseDto })
  async create(
    @Body() createRequestDto: CreateRequestDto,
    @Req() req: any
  ): Promise<RequestResponseDto> {
    return this.requestService.create(createRequestDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get all requests with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'status', required: false, enum: RequestStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'type', required: false, enum: RequestType, description: 'Filter by type' })
  @ApiQuery({ name: 'priority', required: false, type: String, description: 'Filter by priority' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiResponse({ status: 200, description: 'Requests retrieved successfully', type: RequestListResponseDto })
  async findAll(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('status') status?: RequestStatus,
    @Query('type') type?: RequestType,
    @Query('priority') priority?: string,
    @Query('factoryId') factoryId?: number,
    @Query('parkId') parkId?: number
  ): Promise<RequestListResponseDto> {
    return this.requestService.findAll(
      req.user.id,
      req.user.role,
      page,
      limit,
      { status, type, priority, factoryId, parkId }
    );
  }

  @Get(':id')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get a specific request by ID' })
  @ApiResponse({ status: 200, description: 'Request retrieved successfully', type: RequestResponseDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findOne(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<RequestResponseDto> {
    return this.requestService.findOne(+id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a request' })
  @ApiResponse({ status: 200, description: 'Request updated successfully', type: RequestResponseDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  async update(
    @Param('id') id: string,
    @Body() updateRequestDto: UpdateRequestDto,
    @Req() req: any
  ): Promise<RequestResponseDto> {
    return this.requestService.update(+id, updateRequestDto, req.user.id, req.user.role);
  }

  @Post(':id/approve')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a request (Park Manager/Admin only)' })
  @ApiResponse({ status: 200, description: 'Request approved successfully', type: RequestResponseDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 400, description: 'Bad request - Request cannot be approved' })
  async approve(
    @Param('id') id: string,
    @Body() approveRequestDto: ApproveRequestDto,
    @Req() req: any
  ): Promise<RequestResponseDto> {
    return this.requestService.approve(+id, approveRequestDto, req.user.id);
  }

  @Post(':id/reject')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a request (Park Manager/Admin only)' })
  @ApiResponse({ status: 200, description: 'Request rejected successfully', type: RequestResponseDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 400, description: 'Bad request - Request cannot be rejected' })
  async reject(
    @Param('id') id: string,
    @Body() rejectRequestDto: RejectRequestDto,
    @Req() req: any
  ): Promise<RequestResponseDto> {
    return this.requestService.reject(+id, rejectRequestDto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a request' })
  @ApiResponse({ status: 204, description: 'Request deleted successfully' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  async remove(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<void> {
    return this.requestService.delete(+id, req.user.id, req.user.role);
  }

  @Get('statistics/overview')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get request statistics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics(
    @Query('parkId') parkId?: number
  ): Promise<any> {
    return this.requestService.getStatistics(parkId);
  }
}
