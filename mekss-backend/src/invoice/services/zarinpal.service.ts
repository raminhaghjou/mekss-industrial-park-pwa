import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Zarinpal from 'zarinpal-checkout';
import { LoggerService } from '../../shared/services/logger.service';

interface PaymentRequestData {
  amount: number;
  description: string;
  invoiceId: string;
  factoryId: string;
  userId: string;
}

interface PaymentVerificationData {
  authority: string;
  invoiceId: string;
}

@Injectable()
export class ZarinpalService {
  private readonly zarinpal: any;
  private readonly merchantId: string;
  private readonly callbackUrl: string;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    this.merchantId = this.configService.get<string>('ZARINPAL_MERCHANT_ID') || 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX';
    this.callbackUrl = this.configService.get<string>('ZARINPAL_CALLBACK_URL') || 'http://localhost:3000/api/v1/invoices/payment/verify';

    this.zarinpal = Zarinpal.create(this.merchantId, this.configService.get<boolean>('ZARINPAL_SANDBOX') || true);
  }

  async createPaymentRequest(data: PaymentRequestData): Promise<any> {
    try {
      const paymentRequest = {
        Amount: data.amount, // Amount in Rials
        CallbackURL: this.callbackUrl,
        Description: data.description,
        Email: '', // Optional
        Mobile: '', // Optional
        InvoiceId: data.invoiceId,
      };

      const result = await new Promise<any>((resolve, reject) => {
        this.zarinpal.PaymentRequest(paymentRequest, (status, authority, url) => {
          if (status === 100) {
            resolve({
              success: true,
              status,
              authority,
              paymentUrl: url,
              message: 'Payment request created successfully',
            });
          } else {
            reject({
              success: false,
              status,
              message: 'Payment request failed',
              error: this.getStatusMessage(status),
            });
          }
        });
      });

      this.logger.log(`Payment request created for invoice ${data.invoiceId}, authority: ${result.authority}`);
      
      // Store payment data for verification
      // In production, use Redis or database
      this.storePaymentData(result.authority, {
        invoiceId: data.invoiceId,
        factoryId: data.factoryId,
        userId: data.userId,
        amount: data.amount,
      });

      return result;
    } catch (error) {
      this.logger.error(`Failed to create payment request for invoice ${data.invoiceId}`, error);
      throw new Error('Payment request failed');
    }
  }

  async verifyPayment(authority: string): Promise<any> {
    try {
      // Retrieve payment data
      const paymentData = this.getPaymentData(authority);
      
      if (!paymentData) {
        throw new Error('Payment data not found');
      }

      const verificationRequest = {
        Authority: authority,
        Amount: paymentData.amount,
      };

      const result = await new Promise<any>((resolve, reject) => {
        this.zarinpal.PaymentVerification(verificationRequest, (status, refId) => {
          if (status === 100) {
            resolve({
              success: true,
              status,
              refId,
              invoiceId: paymentData.invoiceId,
              message: 'Payment verified successfully',
            });
          } else {
            reject({
              success: false,
              status,
              message: 'Payment verification failed',
              error: this.getStatusMessage(status),
            });
          }
        });
      });

      this.logger.log(`Payment verified for invoice ${paymentData.invoiceId}, refId: ${result.refId}`);
      
      // Clean up stored payment data
      this.clearPaymentData(authority);

      return result;
    } catch (error) {
      this.logger.error(`Failed to verify payment for authority ${authority}`, error);
      throw new Error('Payment verification failed');
    }
  }

  private storePaymentData(authority: string, data: any): void {
    // In production, use Redis or database
    // For now, using in-memory storage (not suitable for production)
    if (!(global as any).paymentDataStore) {
      (global as any).paymentDataStore = new Map();
    }
    (global as any).paymentDataStore.set(authority, data);
  }

  private getPaymentData(authority: string): any {
    return (global as any).paymentDataStore?.get(authority);
  }

  private clearPaymentData(authority: string): void {
    (global as any).paymentDataStore?.delete(authority);
  }

  private getStatusMessage(status: number): string {
    const statusMessages: { [key: number]: string } = {
      100: 'عملیات موفق',
      101: 'عملیات انجام شده است',
      200: 'مشکل در پردازش اطلاعات ارسالی',
      201: 'کد پذیرنده اشتباه است',
      202: 'پیغام ارسالی خالی است',
      203: 'طول پیغام ارسالی زیاد است',
      204: 'فرمت اطلاعات ارسالی اشتباه است',
      205: 'اطلاعات ارسالی ناقص است',
      206: 'آدرس بازگشت ارسالی خالی است',
      207: 'طول آدرس بازگشت ارسالی زیاد است',
      208: 'آدرس بازگشت ارسالی اشتباه است',
      209: 'شماره موبایل ارسالی اشتباه است',
      210: 'شماره پذیرنده اشتباه است',
      211: 'تراکنش یافت نشد',
      212: 'طول تراکنش زیاد است',
      213: 'مبلغ تراکنش ارسالی کمتر از حد مجاز است',
      214: 'مبلغ تراکنش ارسالی زیادتر از حد مجاز است',
      215: 'مبلغ تراکنش ارسالی با مبلغ تراکنش تایید شده یکسان نیست',
      216: 'شماره فاکتور ارسالی اشتباه است',
      217: 'طول شماره فاکتور ارسالی زیاد است',
      218: 'فروشگاه یافت نشد',
      219: 'شماره تراکنش ارسالی اشتباه است',
      220: 'طول شماره تراکنش ارسالی زیاد است',
      221: 'آدرس IP پذیرنده اشتباه است',
      222: 'شماره سفارش ارسالی اشتباه است',
      223: 'طول شماره سفارش ارسالی زیاد است',
      224: 'شماره سفارش ارسالی خالی است',
      225: 'طول شماره سفارش ارسالی زیاد است',
      226: 'شماره سفارش ارسالی تکراری است',
      227: 'شماره سفارش ارسالی نامعتبر است',
      228: 'شماره سفارش ارسالی با شماره سفارش تایید شده یکسان نیست',
      229: 'مبلغ سفارش ارسالی کمتر از حد مجاز است',
      230: 'مبلغ سفارش ارسالی زیادتر از حد مجاز است',
      231: 'مبلغ سفارش ارسالی با مبلغ سفارش تایید شده یکسان نیست',
    };

    return statusMessages[status] || 'خطای ناشناخته';
  }
}