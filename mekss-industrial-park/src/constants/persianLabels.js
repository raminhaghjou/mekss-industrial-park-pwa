/**
 * Canonical Persian labels for backend enums (roles, statuses, priorities,
 * request types). Centralizes the maps that were previously duplicated with
 * slightly different wording per page, so every surface describes the same
 * enum value the same way. Pages may still keep a local color map (MUI chip
 * colors are a presentation choice, not a translation), but the label text
 * itself should come from here.
 */

export const roleLabels = {
  SUPER_ADMIN: 'مدیر کل سامانه',
  PARK_MANAGER: 'مدیر شهرک',
  FACTORY_OWNER: 'مالک واحد صنعتی',
  SECURITY_GUARD: 'نگهبان',
  GOVERNMENT_OFFICIAL: 'نماینده دولت',
  EMPLOYEE: 'کارمند',
};

export const requestStatusLabels = {
  PENDING: 'در انتظار',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
  CANCELLED: 'لغو شده',
};

export const requestTypeLabels = {
  MISSION: 'ماموریت',
  TRANSFER: 'انتقال',
  DAILY_LEAVE: 'مرخصی روزانه',
  HOURLY_LEAVE: 'مرخصی ساعتی',
  LOAN: 'وام',
  SETTLEMENT: 'تسویه حساب',
  CONSTRUCTION_PERMIT: 'مجوز ساخت',
  FINAL_INSPECTION: 'بازرسی نهایی',
  APPOINTMENT: 'وقت ملاقات',
  SERVICE_ORDER: 'سفارش خدمات',
  OTHER: 'سایر',
};

export const requestPriorityLabels = {
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'زیاد',
  URGENT: 'فوری',
};

export const invoiceStatusLabels = {
  PENDING: 'پرداخت نشده',
  PAID: 'پرداخت شده',
  OVERDUE: 'سررسید گذشته',
  CANCELLED: 'لغو شده',
};

export const gatePassStatusLabels = {
  PENDING: 'در انتظار',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
  COMPLETED: 'تکمیل شده',
  EXPIRED: 'منقضی شده',
};

export const factoryStatusLabels = {
  PENDING: 'در انتظار بررسی',
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
  SUSPENDED: 'معلق',
};

export const advertisementStatusLabels = {
  PENDING: 'در انتظار بررسی',
  APPROVED: 'تایید شده',
  REJECTED: 'رد شده',
  EXPIRED: 'منقضی شده',
};

export const parkStatusLabels = {
  ACTIVE: 'فعال',
  INACTIVE: 'غیرفعال',
};

export const messageStatusLabels = {
  UNREAD: 'خوانده‌نشده',
  READ: 'خوانده‌شده',
  ARCHIVED: 'بایگانی',
};

export const marketRateKeyLabels = {
  USD: 'دلار آمریکا',
  EUR: 'یورو',
  CNY: 'یوان چین',
  IRON: 'آهن',
  GOLD: 'طلا',
  SILVER: 'نقره',
  PLATINUM: 'پلاتین',
  COIN: 'سکه',
};

/**
 * Looks up a label by enum value, falling back to the raw value (rather than
 * a hidden empty string) so an unmapped enum value stays visible/debuggable
 * instead of silently disappearing from the UI.
 * @param {Record<string, string>} map
 * @param {string | undefined | null} value
 * @returns {string}
 */
export const labelFor = (map, value) => (value ? map[value] || value : '');
