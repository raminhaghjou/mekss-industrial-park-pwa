import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsGateway {
  private readonly logger = new Logger(SmsGateway.name);

  constructor(private readonly config: ConfigService) {}

  async sendOtp(phoneNumber: string, code: string): Promise<void> {
    const provider = this.config.get<string>('SMS_PROVIDER', 'mock').toLowerCase();
    if (provider === 'mock') {
      this.logger.log(`Mock OTP generated for ${this.mask(phoneNumber)}.`);
      if (this.config.get<string>('NODE_ENV') !== 'production') this.logger.debug(`Mock OTP code: ${code}`);
      return;
    }

    if (provider !== 'kavenegar') {
      throw new ServiceUnavailableException('Unsupported SMS provider configuration');
    }

    const apiKey = this.config.get<string>('KAVEH_NEGAR_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('Kavenegar is not configured');

    const template = this.config.get<string>('KAVEH_NEGAR_TEMPLATE');
    const endpoint = template
      ? `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json`
      : `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`;
    const payload = template
      ? { receptor: phoneNumber, token: code, template }
      : { receptor: phoneNumber, message: `کد تایید MEKSS: ${code}`, sender: this.config.get<string>('SMS_SENDER') };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.entries(payload).filter(([, value]) => Boolean(value)) as [string, string][]),
    });
    if (!response.ok) {
      this.logger.error(`Kavenegar rejected OTP delivery to ${this.mask(phoneNumber)} with ${response.status}.`);
      throw new ServiceUnavailableException('OTP delivery failed');
    }
  }

  async sendText(phoneNumber: string, message: string): Promise<void> {
    const provider = this.config.get<string>('SMS_PROVIDER', 'mock').toLowerCase();
    if (provider === 'mock') {
      this.logger.log(`Mock SMS to ${this.mask(phoneNumber)}: ${message.slice(0, 80)}`);
      return;
    }

    if (provider !== 'kavenegar') {
      throw new ServiceUnavailableException('Unsupported SMS provider configuration');
    }

    const apiKey = this.config.get<string>('KAVEH_NEGAR_API_KEY');
    if (!apiKey) throw new ServiceUnavailableException('Kavenegar is not configured');

    const endpoint = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`;
    const payload = {
      receptor: phoneNumber,
      message,
      sender: this.config.get<string>('SMS_SENDER'),
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(Object.entries(payload).filter(([, value]) => Boolean(value)) as [string, string][]),
    });
    if (!response.ok) {
      this.logger.error(`Kavenegar rejected SMS delivery to ${this.mask(phoneNumber)} with ${response.status}.`);
      throw new ServiceUnavailableException('SMS delivery failed');
    }
  }

  private mask(phoneNumber: string): string {
    return phoneNumber.length < 5 ? '***' : `${phoneNumber.slice(0, 4)}***${phoneNumber.slice(-2)}`;
  }
}
