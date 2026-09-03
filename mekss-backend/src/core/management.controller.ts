import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthenticatedUser, JwtAuthGuard, Public, Roles, RolesGuard } from './auth.guard';
import {
  AdvertisementAdminQueryDto,
  AdvertisementModerationDto,
  CreateAnnouncementDto,
  CreateAdvertisementDto,
  CreateEmergencyDto,
  CreateFactoryDto,
  CreateFactoryStaffDto,
  FactoryAdminQueryDto,
  CreateGatePassDto,
  CreateInvoiceDto,
  CreateManagedUserDto,
  CreateParkDto,
  CreateRequestDto,
  MarketRateKeyParamDto,
  OpaqueIdParamDto,
  OpaqueUserIdParamDto,
  PaginationQueryDto,
  PublicSmsRequestDto,
  QrCodeParamDto,
  ReasonDto,
  RegisterFactoryDto,
  ReportQueryDto,
  ResetPasswordAdminDto,
  SendDirectMessageDto,
  SendMessageDto,
  UpdateAnnouncementDto,
  UpdateFactoryDto,
  UpdateFactoryStaffDto,
  UpdateManagedUserDto,
  UpdateMarketRateDto,
  UpdateParkDto,
  WalletTopUpDto,
} from './management.dto';
import { ManagementService } from './management.service';

