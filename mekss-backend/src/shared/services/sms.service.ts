import { Injectable } from '@nestjs/common';
import * as KavehNegar from 'kavenegar';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';

export interface SmsOptions {
  receptor: string;
  message: string;
  sender?: string;
}

@Injectable()
export class SmsService {
  private readonly kavehNegar: any;
  private readonly sender: string;

  constructor(
    private configService: ConfigService,
    private logger: LoggerService,
  ) {
    const apiKey = this.configService.get<string>('KAVEH_NEGAR_API_KEY');
    this.sender = this.configService.get<string>('SMS_SENDER') || '1000596446';

    if (!apiKey) {
      this.logger.warn('Kaveh Negar API key not configured');
      return;
    }

    this.kavehNegar = KavehNegar.KavenegarApi({
      apikey: apiKey,
    });
  }

  async sendSms(options: SmsOptions): Promise<boolean> {
    try {
      if (!this.kavehNegar) {
        this.logger.warn('SMS service not configured, skipping send');
        return false;
      }

      const result = await new Promise<any>((resolve, reject) => {
        this.kavehNegar.Send({
          message: options.message,
          sender: options.sender || this.sender,
          receptor: options.receptor,
        }, (response: any, status: any) => {
          if (status === 200) {
            resolve(response);
          } else {
            reject(response);
          }
        });
      });

      this.logger.log(`SMS sent successfully to ${options.receptor}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${options.receptor}`, error);
      return false;
    }
  }

  async sendOtp(phoneNumber: string, code: string): Promise<boolean> {
    const message = `کد تایید شما در سامانه مکص: ${code} \n این کد تا 5 دقیقه معتبر است.`;
    return this.sendSms({
      receptor: phoneNumber,
      message,
    });
  }

  async sendInvoiceNotification(phoneNumber: string, invoiceNumber: string, amount: number): Promise<boolean> {
    const message = `فاکتور شماره ${invoiceNumber} به مبلغ ${amount.toLocaleString()} ریال صادر شد. لطفاً نسبت به پرداخت اقدام فرمایید.`;
    return this.sendSms({
      receptor: phoneNumber,
      message,
    });
  }

  async sendGatePassNotification(phoneNumber: string, gatePassNumber: string, status: string): Promise<boolean> {
    const statusText = status === 'APPROVED' ? 'تایید شد' : 'رد شد';
    const message = `برگ خروج شماره ${gatePassNumber} ${statusText}.`;
    return this.sendSms({
      receptor: phoneNumber,
      message,
    });
  }

  async sendRequestNotification(phoneNumber: string, requestType: string, status: string): Promise<boolean> {
    const statusText = status === 'APPROVED' ? 'تایید شد' : status === 'REJECTED' ? 'رد شد' : 'در حال بررسی';
    const message = `درخواست ${requestType} شما ${statusText}.`;
    return this.sendSms({
      receptor: phoneNumber,
      message,
    });
  }
}