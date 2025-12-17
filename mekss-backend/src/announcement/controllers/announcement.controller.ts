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
import { AnnouncementService } from '../services/announcement.service';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';
import { AnnouncementResponseDto, AnnouncementListResponseDto, AnnouncementStatsDto } from '../dto/announcement-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, AnnouncementType, AnnouncementStatus } from '@prisma/client';

@ApiTags('Announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}

  @Post()
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new announcement' })
  @ApiResponse({ status: 201, description: 'Announcement created successfully', type: AnnouncementResponseDto })
  async create(
    @Body() createAnnouncementDto: CreateAnnouncementDto,
    @Req() req: any
  ): Promise<AnnouncementResponseDto> {
    return this.announcementService.create(createAnnouncementDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get all announcements with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'type', required: false, enum: AnnouncementType, description: 'Filter by type' })
  @ApiQuery({ name: 'priority', required: false, type: String, description: 'Filter by priority' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'status', required: false, enum: AnnouncementStatus, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Announcements retrieved successfully', type: AnnouncementListResponseDto })
  async findAll(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('type') type?: AnnouncementType,
    @Query('priority') priority?: string,
    @Query('parkId') parkId?: number,
    @Query('status') status?: AnnouncementStatus
  ): Promise<AnnouncementListResponseDto> {
    return this.announcementService.findAll(
      req.user.id,
      req.user.role,
      page,
      limit,
      { type, priority, parkId, status }
    );
  }

  @Get(':id')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get a specific announcement by ID' })
  @ApiResponse({ status: 200, description: 'Announcement retrieved successfully', type: AnnouncementResponseDto })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  async findOne(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<AnnouncementResponseDto> {
    return this.announcementService.findOne(+id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update an announcement' })
  @ApiResponse({ status: 200, description: 'Announcement updated successfully', type: AnnouncementResponseDto })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateAnnouncementDto>,
    @Req() req: any
  ): Promise<AnnouncementResponseDto> {
    return this.announcementService.update(+id, updateData, req.user.id, req.user.role);
  }

  @Post(':id/publish')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish an announcement (makes it visible to users)' })
  @ApiResponse({ status: 200, description: 'Announcement published successfully', type: AnnouncementResponseDto })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 400, description: 'Bad request - Announcement cannot be published' })
  async publish(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<AnnouncementResponseDto> {
    return this.announcementService.publish(+id, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an announcement' })
  @ApiResponse({ status: 204, description: 'Announcement deleted successfully' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  async remove(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<void> {
    return this.announcementService.delete(+id, req.user.id, req.user.role);
  }

  @Get('statistics/overview')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get announcement statistics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully', type: AnnouncementStatsDto })
  async getStatistics(
    @Query('parkId') parkId?: number
  ): Promise<AnnouncementStatsDto> {
    return this.announcementService.getStatistics(parkId);
  }
}
