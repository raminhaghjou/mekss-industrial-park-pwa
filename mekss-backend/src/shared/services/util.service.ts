import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UtilService {
  generateOtp(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  }

  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  generateInvoiceNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${timestamp}-${random}`;
  }

  generateGatePassNumber(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `GP-${timestamp}-${random}`;
  }

  generateQrCodeData(gatePassId: string, factoryId: string): string {
    const data = {
      id: gatePassId,
      factoryId,
      timestamp: Date.now(),
    };
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fa-IR').format(amount);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  calculateAge(birthDate: Date): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  isValidIranianNationalId(nationalId: string): boolean {
    if (!/^\d{10}$/.test(nationalId)) {
      return false;
    }

    const digits = nationalId.split('').map(Number);
    const lastDigit = digits[9];
    let sum = 0;

    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }

    const remainder = sum % 11;
    const controlDigit = remainder < 2 ? remainder : 11 - remainder;

    return controlDigit === lastDigit;
  }

  isValidPhoneNumber(phoneNumber: string): boolean {
    return /^09\d{9}$/.test(phoneNumber);
  }

  sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .toLowerCase();
  }

  getFileExtension(fileName: string): string {
    return path.extname(fileName).toLowerCase();
  }

  ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length === 11) {
      return phoneNumber.substring(0, 4) + '****' + phoneNumber.substring(8);
    }
    return phoneNumber;
  }

  maskNationalId(nationalId: string): string {
    if (nationalId.length === 10) {
      return nationalId.substring(0, 3) + '****' + nationalId.substring(7);
    }
    return nationalId;
  }
}