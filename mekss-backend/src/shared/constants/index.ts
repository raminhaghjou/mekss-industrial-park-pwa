export const APP_CONSTANTS = {
  APP_NAME: 'MEKSS Industrial Park Management',
  APP_VERSION: '1.0.0',
  API_PREFIX: 'api/v1',
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  DEFAULT_LANGUAGE: 'fa',
  SUPPORTED_LANGUAGES: ['fa', 'en'],
  TIMEZONE: 'Asia/Tehran',
} as const;

export const ROLES = {
  ADMIN: 'ADMIN',
  PARK_MANAGER: 'PARK_MANAGER',
  FACTORY_OWNER: 'FACTORY_OWNER',
  SECURITY_GUARD: 'SECURITY_GUARD',
  GOVERNMENT_OFFICIAL: 'GOVERNMENT_OFFICIAL',
} as const;

export const PERMISSIONS = {
  // Factory Management
  FACTORY_CREATE: 'FACTORY_CREATE',
  FACTORY_READ: 'FACTORY_READ',
  FACTORY_UPDATE: 'FACTORY_UPDATE',
  FACTORY_DELETE: 'FACTORY_DELETE',
  
  // Gate Pass Management
  GATE_PASS_CREATE: 'GATE_PASS_CREATE',
  GATE_PASS_READ: 'GATE_PASS_READ',
  GATE_PASS_UPDATE: 'GATE_PASS_UPDATE',
  GATE_PASS_DELETE: 'GATE_PASS_DELETE',
  GATE_PASS_APPROVE: 'GATE_PASS_APPROVE',
  
  // Invoice Management
  INVOICE_CREATE: 'INVOICE_CREATE',
  INVOICE_READ: 'INVOICE_READ',
  INVOICE_UPDATE: 'INVOICE_UPDATE',
  INVOICE_DELETE: 'INVOICE_DELETE',
  
  // Request Management
  REQUEST_CREATE: 'REQUEST_CREATE',
  REQUEST_READ: 'REQUEST_READ',
  REQUEST_UPDATE: 'REQUEST_UPDATE',
  REQUEST_DELETE: 'REQUEST_DELETE',
  REQUEST_APPROVE: 'REQUEST_APPROVE',
  
  // Announcement Management
  ANNOUNCEMENT_CREATE: 'ANNOUNCEMENT_CREATE',
  ANNOUNCEMENT_READ: 'ANNOUNCEMENT_READ',
  ANNOUNCEMENT_UPDATE: 'ANNOUNCEMENT_UPDATE',
  ANNOUNCEMENT_DELETE: 'ANNOUNCEMENT_DELETE',
  
  // Advertisement Management
  ADVERTISEMENT_CREATE: 'ADVERTISEMENT_CREATE',
  ADVERTISEMENT_READ: 'ADVERTISEMENT_READ',
  ADVERTISEMENT_UPDATE: 'ADVERTISEMENT_UPDATE',
  ADVERTISEMENT_DELETE: 'ADVERTISEMENT_DELETE',
  
  // Emergency Management
  EMERGENCY_CREATE: 'EMERGENCY_CREATE',
  EMERGENCY_READ: 'EMERGENCY_READ',
  EMERGENCY_UPDATE: 'EMERGENCY_UPDATE',
  EMERGENCY_DELETE: 'EMERGENCY_DELETE',
  
  // User Management
  USER_CREATE: 'USER_CREATE',
  USER_READ: 'USER_READ',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',
  
  // Analytics
  ANALYTICS_READ: 'ANALYTICS_READ',
  REPORT_GENERATE: 'REPORT_GENERATE',
} as const;