type AuthenticatedRequest = { user: AuthenticatedUser };
const currentUser = (request: AuthenticatedRequest) => request.user;

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1')
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

  @Get('users') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') users(@Query() query: PaginationQueryDto) { return this.management.users(query); }
  @Get('users/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') userDetail(@Param() params: OpaqueIdParamDto) { return this.management.userDetail(params.id); }
  @Post('users') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') createUser(@Req() req: AuthenticatedRequest, @Body() body: CreateManagedUserDto) { return this.management.createUser(currentUser(req), body); }
  @Patch('users/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') updateUser(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: UpdateManagedUserDto) { return this.management.updateUser(currentUser(req), params.id, body); }
  @Delete('users/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') deleteUser(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.deleteUser(currentUser(req), params.id); }
  @Post('users/:id/activate') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') activateUser(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.setUserActive(currentUser(req), params.id, true); }
  @Post('users/:id/deactivate') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') deactivateUser(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.setUserActive(currentUser(req), params.id, false); }
  @Post('users/:id/reset-password') @Roles(Role.SUPER_ADMIN) @ApiTags('Users') resetUserPassword(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: ResetPasswordAdminDto) { return this.management.resetUserPassword(currentUser(req), params.id, body.newPassword); }

  @Get('industrial-parks') @Roles(Role.SUPER_ADMIN) @ApiTags('Parks') parks(@Query() query: PaginationQueryDto) { return this.management.parks(query); }
  @Get('industrial-parks/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Parks') parkDetail(@Param() params: OpaqueIdParamDto) { return this.management.parkDetail(params.id); }
  @Post('industrial-parks') @Roles(Role.SUPER_ADMIN) @ApiTags('Parks') createPark(@Req() req: AuthenticatedRequest, @Body() body: CreateParkDto) { return this.management.createPark(currentUser(req), body); }
  @Put('industrial-parks/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Parks') updatePark(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: UpdateParkDto) { return this.management.updatePark(currentUser(req), params.id, body); }
  @Delete('industrial-parks/:id') @Roles(Role.SUPER_ADMIN) @ApiTags('Parks') deletePark(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.deletePark(currentUser(req), params.id); }

  @Get('factories') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL, Role.EMPLOYEE) @ApiTags('Factories') factories(@Req() req: AuthenticatedRequest) { return this.management.listFactories(currentUser(req)); }
  @Get('factories/management-scope') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Factories') factoryManagementScope(@Req() req: AuthenticatedRequest) { return this.management.factoryManagementScope(currentUser(req)); }
  @Get('factories/managed') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Factories') managedFactories(@Req() req: AuthenticatedRequest, @Query() query: FactoryAdminQueryDto) { return this.management.managedFactoryPage(currentUser(req), query); }
  @Get('factories/managed/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Factories') managedFactoryDetail(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.factoryDetail(currentUser(req), params.id); }
  @Get('factories/:id/staff') @Roles(Role.FACTORY_OWNER) @ApiTags('Factories') factoryStaff(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.listFactoryStaff(currentUser(req), params.id); }
  @Post('factories/:id/staff') @Roles(Role.FACTORY_OWNER) @ApiTags('Factories') createFactoryStaff(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: CreateFactoryStaffDto) { return this.management.createFactoryStaff(currentUser(req), params.id, body); }
  @Patch('factories/:id/staff/:userId') @Roles(Role.FACTORY_OWNER) @ApiTags('Factories') updateFactoryStaff(@Req() req: AuthenticatedRequest, @Param() params: OpaqueUserIdParamDto, @Body() body: UpdateFactoryStaffDto) { return this.management.updateFactoryStaff(currentUser(req), params.id, params.userId, body); }
  @Get('factories/:id/wallet') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Factories') factoryWallet(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.factoryWallet(currentUser(req), params.id); }
  @Post('factories/:id/wallet/top-up') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Factories') factoryWalletTopUp(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: WalletTopUpDto) { return this.management.topUpFactoryWallet(currentUser(req), params.id, body.amount); }
  @Get('factories/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL, Role.EMPLOYEE) @ApiTags('Factories') factoryDetail(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.factoryDetail(currentUser(req), params.id); }
  @Post('factories/register') @Roles(Role.FACTORY_OWNER) @ApiTags('Factories') registerFactory(@Req() req: AuthenticatedRequest, @Body() body: RegisterFactoryDto) { return this.management.registerFactory(currentUser(req), body); }
  @Post('factories') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Factories') createFactory(@Req() req: AuthenticatedRequest, @Body() body: CreateFactoryDto) { return this.management.createFactory(currentUser(req), body); }
  @Put('factories/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Factories') updateFactory(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: UpdateFactoryDto) { return this.management.updateFactory(currentUser(req), params.id, body); }
  @Post('factories/:id/approve') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Factories') approveFactory(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.decideFactory(currentUser(req), params.id, true); }
  @Post('factories/:id/reject') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Factories') rejectFactory(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: ReasonDto) { return this.management.decideFactory(currentUser(req), params.id, false, body.reason); }

  @Get('gate-passes') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Gate passes') gatePasses(@Req() req: AuthenticatedRequest) { return this.management.listGatePasses(currentUser(req)); }
  @Get('gate-passes/by-qr/:code') @Roles(Role.SUPER_ADMIN, Role.SECURITY_GUARD) @ApiTags('Gate passes') gatePassByQr(@Req() req: AuthenticatedRequest, @Param() params: QrCodeParamDto) { return this.management.gatePassByQr(currentUser(req), params.code); }
  @Post('gate-passes') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Gate passes') createGatePass(@Req() req: AuthenticatedRequest, @Body() body: CreateGatePassDto) { return this.management.createGatePass(currentUser(req), body); }
  @Post('gate-passes/:id/approve') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Gate passes') approveGatePass(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.gatePassAction(currentUser(req), params.id, 'approve'); }
  @Post('gate-passes/:id/reject') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Gate passes') rejectGatePass(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: ReasonDto) { return this.management.gatePassAction(currentUser(req), params.id, 'reject', body.reason); }
  @Post('gate-passes/:id/verify') @Roles(Role.SUPER_ADMIN, Role.SECURITY_GUARD) @ApiTags('Gate passes') verifyGatePass(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.gatePassAction(currentUser(req), params.id, 'verify'); }
  @Post('gate-passes/:id/deny') @Roles(Role.SUPER_ADMIN, Role.SECURITY_GUARD) @ApiTags('Gate passes') denyGatePassExit(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: ReasonDto) { return this.management.gatePassAction(currentUser(req), params.id, 'deny', body.reason); }
  @Get('gate-passes/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Gate passes') gatePassDetail(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.gatePassDetail(currentUser(req), params.id); }

  @Get('invoices') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.GOVERNMENT_OFFICIAL) @ApiTags('Invoices') invoices(@Req() req: AuthenticatedRequest) { return this.management.listInvoices(currentUser(req)); }
  @Post('invoices') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Invoices') createInvoice(@Req() req: AuthenticatedRequest, @Body() body: CreateInvoiceDto) { return this.management.createInvoice(currentUser(req), body); }
  @Post('invoices/:id/pay') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Invoices') startPayment(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Headers('idempotency-key') idempotencyKey?: string) { return this.management.startPayment(currentUser(req), params.id, idempotencyKey); }

  @Get('requests') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.EMPLOYEE, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Requests') requests(@Req() req: AuthenticatedRequest) { return this.management.listRequests(currentUser(req)); }
  @Post('requests') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.EMPLOYEE) @ApiTags('Requests') createRequest(@Req() req: AuthenticatedRequest, @Body() body: CreateRequestDto) { return this.management.createRequest(currentUser(req), body); }
  @Post('requests/:id/approve') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.EMPLOYEE) @ApiTags('Requests') approveRequest(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.requestAction(currentUser(req), params.id, 'approve'); }
  @Post('requests/:id/reject') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.EMPLOYEE) @ApiTags('Requests') rejectRequest(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: ReasonDto) { return this.management.requestAction(currentUser(req), params.id, 'reject', body.reason); }

  @Get('announcements') @ApiTags('Announcements') announcements() { return this.management.announcements(); }
  @Post('announcements') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Announcements') createAnnouncement(@Req() req: AuthenticatedRequest, @Body() body: CreateAnnouncementDto) { return this.management.createAnnouncement(currentUser(req), body); }
  @Get('announcements/managed') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Announcements') managedAnnouncements(@Req() req: AuthenticatedRequest) { return this.management.managedAnnouncements(currentUser(req)); }
  @Put('announcements/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Announcements') updateAnnouncement(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: UpdateAnnouncementDto) { return this.management.updateAnnouncement(currentUser(req), params.id, body); }
  @Delete('announcements/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Announcements') deleteAnnouncement(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.deleteAnnouncement(currentUser(req), params.id); }

  @Public()
  @Get('advertisements') @ApiTags('Advertisements') advertisements() { return this.management.advertisements(); }
  @Get('advertisements/creation-scope') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Advertisements') advertisementCreationScope(@Req() req: AuthenticatedRequest) { return this.management.advertisementCreationScope(currentUser(req)); }
  @Post('advertisements') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER) @ApiTags('Advertisements') createAdvertisement(@Req() req: AuthenticatedRequest, @Body() body: CreateAdvertisementDto) { return this.management.createAdvertisement(currentUser(req), body); }
  @Get('advertisements/managed/pending') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Advertisements') managedPendingAdvertisements(@Req() req: AuthenticatedRequest) { return this.management.managedAdvertisements(currentUser(req), 'PENDING'); }
  @Get('advertisements/managed/history') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Advertisements') managedHistoryAdvertisements(@Req() req: AuthenticatedRequest) { return this.management.managedAdvertisements(currentUser(req), 'HISTORY'); }
  @Get('advertisements/managed') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Advertisements') managedAdvertisementPage(@Req() req: AuthenticatedRequest, @Query() query: AdvertisementAdminQueryDto) { return this.management.managedAdvertisementPage(currentUser(req), query); }
  @Get('advertisements/managed/:id') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Advertisements') managedAdvertisementDetail(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.managedAdvertisementDetail(currentUser(req), params.id); }
  @Post('advertisements/:id/approve') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Advertisements') approveAdvertisement(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto, @Body() body: AdvertisementModerationDto) { return this.management.approveAdvertisement(currentUser(req), params.id, body.approved, body.rejectionReason); }

  @Post('messages') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.EMPLOYEE) @ApiTags('Messages') sendDirectMessage(@Req() req: AuthenticatedRequest, @Body() body: SendDirectMessageDto) { return this.management.sendDirectMessage(currentUser(req), body); }
  @Post('messages/batch') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Messages') sendBatchMessage(@Req() req: AuthenticatedRequest, @Body() body: SendMessageDto) { return this.management.sendMessage(currentUser(req), body.recipientIds, body.subject, body.body); }
  @Get('messages/inbox') @ApiTags('Messages') inboxMessages(@Req() req: AuthenticatedRequest) { return this.management.inboxMessages(currentUser(req)); }
  @Get('messages/sent') @ApiTags('Messages') sentMessages(@Req() req: AuthenticatedRequest) { return this.management.sentMessages(currentUser(req)); }
  @Get('messages/unread-count') @ApiTags('Messages') unreadMessageCount(@Req() req: AuthenticatedRequest) { return this.management.unreadMessageCount(currentUser(req)); }
  @Post('messages/:id/read') @ApiTags('Messages') markMessageRead(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.markMessageRead(currentUser(req), params.id); }

  @Get('market-rates') @ApiTags('Market rates') marketRates() { return this.management.listMarketRates(); }
  @Put('market-rates/:key') @Roles(Role.SUPER_ADMIN) @ApiTags('Market rates') updateMarketRate(@Req() req: AuthenticatedRequest, @Param() params: MarketRateKeyParamDto, @Body() body: UpdateMarketRateDto) { return this.management.updateMarketRate(currentUser(req), params.key, body); }

  @Public()
  @Get('public/parks') @ApiTags('Public') publicParks() { return this.management.publicParks(); }
  @Public()
  @Get('public/factories') @ApiTags('Public') publicFactories() { return this.management.publicFactories(); }
  @Public()
  @Get('public/factories/:id') @ApiTags('Public') publicFactoryDetail(@Param() params: OpaqueIdParamDto) { return this.management.publicFactoryDetail(params.id); }
  @Public()
  @Get('public/shops') @ApiTags('Public') publicShops() { return this.management.publicShops(); }
  @Public()
  @Post('public/sms-requests') @ApiTags('Public') publicSmsRequest(@Body() body: PublicSmsRequestDto) { return this.management.createPublicSmsRequest(body); }

  @Get('reports') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.GOVERNMENT_OFFICIAL) @ApiTags('Reports') report(@Req() req: AuthenticatedRequest, @Query() query: ReportQueryDto) { return this.management.report(currentUser(req), query.type as 'financial' | 'gatepass' | 'requests', query.from, query.to); }

  @Get('sms/health') @Roles(Role.SUPER_ADMIN) @ApiTags('SMS') smsHealth() { return this.management.smsHealth(); }

  @Get('emergency') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Emergency') emergencies() { return this.management.emergencies(); }
  @Post('emergency') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD) @ApiTags('Emergency') createEmergency(@Req() req: AuthenticatedRequest, @Body() body: CreateEmergencyDto) { return this.management.createEmergency(currentUser(req), body); }
  @Post('emergency/:id/acknowledge') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.SECURITY_GUARD) @ApiTags('Emergency') acknowledgeEmergency(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.emergencyAction(currentUser(req), params.id, 'acknowledge'); }
  @Post('emergency/:id/resolve') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER) @ApiTags('Emergency') resolveEmergency(@Req() req: AuthenticatedRequest, @Param() params: OpaqueIdParamDto) { return this.management.emergencyAction(currentUser(req), params.id, 'resolve'); }

  @Get('analytics/dashboard') @Roles(Role.SUPER_ADMIN, Role.PARK_MANAGER, Role.FACTORY_OWNER, Role.SECURITY_GUARD, Role.GOVERNMENT_OFFICIAL) @ApiTags('Analytics') dashboard(@Req() req: AuthenticatedRequest) { return this.management.dashboard(currentUser(req)); }
}

@Controller('api/v1/invoices/payment')
export class PaymentCallbackController {
  constructor(private readonly management: ManagementService) {}

  @Get('callback')
  @ApiTags('Invoices')
  callback(@Query('Authority') authority: string, @Query('Status') status: string) { return this.management.verifyPayment(authority, status); }
}
