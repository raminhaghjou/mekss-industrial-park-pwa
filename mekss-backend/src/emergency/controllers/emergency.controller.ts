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
import { EmergencyService } from '../services/emergency.service';
import { CreateEmergencyAlertDto } from '../dto/create-emergency-alert.dto';
import { EmergencyResponseDto, EmergencyListResponseDto, EmergencyStatsDto, EmergencyActionDto } from '../dto/emergency-response.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, EmergencyType, EmergencySeverity, EmergencyStatus } from '@prisma/client';

@ApiTags('Emergency Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post()
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD)
  @ApiOperation({ summary: 'Create a new emergency alert' })
  @ApiResponse({ status: 201, description: 'Emergency alert created successfully', type: EmergencyResponseDto })
  async create(
    @Body() createEmergencyDto: CreateEmergencyAlertDto,
    @Req() req: any
  ): Promise<EmergencyResponseDto> {
    return this.emergencyService.create(createEmergencyDto, req.user.id);
  }

  @Get()
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get all emergency alerts with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'type', required: false, enum: EmergencyType, description: 'Filter by type' })
  @ApiQuery({ name: 'severity', required: false, enum: EmergencySeverity, description: 'Filter by severity' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiQuery({ name: 'status', required: false, enum: EmergencyStatus, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'Emergency alerts retrieved successfully', type: EmergencyListResponseDto })
  async findAll(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('type') type?: string,
    @Query('severity') severity?: string,
    @Query('parkId') parkId?: number,
    @Query('status') status?: string
  ): Promise<EmergencyListResponseDto> {
    return this.emergencyService.findAll(
      req.user.id,
      req.user.role,
      page,
      limit,
      { type, severity, parkId, status }
    );
  }

  @Get(':id')
  @Roles(UserRole.FACTORY_OWNER, UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get a specific emergency alert by ID' })
  @ApiResponse({ status: 200, description: 'Emergency alert retrieved successfully', type: EmergencyResponseDto })
  @ApiResponse({ status: 404, description: 'Emergency alert not found' })
  async findOne(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<EmergencyResponseDto> {
    return this.emergencyService.findOne(+id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD)
  @ApiOperation({ summary: 'Update an emergency alert' })
  @ApiResponse({ status: 200, description: 'Emergency alert updated successfully', type: EmergencyResponseDto })
  @ApiResponse({ status: 404, description: 'Emergency alert not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  async update(
    @Param('id') id: string,
    @Body() updateData: Partial<CreateEmergencyAlertDto>,
    @Req() req: any
  ): Promise<EmergencyResponseDto> {
    return this.emergencyService.update(+id, updateData, req.user.id, req.user.role);
  }

  @Post(':id/action')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.SECURITY_GUARD)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Take action on an emergency alert' })
  @ApiResponse({ status: 200, description: 'Action taken successfully', type: EmergencyResponseDto })
  @ApiResponse({ status: 404, description: 'Emergency alert not found' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid action' })
  async takeAction(
    @Param('id') id: string,
    @Body() actionDto: EmergencyActionDto,
    @Req() req: any
  ): Promise<EmergencyResponseDto> {
    return this.emergencyService.takeAction(+id, actionDto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an emergency alert' })
  @ApiResponse({ status: 204, description: 'Emergency alert deleted successfully' })
  @ApiResponse({ status: 404, description: 'Emergency alert not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  async remove(
    @Param('id') id: string,
    @Req() req: any
  ): Promise<void> {
    return this.emergencyService.delete(+id, req.user.id, req.user.role);
  }

  @Get('statistics/overview')
  @Roles(UserRole.PARK_MANAGER, UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL)
  @ApiOperation({ summary: 'Get emergency alert statistics' })
  @ApiQuery({ name: 'parkId', required: false, type: Number, description: 'Filter by park ID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully', type: EmergencyStatsDto })
  async getStatistics(
    @Query('parkId') parkId?: number
  ): Promise<EmergencyStatsDto> {
    return this.emergencyService.getStatistics(parkId);
  }
}
