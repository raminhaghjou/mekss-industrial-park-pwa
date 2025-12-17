import { BadRequestException } from '@nestjs/common';
import { ERROR_CODES } from '../constants';

export class ValidationUtil {
  static validateNationalId(nationalId: string): boolean {
    if (!nationalId || nationalId.length !== 10) {
      return false;
    }

    const regex = /^\d{10}$/;
    if (!regex.test(nationalId)) {
      return false;
    }

    // Iranian National ID validation algorithm
    const check = parseInt(nationalId[9]);
    let sum = 0;
    
    for (let i = 0; i < 9; i++) {
      sum += parseInt(nationalId[i]) * (10 - i);
    }
    
    sum = sum % 11;
    
    if ((sum < 2 && check === sum) || (sum >= 2 && check + sum === 11)) {
      return true;
    }
    
    return false;
  }

  static validatePhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber) return false;
    
    // Iranian mobile phone number patterns
    const patterns = [
      /^09[0-9]{9}$/, // 09xxxxxxxxx
      /^\+989[0-9]{9}$/, // +989xxxxxxxxx
      /^00989[0-9]{9}$/, // 00989xxxxxxxxx
    ];
    
    return patterns.some(pattern => pattern.test(phoneNumber));
  }

  static normalizePhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) return '';
    
    // Remove all non-digit characters except +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // Convert to standard format (09xxxxxxxxx)
    if (normalized.startsWith('+989')) {
      normalized = '09' + normalized.substring(4);
    } else if (normalized.startsWith('00989')) {
      normalized = '09' + normalized.substring(5);
    } else if (normalized.startsWith('989')) {
      normalized = '09' + normalized.substring(3);
    } else if (normalized.startsWith('9')) {
      normalized = '0' + normalized;
    }
    
    return normalized;
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateIranianPostalCode(postalCode: string): boolean {
    if (!postalCode || postalCode.length !== 10) {
      return false;
    }
    
    const regex = /^\d{10}$/;
    return regex.test(postalCode);
  }

  static validatePersianText(text: string): boolean {
    if (!text) return false;
    
    // Persian/Farsi character range
    const persianRegex = /^[\u0600-\u06FF\uFB8A\u067E\u0686\u06AF\u200C\u0020\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0653\u0654\u0655\s]+$/;
    
    // Check if at least 50% of characters are Persian
    const persianChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const totalChars = text.replace(/\s/g, '').length;
    
    return totalChars === 0 || (persianChars / totalChars) >= 0.5;
  }

  static validateFileType(fileType: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(fileType);
  }

  static validateFileSize(fileSize: number, maxSize: number): boolean {
    return fileSize <= maxSize;
  }

  static generateRandomCode(length: number = 6): string {
    const digits = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return result;
  }

  static generateTrackingCode(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `${timestamp.slice(-6)}${random}`;
  }

  static formatNationalId(nationalId: string): string {
    if (!nationalId || nationalId.length !== 10) {
      throw new BadRequestException({
        message: 'کد ملی نامعتبر است',
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
    
    return nationalId;
  }

  static formatPhoneNumber(phoneNumber: string): string {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    
    if (!this.validatePhoneNumber(normalized)) {
      throw new BadRequestException({
        message: 'شماره تلفن نامعتبر است',
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
    }
    
    return normalized;
  }

  static extractNumbersFromText(text: string): string {
    return text.replace(/[^\d]/g, '');
  }

  static convertToEnglishNumbers(input: string): string {
    const persianNumbers = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    
    let result = input;
    
    // Convert Persian numbers
    persianNumbers.forEach((num, index) => {
      result = result.replace(new RegExp(num, 'g'), index.toString());
    });
    
    // Convert Arabic numbers
    arabicNumbers.forEach((num, index) => {
      result = result.replace(new RegExp(num, 'g'), index.toString());
    });
    
    return result;
  }

  static formatCurrency(amount: number, currency: string = 'ریال'): string {
    return new Intl.NumberFormat('fa-IR').format(amount) + ' ' + currency;
  }

  static formatDate(date: Date, format: string = 'YYYY/MM/DD'): string {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };

    const formatted = new Intl.DateTimeFormat('fa-IR', options).format(date);
    
    switch (format) {
      case 'YYYY/MM/DD':
        return formatted.split(' ')[0];
      case 'YYYY/MM/DD HH:mm':
        return formatted;
      case 'HH:mm:ss':
        return formatted.split(' ')[1];
      default:
        return formatted;
    }
  }

  static calculateAge(birthDate: Date): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  static isWorkingDay(date: Date): boolean {
    const day = date.getDay();
    return day >= 1 && day <= 5; // Monday to Friday (Iranian calendar)
  }

  static addWorkingDays(date: Date, days: number): Date {
    const result = new Date(date);
    let addedDays = 0;
    
    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      if (this.isWorkingDay(result)) {
        addedDays++;
      }
    }
    
    return result;
  }

  static getTimeDifference(date1: Date, date2: Date): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } {
    const diff = Math.abs(date1.getTime() - date2.getTime());
    
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
    };
  }

  static maskSensitiveData(data: string, maskChar: string = '*'): string {
    if (!data || data.length < 4) {
      return maskChar.repeat(data ? data.length : 3);
    }
    
    const visibleChars = 2;
    const maskedLength = data.length - visibleChars * 2;
    
    return data.substring(0, visibleChars) + 
           maskChar.repeat(maskedLength) + 
           data.substring(data.length - visibleChars);
  }

  static generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  static truncateText(text: string, maxLength: number, suffix: string = '...'): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('رمز عبور باید حداقل 8 کاراکتر باشد');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('رمز عبور باید حداقل یک حرف کوچک داشته باشد');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('رمز عبور باید حداقل یک حرف بزرگ داشته باشد');
    }
    
    if (!/\d/.test(password)) {
      errors.push('رمز عبور باید حداقل یک عدد داشته باشد');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('رمز عبور باید حداقل یک کاراکتر خاص داشته باشد');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