export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
  [ROLES.PARK_MANAGER]: [
    PERMISSIONS.FACTORY_READ,
    PERMISSIONS.FACTORY_UPDATE,
    PERMISSIONS.GATE_PASS_READ,
    PERMISSIONS.GATE_PASS_APPROVE,
    PERMISSIONS.INVOICE_READ,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.REQUEST_READ,
    PERMISSIONS.REQUEST_APPROVE,
    PERMISSIONS.ANNOUNCEMENT_CREATE,
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.ANNOUNCEMENT_UPDATE,
    PERMISSIONS.ADVERTISEMENT_CREATE,
    PERMISSIONS.ADVERTISEMENT_READ,
    PERMISSIONS.ADVERTISEMENT_UPDATE,
    PERMISSIONS.EMERGENCY_CREATE,
    PERMISSIONS.EMERGENCY_READ,
    PERMISSIONS.EMERGENCY_UPDATE,
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORT_GENERATE,
  ],
  [ROLES.FACTORY_OWNER]: [
    PERMISSIONS.FACTORY_READ,
    PERMISSIONS.GATE_PASS_CREATE,
    PERMISSIONS.GATE_PASS_READ,
    PERMISSIONS.GATE_PASS_UPDATE,
    PERMISSIONS.INVOICE_READ,
    PERMISSIONS.REQUEST_CREATE,
    PERMISSIONS.REQUEST_READ,
    PERMISSIONS.REQUEST_UPDATE,
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.ADVERTISEMENT_CREATE,
    PERMISSIONS.ADVERTISEMENT_READ,
    PERMISSIONS.ADVERTISEMENT_UPDATE,
    PERMISSIONS.EMERGENCY_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],
  [ROLES.SECURITY_GUARD]: [
    PERMISSIONS.GATE_PASS_READ,
    PERMISSIONS.GATE_PASS_UPDATE,
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.EMERGENCY_CREATE,
    PERMISSIONS.EMERGENCY_READ,
  ],
  [ROLES.GOVERNMENT_OFFICIAL]: [
    PERMISSIONS.FACTORY_READ,
    PERMISSIONS.GATE_PASS_READ,
    PERMISSIONS.INVOICE_READ,
    PERMISSIONS.REQUEST_READ,
    PERMISSIONS.ANNOUNCEMENT_READ,
    PERMISSIONS.EMERGENCY_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORT_GENERATE,
  ],
} as const;

export const SMS_TEMPLATES = {
  OTP: 'کد تایید شما: {code} - این کد تا {expiry} دقیقه معتبر است.',
  GATE_PASS_APPROVED: 'مجوز تردد شما با کد {code} تایید شد.',
  GATE_PASS_REJECTED: 'مجوز تردد شما با کد {code} رد شد. دلیل: {reason}',
  INVOICE_CREATED: 'فاکتور شماره {number} به مبلغ {amount} ریال صادر شد.',
  INVOICE_OVERDUE: 'یادآوری: فاکتور شماره {number} با مهلت پرداخت {dueDate} سررسید شده است.',
  EMERGENCY_ALERT: '🚨 هشدار اضطراری: {title} - {description}',
  ANNOUNCEMENT: '📢 اطلاعیه: {title} - {content}',
  REQUEST_APPROVED: 'درخواست شما با عنوان "{title}" تایید شد.',
  REQUEST_REJECTED: 'درخواست شما با عنوان "{title}" رد شد. دلیل: {reason}',
} as const;

export const NOTIFICATION_TEMPLATES = {
  WELCOME: {
    title: 'خوش آمدید',
    message: 'به سیستم مدیریت مجتمع صنعتی MEKSS خوش آمدید.',
  },
  GATE_PASS_CREATED: {
    title: 'مجوز تردد ایجاد شد',
    message: 'مجوز تردد جدید برای {employeeName} ایجاد شد.',
  },
  GATE_PASS_APPROVED: {
    title: 'مجوز تردد تایید شد',
    message: 'مجوز تردد شما با کد {code} تایید شد.',
  },
  GATE_PASS_REJECTED: {
    title: 'مجوز تردد رد شد',
    message: 'مجوز تردد شما با کد {code} رد شد.',
  },
  INVOICE_CREATED: {
    title: 'فاکتور جدید',
    message: 'فاکتور شماره {number} به مبلغ {amount} ریال صادر شد.',
  },
  INVOICE_PAID: {
    title: 'پرداخت فاکتور',
    message: 'فاکتور شماره {number} با موفقیت پرداخت شد.',
  },
  REQUEST_CREATED: {
    title: 'درخواست جدید',
    message: 'درخواست جدید با عنوان "{title}" از {factoryName} ثبت شد.',
  },
  REQUEST_APPROVED: {
    title: 'درخواست تایید شد',
    message: 'درخواست "{title}" شما تایید شد.',
  },
  REQUEST_REJECTED: {
    title: 'درخواست رد شد',
    message: 'درخواست "{title}" شما رد شد.',
  },
  ANNOUNCEMENT: {
    title: 'اطلاعیه جدید',
    message: '{title}',
  },
  EMERGENCY: {
    title: '🚨 هشدار اضطراری',
    message: '{title}',
  },
  ADVERTISEMENT: {
    title: 'تبلیغات جدید',
    message: '{title}',
  },
} as const;

