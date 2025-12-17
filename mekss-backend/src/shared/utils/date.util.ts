import { Injectable } from '@nestjs/common';

@Injectable()
export class DateUtil {
  private readonly timezone = 'Asia/Tehran';

  constructor() {}

  getCurrentDate(): Date {
    return new Date();
  }

  getCurrentPersianDate(): string {
    const now = new Date();
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: this.timezone,
    }).format(now);
  }

  getCurrentPersianDateTime(): string {
    const now = new Date();
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: this.timezone,
    }).format(now);
  }

  convertToPersianDate(date: Date): string {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: this.timezone,
    }).format(date);
  }

  convertToPersianDateTime(date: Date): string {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: this.timezone,
    }).format(date);
  }

  convertToGregorianDate(persianDate: string): Date {
    // This is a simplified conversion - in production, use a proper Persian calendar library
    const parts = persianDate.split('/');
    if (parts.length !== 3) {
      throw new Error('Invalid Persian date format. Expected: YYYY/MM/DD');
    }

    const [year, month, day] = parts.map(Number);
    
    // Approximate conversion (Persian calendar is approximately 621 years behind Gregorian)
    const gregorianYear = year + 621;
    const gregorianMonth = month;
    const gregorianDay = day;

    return new Date(gregorianYear, gregorianMonth - 1, gregorianDay);
  }

  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  addHours(date: Date, hours: number): Date {
    const result = new Date(date);
    result.setHours(result.getHours() + hours);
    return result;
  }

  addMinutes(date: Date, minutes: number): Date {
    const result = new Date(date);
    result.setMinutes(result.getMinutes() + minutes);
    return result;
  }

  addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }

  getStartOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  getEndOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    result.setDate(diff);
    return this.getStartOfDay(result);
  }

  getEndOfWeek(date: Date): Date {
    const result = this.getStartOfWeek(date);
    result.setDate(result.getDate() + 6);
    return this.getEndOfDay(result);
  }

  getStartOfMonth(date: Date): Date {
    const result = new Date(date);
    result.setDate(1);
    return this.getStartOfDay(result);
  }

  getEndOfMonth(date: Date): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + 1, 0);
    return this.getEndOfDay(result);
  }

  getStartOfYear(date: Date): Date {
    const result = new Date(date);
    result.setMonth(0, 1);
    return this.getStartOfDay(result);
  }

  getEndOfYear(date: Date): Date {
    const result = new Date(date);
    result.setMonth(11, 31);
    return this.getEndOfDay(result);
  }

  isToday(date: Date): boolean {
    const today = this.getCurrentDate();
    return this.isSameDay(date, today);
  }

  isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  isSameMonth(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth();
  }

  isSameYear(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear();
  }

  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  isWorkingDay(date: Date): boolean {
    return !this.isWeekend(date);
  }

  getDaysBetween(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = this.getStartOfDay(date1);
    const secondDate = this.getStartOfDay(date2);
    
    return Math.round(Math.abs((firstDate.getTime() - secondDate.getTime()) / oneDay));
  }

  getBusinessDaysBetween(date1: Date, date2: Date): number {
    let count = 0;
    const startDate = new Date(Math.min(date1.getTime(), date2.getTime()));
    const endDate = new Date(Math.max(date1.getTime(), date2.getTime()));
    
    const current = new Date(startDate);
    
    while (current <= endDate) {
      if (this.isWorkingDay(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  addBusinessDays(date: Date, days: number): Date {
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

  getTimeDifference(date1: Date, date2: Date): {
    years: number;
    months: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } {
    const diff = Math.abs(date1.getTime() - date2.getTime());
    
    return {
      years: Math.floor(diff / (1000 * 60 * 60 * 24 * 365)),
      months: Math.floor(diff / (1000 * 60 * 60 * 24 * 30)) % 12,
      days: Math.floor(diff / (1000 * 60 * 60 * 24)) % 30,
      hours: Math.floor(diff / (1000 * 60 * 60)) % 24,
      minutes: Math.floor(diff / (1000 * 60)) % 60,
      seconds: Math.floor(diff / 1000) % 60,
    };
  }

  formatDuration(duration: { days?: number; hours?: number; minutes?: number; seconds?: number }): string {
    const parts = [];
    
    if (duration.days) parts.push(`${duration.days} روز`);
    if (duration.hours) parts.push(`${duration.hours} ساعت`);
    if (duration.minutes) parts.push(`${duration.minutes} دقیقه`);
    if (duration.seconds) parts.push(`${duration.seconds} ثانیه`);
    
    return parts.join(' و ') || '0 ثانیه';
  }

  isExpired(date: Date): boolean {
    return date.getTime() < this.getCurrentDate().getTime();
  }

  isValidDate(date: any): boolean {
    return date instanceof Date && !isNaN(date.getTime());
  }

  parseDate(dateString: string): Date {
    const date = new Date(dateString);
    if (!this.isValidDate(date)) {
      throw new Error('Invalid date format');
    }
    return date;
  }

  toISOString(date: Date): string {
    return date.toISOString();
  }

  toTimestamp(date: Date): number {
    return date.getTime();
  }

  fromTimestamp(timestamp: number): Date {
    return new Date(timestamp);
  }

  getAge(birthDate: Date): number {
    const today = this.getCurrentDate();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  getNextMonth(date: Date): Date {
    return this.addMonths(date, 1);
  }

  getPreviousMonth(date: Date): Date {
    return this.addMonths(date, -1);
  }

  getMonthsBetween(date1: Date, date2: Date): number {
    const yearDiff = date2.getFullYear() - date1.getFullYear();
    const monthDiff = date2.getMonth() - date1.getMonth();
    
    return yearDiff * 12 + monthDiff;
  }

  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  getDaysInYear(year: number): number {
    return this.isLeapYear(year) ? 366 : 365;
  }

  getQuarter(date: Date): number {
    return Math.floor(date.getMonth() / 3) + 1;
  }

  getStartOfQuarter(date: Date): Date {
    const quarter = this.getQuarter(date);
    const month = (quarter - 1) * 3;
    return new Date(date.getFullYear(), month, 1);
  }

  getEndOfQuarter(date: Date): Date {
    const quarter = this.getQuarter(date);
    const month = quarter * 3;
    return new Date(date.getFullYear(), month, 0);
  }

  isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
    return date >= startDate && date <= endDate;
  }

  getNearestWorkingDay(date: Date, direction: 'next' | 'previous' = 'next'): Date {
    const result = new Date(date);
    
    while (!this.isWorkingDay(result)) {
      if (direction === 'next') {
        result.setDate(result.getDate() + 1);
      } else {
        result.setDate(result.getDate() - 1);
      }
    }
    
    return result;
  }

  getWorkingDaysInMonth(year: number, month: number): number {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    return this.getBusinessDaysBetween(startDate, endDate);
  }

  getFirstWorkingDayOfMonth(date: Date): Date {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    return this.getNearestWorkingDay(firstDay, 'next');
  }

  getLastWorkingDayOfMonth(date: Date): Date {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return this.getNearestWorkingDay(lastDay, 'previous');
  }

  isMorning(date: Date): boolean {
    const hour = date.getHours();
    return hour >= 6 && hour < 12;
  }

  isAfternoon(date: Date): boolean {
    const hour = date.getHours();
    return hour >= 12 && hour < 18;
  }

  isEvening(date: Date): boolean {
    const hour = date.getHours();
    return hour >= 18 && hour < 24;
  }

  isNight(date: Date): boolean {
    const hour = date.getHours();
    return hour >= 0 && hour < 6;
  }

  getTimeOfDay(date: Date): 'morning' | 'afternoon' | 'evening' | 'night' {
    if (this.isMorning(date)) return 'morning';
    if (this.isAfternoon(date)) return 'afternoon';
    if (this.isEvening(date)) return 'evening';
    return 'night';
  }
}
