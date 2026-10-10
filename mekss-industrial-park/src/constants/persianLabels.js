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
  AWAITING_CONFIRMATION: 'در انتظار تایید مدیر شهرک',
  PAID: 'پرداخت شده',
  OVERDUE: 'سررسید گذشته',
  CANCELLED: 'لغو شده',
  INSTALLMENTS: 'تقسیط‌شده',
};

export const invoiceItemTypeLabels = {
  WATER: 'آب‌بها',
  SEWAGE: 'فاضلاب‌بها',
  RENOVATION_SHARE: 'سهم هزینه‌های نوسازی، بازسازی و تعمیرات',
  SHARE_DEBT: 'بدهی سهام',
  CHARGE_OTHER: 'سایر',
  ENTRANCE_FEE: 'ورودی',
  MONTHLY_MEMBERSHIP: 'حق عضویت ماهانه',
  PLATFORM_OTHER: 'سایر',
  CARRIED_PENALTY: 'جریمه تأخیر قبلی',
};

/** Item types each bill category may contain (mirrors the backend rule). */
export const CHARGE_ITEM_TYPES = ['WATER', 'SEWAGE', 'RENOVATION_SHARE', 'SHARE_DEBT', 'CHARGE_OTHER'];
export const PLATFORM_ITEM_TYPES = ['ENTRANCE_FEE', 'MONTHLY_MEMBERSHIP', 'PLATFORM_OTHER'];
export const OTHER_ITEM_TYPES = ['CHARGE_OTHER', 'PLATFORM_OTHER'];

export const invoiceCategoryLabels = {
  CHARGE: 'قبض شارژ شهرک',
  PLATFORM: 'صورتحساب سامانه',
};

export const invoiceAdjustmentTypeLabels = {
  EDIT: 'ویرایش',
  DISCOUNT: 'تخفیف',
  EXTENSION: 'تمدید مهلت',
  SETTLEMENT: 'تسویه دستی',
  INSTALLMENT: 'تقسیط',
};

export const manualSettlementMethodLabels = {
  CASH: 'نقدی',
  CHECK: 'چک',
  POS: 'کارتخوان',
  TRANSFER: 'حواله / انتقال بانکی',
};

/** Title shown for a line item: custom title for "other"/carried rows, otherwise the type label. */
export const invoiceItemLabel = (item) => {
  const title = item?.title?.trim?.();
  if (title && (OTHER_ITEM_TYPES.includes(item.type) || item.type === 'CARRIED_PENALTY')) return title;
  return invoiceItemTypeLabels[item?.type] || item?.type || '';
};

export const gatePassStatusLabels = {
  PENDING: 'در انتظار تایید مدیر شهرک',
  APPROVED: 'تایید مدیر شهرک · در انتظار نگهبانی',
  REJECTED: 'رد شده',
  COMPLETED: 'خروج تایید شد',
  EXPIRED: 'منقضی شده',
};

/** Who rejected a REJECTED gate pass: the guard sets verifiedById, the park manager only approvedById. */
export const gatePassRejectionStage = (pass) => {
  if (pass?.status !== 'REJECTED') return null;
  return pass.verifiedById || pass.verifiedBy ? 'guard' : 'park';
};

export const cargoTypeLabels = {
  RAW_MATERIALS: 'مواد اولیه',
  FINISHED_GOODS: 'محصول نهایی',
  WASTE: 'ضایعات',
  SUPPLIES: 'ملزومات',
  EQUIPMENT: 'تجهیزات',
  OTHER: 'سایر',
};

export const vehicleTypeLabels = {
  KHAVAR: 'خاور',
  TAK: 'تک',
  TEN_WHEELER: '۱۰ چرخ',
  TRAILER: 'تریلی',
  VAN: 'وانت',
  CAR: 'سواری',
  MOTORCYCLE: 'موتورسیکلت',
  OTHER: 'سایر',
  TRUCK: 'کامیون',
};

/** Vehicle types offered for new gate passes; TRUCK is kept above only to label old records. */
export const ACTIVE_VEHICLE_TYPES = ['KHAVAR', 'TAK', 'TEN_WHEELER', 'TRAILER', 'VAN', 'CAR', 'MOTORCYCLE', 'OTHER'];

/** Retired types (legacy TRUCK) are rejected for new or edited passes, so forms start empty and the user picks again. */
export const selectableVehicleType = (value) => (ACTIVE_VEHICLE_TYPES.includes(value) ? value : '');

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
  GOLD: 'طلای ۱۸ عیار',
  SILVER: 'نقره',
  PLATINUM: 'پلاتین',
  COIN: 'سکه امامی',
  COPPER: 'مس',
  ALUMINUM: 'آلومینیوم',
  OIL: 'نفت برنت',
  BITUMEN: 'قیر',
  USDT: 'تتر (USDT)',
  BTC: 'بیت‌کوین',
  ETH: 'اتریوم',
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