export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'AUTH_001',
  TOKEN_EXPIRED: 'AUTH_002',
  TOKEN_INVALID: 'AUTH_003',
  INSUFFICIENT_PERMISSIONS: 'AUTH_004',
  OTP_INVALID: 'AUTH_005',
  OTP_EXPIRED: 'AUTH_006',
  
  // Validation errors
  VALIDATION_FAILED: 'VAL_001',
  INVALID_INPUT: 'VAL_002',
  REQUIRED_FIELD_MISSING: 'VAL_003',
  
  // Not found errors
  USER_NOT_FOUND: 'NOT_001',
  FACTORY_NOT_FOUND: 'NOT_002',
  PARK_NOT_FOUND: 'NOT_003',
  GATE_PASS_NOT_FOUND: 'NOT_004',
  INVOICE_NOT_FOUND: 'NOT_005',
  REQUEST_NOT_FOUND: 'NOT_006',
  
  // Business logic errors
  GATE_PASS_ALREADY_USED: 'BUS_001',
  INVOICE_ALREADY_PAID: 'BUS_002',
  REQUEST_ALREADY_PROCESSED: 'BUS_003',
  INSUFFICIENT_BALANCE: 'BUS_004',
  
  // External service errors
  SMS_SEND_FAILED: 'EXT_001',
  PAYMENT_FAILED: 'EXT_002',
  NOTIFICATION_SEND_FAILED: 'EXT_003',
  
  // System errors
  INTERNAL_SERVER_ERROR: 'SYS_001',
  DATABASE_ERROR: 'SYS_002',
  FILE_UPLOAD_FAILED: 'SYS_003',
} as const;

export const CACHE_KEYS = {
  USER_SESSION: 'session:user:',
  USER_PERMISSIONS: 'permissions:user:',
  PARK_DATA: 'park:data:',
  FACTORY_DATA: 'factory:data:',
  GATE_PASS_QR: 'gatepass:qr:',
  OTP_CODE: 'otp:code:',
  ANNOUNCEMENT_ACTIVE: 'announcement:active:',
  ADVERTISEMENT_ACTIVE: 'advertisement:active:',
  EMERGENCY_ACTIVE: 'emergency:active:',
  ANALYTICS_DASHBOARD: 'analytics:dashboard:',
} as const;

export const QUEUE_JOBS = {
  SEND_SMS: 'send-sms',
  SEND_NOTIFICATION: 'send-notification',
  SEND_EMAIL: 'send-email',
  GENERATE_REPORT: 'generate-report',
  PROCESS_INVOICE: 'process-invoice',
  UPDATE_ANALYTICS: 'update-analytics',
  CLEANUP_CACHE: 'cleanup-cache',
  BACKUP_DATABASE: 'backup-database',
} as const;

export const WEBHOOK_EVENTS = {
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILED: 'payment.failed',
  SMS_DELIVERED: 'sms.delivered',
  SMS_FAILED: 'sms.failed',
  USER_REGISTERED: 'user.registered',
  GATE_PASS_USED: 'gatepass.used',
  EMERGENCY_TRIGGERED: 'emergency.triggered',
} as const;

export const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/avi', 'video/mov'],
  UPLOAD_PATH: './uploads',
  TEMP_PATH: './temp',
} as const;

export const SECURITY_CONFIG = {
  BCRYPT_ROUNDS: 12,
  JWT_EXPIRATION: '7d',
  JWT_REFRESH_EXPIRATION: '30d',
  OTP_EXPIRATION_MINUTES: 5,
  OTP_MAX_ATTEMPTS: 3,
  OTP_LOCKOUT_DURATION: 15, // minutes
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIREMENTS: {
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
  },
  SESSION_TIMEOUT: 30, // minutes
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 30, // minutes
} as const;

export const PAGINATION_CONFIG = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export const DATE_FORMATS = {
  PERSIAN_DATE: 'YYYY/MM/DD',
  PERSIAN_DATETIME: 'YYYY/MM/DD HH:mm:ss',
  ISO_DATE: 'YYYY-MM-DD',
  ISO_DATETIME: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
} as const;
