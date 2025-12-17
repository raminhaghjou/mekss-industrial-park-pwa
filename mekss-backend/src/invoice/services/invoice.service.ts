import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { SmsService } from '../../shared/services/sms.service';
import { QueueService } from '../../shared/services/queue.service';
import { UtilService } from '../../shared/services/util.service';
import { InvoiceStatus, Role } from '@prisma/client';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';

interface PaginationOptions {
  page: number;
  limit: number;
  filters?: any;
}

@Injectable()
export class InvoiceService {
  constructor(
    private prisma: PrismaService,
    private smsService: SmsService,
    private queueService: QueueService,
    private utilService: UtilService,
  ) {}

  async findAll(user: any, options: PaginationOptions) {
    const { page, limit, filters = {} } = options;
    const skip = (page - 1) * limit;

    // Build where clause based on user role and filters
    const where: any = {};

    if (user.role === Role.FACTORY_MANAGER) {
      where.factoryId = user.factoryId;
    } else if (user.role === Role.PARK_MANAGER) {
      // Get factories in user's park
      const factories = await this.prisma.factory.findMany({
        where: { parkId: user.parkId },
        select: { id: true },
      });
      where.factoryId = { in: factories.map(f => f.id) };
    }

    // Apply filters
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.factoryId) {
      where.factoryId = filters.factoryId;
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          factory: {
            select: {
              id: true,
              name: true,
              licenseNumber: true,
              phoneNumber: true,
              email: true,
              manager: {
                select: {
                  name: true,
                  phoneNumber: true,
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        factory: {
          select: {
            id: true,
            name: true,
            licenseNumber: true,
            phoneNumber: true,
            email: true,
            address: true,
            manager: {
              select: {
                name: true,
                phoneNumber: true,
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        paidBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Check access permissions
    if (user.role === Role.FACTORY_MANAGER && invoice.factoryId !== user.factoryId) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === Role.PARK_MANAGER) {
      const factory = await this.prisma.factory.findUnique({
        where: { id: invoice.factoryId },
      });
      if (factory?.parkId !== user.parkId) {
        throw new ForbiddenException('Access denied');
      }
    }

    return invoice;
  }

  async create(createInvoiceDto: CreateInvoiceDto, user: any) {
    // Validate factory access
    if (user.role === Role.PARK_MANAGER) {
      const factory = await this.prisma.factory.findUnique({
        where: { id: createInvoiceDto.factoryId },
      });
      if (factory?.parkId !== user.parkId) {
        throw new ForbiddenException('Access denied');
      }
    }

    // Calculate tax (9% VAT in Iran)
    const taxRate = 0.09;
    const taxAmount = createInvoiceDto.amount * taxRate;
    const totalAmount = createInvoiceDto.amount + taxAmount;

    // Generate invoice number
    const invoiceNumber = this.utilService.generateInvoiceNumber();

    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        amount: createInvoiceDto.amount,
        taxAmount,
        totalAmount,
        description: createInvoiceDto.description,
        dueDate: createInvoiceDto.dueDate,
        factoryId: createInvoiceDto.factoryId,
        createdById: user.id,
      },
      include: {
        factory: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
            manager: {
              select: {
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    // Send SMS notification to factory
    if (invoice.factory.phoneNumber) {
      const message = `فاکتور شماره ${invoiceNumber} به مبلغ ${this.utilService.formatCurrency(totalAmount)} ریال صادر شد. تاریخ سررسید: ${this.utilService.formatDate(invoice.dueDate)}`;
      await this.smsService.sendInvoiceNotification(
        invoice.factory.phoneNumber,
        invoiceNumber,
        totalAmount,
      );
    }

    // Add notification job
    await this.queueService.addNotificationJob({
      userId: invoice.factory.managerId || invoice.factoryId,
      title: 'فاکتور جدید',
      message: `فاکتور شماره ${invoiceNumber} به مبلغ ${this.utilService.formatCurrency(totalAmount)} ریال صادر شد.`,
      type: 'info',
    });

    return invoice;
  }

  async update(id: string, updateData: any, user: any) {
    const invoice = await this.findOne(id, user);

    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Cannot update paid/overdue invoice');
    }

    // Recalculate amounts if amount is changed
    if (updateData.amount) {
      const taxRate = 0.09;
      updateData.taxAmount = updateData.amount * taxRate;
      updateData.totalAmount = updateData.amount + updateData.taxAmount;
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        factory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated;
  }

  async initiatePayment(id: string, payInvoiceDto: any, user: any) {
    const invoice = await this.findOne(id, user);

    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Invoice is not pending payment');
    }

    if (user.role === Role.FACTORY_MANAGER && invoice.factoryId !== user.factoryId) {
      throw new ForbiddenException('Access denied');
    }

    // Update invoice with payment method
    await this.prisma.invoice.update({
      where: { id },
      data: {
        paymentMethod: payInvoiceDto.paymentMethod || 'ONLINE',
      },
    });

    // Create payment request with ZarinPal
    const paymentData = {
      amount: invoice.totalAmount,
      description: `پرداخت فاکتور ${invoice.invoiceNumber}`,
      invoiceId: invoice.id,
      factoryId: invoice.factoryId,
      userId: user.id,
    };

    const paymentResult = await this.zarinpalService.createPaymentRequest(paymentData);

    if (paymentResult.success && paymentResult.paymentUrl) {
      return {
        success: true,
        paymentUrl: paymentResult.paymentUrl,
        authority: paymentResult.authority,
        message: 'Redirecting to payment gateway',
      };
    } else {
      throw new BadRequestException('Payment initiation failed');
    }
  }

  async verifyPayment(authority: string, status: string) {
    if (status !== 'OK') {
      return {
        success: false,
        message: 'Payment cancelled by user',
        authority,
      };
    }

    const verificationResult = await this.zarinpalService.verifyPayment(authority);

    if (verificationResult.success) {
      // Update invoice status
      await this.prisma.invoice.update({
        where: { id: verificationResult.invoiceId },
        data: {
          status: InvoiceStatus.PAID,
          paymentDate: new Date(),
          paymentRef: verificationResult.refId,
        },
      });

      // Get invoice details for notifications
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: verificationResult.invoiceId },
        include: {
          factory: {
            select: {
              phoneNumber: true,
              manager: {
                select: {
                  phoneNumber: true,
                },
              },
            },
          },
        },
      });

      // Send SMS notification
      if (invoice?.factory?.phoneNumber) {
        const message = `پرداخت فاکتور شماره ${invoice.invoiceNumber} به مبلغ ${this.utilService.formatCurrency(invoice.totalAmount)} ریال با موفقیت انجام شد.`;
        await this.smsService.sendSms({
          phoneNumber: invoice.factory.phoneNumber,
          message,
        });
      }

      // Add notification job
      await this.queueService.addNotificationJob({
        userId: invoice?.factory?.managerId || invoice?.factoryId || '',
        title: 'پرداخت موفق',
        message: `پرداخت فاکتور شماره ${invoice?.invoiceNumber} با موفقیت انجام شد.`,
        type: 'success',
      });
    }

    return verificationResult;
  }

  async generatePdf(id: string, user: any) {
    const invoice = await this.findOne(id, user);

    // Generate PDF content
    // This is a simplified version - in production, use a PDF library like Puppeteer or jsPDF
    const pdfContent = {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      factory: invoice.factory,
      amount: invoice.amount,
      taxAmount: invoice.taxAmount,
      totalAmount: invoice.totalAmount,
      description: invoice.description,
      status: invoice.status,
    };

    // For now, return a simple text representation
    // In production, use a proper PDF generation library
    const pdfText = `
      فاکتور شماره: ${pdfContent.invoiceNumber}
      تاریخ صدور: ${this.utilService.formatDate(pdfContent.issueDate)}
      تاریخ سررسید: ${this.utilService.formatDate(pdfContent.dueDate)}
      
      اطلاعات کارخانه:
      نام: ${pdfContent.factory.name}
      شماره مجوز: ${pdfContent.factory.licenseNumber}
      
      اطلاعات فاکتور:
      مبلغ: ${this.utilService.formatCurrency(pdfContent.amount)} ریال
      مالیات (9%): ${this.utilService.formatCurrency(pdfContent.taxAmount)} ریال
      مبلغ کل: ${this.utilService.formatCurrency(pdfContent.totalAmount)} ریال
      
      توضیحات: ${pdfContent.description}
      وضعیت: ${pdfContent.status}
    `;

    return Buffer.from(pdfText, 'utf-8');
  }

  async getStats(user: any) {
    const where: any = {};

    if (user.role === Role.FACTORY_MANAGER) {
      where.factoryId = user.factoryId;
    } else if (user.role === Role.PARK_MANAGER) {
      const factories = await this.prisma.factory.findMany({
        where: { parkId: user.parkId },
        select: { id: true },
      });
      where.factoryId = { in: factories.map(f => f.id) };
    }

    const stats = await this.prisma.invoice.groupBy({
      by: ['status'],
      where,
      _count: {
        status: true,
      },
      _sum: {
        totalAmount: true,
      },
    });

    const total = await this.prisma.invoice.count({ where });
    const totalAmount = await this.prisma.invoice.aggregate({
      where,
      _sum: {
        totalAmount: true,
      },
    });

    const pendingAmount = await this.prisma.invoice.aggregate({
      where: {
        ...where,
        status: InvoiceStatus.PENDING,
      },
      _sum: {
        totalAmount: true,
      },
    });

    const statusMap = {
      [InvoiceStatus.PENDING]: 0,
      [InvoiceStatus.PAID]: 0,
      [InvoiceStatus.OVERDUE]: 0,
      [InvoiceStatus.CANCELLED]: 0,
    };

    const amountMap = {
      [InvoiceStatus.PENDING]: 0,
      [InvoiceStatus.PAID]: 0,
      [InvoiceStatus.OVERDUE]: 0,
      [InvoiceStatus.CANCELLED]: 0,
    };

    stats.forEach(stat => {
      statusMap[stat.status] = stat._count.status;
      amountMap[stat.status] = stat._sum.totalAmount || 0;
    });

    return {
      total,
      totalAmount: totalAmount._sum.totalAmount || 0,
      pendingAmount: pendingAmount._sum.totalAmount || 0,
      byStatus: statusMap,
      amountsByStatus: amountMap,
    };
  }

  async getPaymentMethods() {
    return [
      {
        id: 'ONLINE',
        name: 'پرداخت آنلاین',
        description: 'پرداخت از طریق درگاه زرین پال',
        enabled: true,
      },
      {
        id: 'CASH',
        name: 'پرداخت نقدی',
        description: 'پرداخت حضوری در دفتر مدیریت',
        enabled: true,
      },
      {
        id: 'BANK_TRANSFER',
        name: 'انتقال بانکی',
        description: 'پرداخت از طریق کارت به کارت',
        enabled: true,
      },
      {
        id: 'CHECK',
        name: 'چک',
        description: 'پرداخت با چک بانکی',
        enabled: true,
      },
    ];
  }

  async remove(id: string, user: any) {
    const invoice = await this.findOne(id, user);

    if (invoice.status !== InvoiceStatus.PENDING) {
      throw new BadRequestException('Cannot delete paid/overdue invoice');
    }

    // Soft delete by updating status
    const deleted = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.CANCELLED,
        description: `${invoice.description} (Cancelled)`,
      },
    });

    return {
      message: 'Invoice deleted successfully',
      data: deleted,
    };
  }
}