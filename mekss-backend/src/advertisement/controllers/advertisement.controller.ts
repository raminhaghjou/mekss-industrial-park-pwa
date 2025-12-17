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
import { AdvertisementService } from '../services/advertisement.service';
import { CreateAdvertisementDto } from '../dto/create-advertisement.dto';
import { AdvertisementResponseDto, AdvertisementListResponseDto, AdvertisementStatsDto } from '../dto/advertisement-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, AdvertisementType, AdvertisementPlacement, AdvertisementStatus } from '@prisma/client';

@ApiTags('Advertisements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('advertisements')
export class AdvertisementController {
  constructor(private readonly advertisementService: AdvertisementService) {}

  @Post()
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new advertisement' })
  @ApiResponse({ status: 201, description: 'Advertisement created successfully', type: AdvertisementResponseDto })
  async create(
    @Body() createAdvertisementDto: CreateAdvertisementDto,
    @Req() req: any
  ): Promise<AdvertisementResponseDto> {
    return this.advertisementService.create(createAdvertisementDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get all advertisements with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'type', required: false, enum: AdvertisementType, description: 'Filter by type' })
  @ApiQuery({ name: 'placement', required: false, enum: AdvertisementPlacement, description: 'Filter by placement' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID' })
  @ApiQuery({ name: 'status', required: false, enum: AdvertisementStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiResponse({ status: 200, description: 'Advertisements retrieved successfully', type: AdvertisementListResponseDto })
  async findAll(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('type') type?: string,
    @Query('placement') placement?: string,
    @Query('parkId') parkId?: number,
    @Query('factoryId') factoryId?: number,
    @Query('status') status?: string,
    @Query('isActive') isActive?: boolean
  ): Promise<AdvertisementListResponseDto> {
    return this.advertisementService.findAll(
      req.user.id,
      req.user.role,
      page,
      limit,
      { type, placement, parkId, factoryId, status, isActive }
    );
  }

  @Get('placement/:placement')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get active advertisements for a specific placement' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of advertisements (default: 5)' })
  @ApiResponse({ status: 200, description: 'Active advertisements retrieved successfully', type: [AdvertisementResponseDto] })
  async findActiveForPlacement(
    @Param('placement') placement: string,
    @Query('limit') limit: number = 5,
    @Req() req: any
  ): Promise<AdvertisementResponseDto[]> {
    return this.advertisementService.findActiveForPlacement(placement, req.user.id, req.user.role, limit);
  }

  @Get(':id')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get a specific advertisement by ID' })
  @ApiResponse({ status: 200, description: 'Advertisement retrieved successfully', type: AdvertisementResponseDto })
  @ApiResponse({ status: 404, description: 'Advertisement not found' })
  async findOne(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<AdvertisementResponseDto> {
    return this.advertisementService.findOne(+id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an advertisement' })
  @ApiResponse({ status: 200, description: 'Advertisement updated successfully', type: AdvertisementResponseDto })
  @ApiResponse({ status: 404, description: 'Advertisement not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateAdvertisementDto>,
    @Req() req: any
  ): Promise<AdvertisementResponseDto> {
    return this.advertisementService.update(+id, updateData, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an advertisement' })
  @ApiResponse({ status: 204, description: 'Advertisement deleted successfully' })
  @ApiResponse({ status: 404, description: 'Advertisement not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  async remove(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<void> {
    return this.advertisementService.delete(+id, req.user.id, req.user.role);
  }

  @Post(':id/impression')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record an advertisement impression' })
  @ApiResponse({ status: 200, description: 'Impression recorded successfully' })
  async recordImpression(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<void> {
    return this.advertisementService.recordImpression(+id, req.user.id);
  }

  @Post(':id/click')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record an advertisement click' })
  @ApiResponse({ status: 200, description: 'Click recorded successfully' })
  async recordClick(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<void> {
    return this.advertisementService.recordClick(+id, req.user.id);
  }

  @Get('statistics/overview')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get advertisement statistics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'factoryId', required: false, type: Number, description: 'Filter by factory ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully', type: AdvertisementStatsDto })
  async getStatistics(
    @Query('parkId') parkId?: number,
    @Query('factoryId') factoryId?: number
  ): Promise<AdvertisementStatsDto> {
    return this.advertisementService.getStatistics(parkId, factoryId);
  }
}
