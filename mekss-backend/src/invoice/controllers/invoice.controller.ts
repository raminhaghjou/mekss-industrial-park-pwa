import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoiceService } from '../services/invoice.service';
import { ZarinpalService } from '../services/zarinpal.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role, InvoiceStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { PayInvoiceDto } from '../dto/pay-invoice.dto';

@ApiTags('Invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/invoices')
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly zarinpalService: ZarinpalService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all invoices with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'factoryId', required: false, type: String })
  async findAll(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('status') status?: InvoiceStatus,
    @Query('factoryId') factoryId?: string,
  ) {
    const filters = {
      status,
      factoryId,
    };

    return this.invoiceService.findAll(req.user, {
      page,
      limit,
      filters,
    });
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiResponse({ status: 200, description: 'Invoice retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.invoiceService.findOne(id, req.user);
  }

  @Post()
  @Roles(Role.PARK_MANAGER, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new invoice' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(@Body() createInvoiceDto: CreateInvoiceDto, @Request() req) {
    return this.invoiceService.create(createInvoiceDto, req.user);
  }

  @Put(':id')
  @Roles(Role.PARK_MANAGER, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update invoice' })
  @ApiResponse({ status: 200, description: 'Invoice updated successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async update(@Param('id') id: string, @Body() updateData: any, @Request() req) {
    return this.invoiceService.update(id, updateData, req.user);
  }

  @Put(':id/pay')
  @Roles(Role.FACTORY_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pay invoice via ZarinPal' })
  @ApiResponse({ status: 200, description: 'Payment initiated successfully' })
  @ApiResponse({ status: 400, description: 'Payment failed' })
  async pay(
    @Param('id') id: string,
    @Body() payInvoiceDto: PayInvoiceDto,
    @Request() req,
    @Res() res: Response,
  ) {
    const result = await this.invoiceService.initiatePayment(id, payInvoiceDto, req.user);
    
    if (result.paymentUrl) {
      // Redirect to ZarinPal payment page
      res.redirect(result.paymentUrl);
    } else {
      res.json(result);
    }
  }

  @Get('payment/verify')
  @ApiOperation({ summary: 'Verify ZarinPal payment callback' })
  @ApiResponse({ status: 200, description: 'Payment verified successfully' })
  @ApiResponse({ status: 400, description: 'Payment verification failed' })
  async verifyPayment(
    @Query('Authority') authority: string,
    @Query('Status') status: string,
    @Res() res: Response,
  ) {
    const result = await this.invoiceService.verifyPayment(authority, status);
    
    // Redirect to frontend with payment result
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/invoices?payment=${result.success ? 'success' : 'failed'}`);
  }

  @Get(':id/download')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download invoice as PDF' })
  @ApiResponse({ status: 200, description: 'PDF generated successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async download(
    @Param('id') id: string,
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const pdfBuffer = await this.invoiceService.generatePdf(id, req.user);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${id}.pdf"`,
    });

    return new StreamableFile(pdfBuffer);
  }

  @Get('stats/summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get invoice statistics summary' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(@Request() req) {
    return this.invoiceService.getStats(req.user);
  }

  @Get('payment/methods')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available payment methods' })
  @ApiResponse({ status: 200, description: 'Payment methods retrieved successfully' })
  async getPaymentMethods(@Request() req) {
    return this.invoiceService.getPaymentMethods();
  }

  @Delete(':id')
  @Roles(Role.PARK_MANAGER, Role.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete invoice (soft delete)' })
  @ApiResponse({ status: 200, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async remove(@Param('id') id: string, @Request() req) {
    return this.invoiceService.remove(id, req.user);
  }
}