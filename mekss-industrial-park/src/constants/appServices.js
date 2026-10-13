import {
  BadgeCheck,
  Building2,
  Calculator,
  ChartColumn,
  CircleUserRound,
  ClipboardCheck,
  Factory,
  FileText,
  HardHat,
  House,
  IdCard,
  Images,
  Lightbulb,
  MapPinned,
  Megaphone,
  MessageCircle,
  Bell,
  Newspaper,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Siren,
  Smartphone,
  Store,
  Tags,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';

export const ALL_ROLES = ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'SECURITY_GUARD', 'GOVERNMENT_OFFICIAL', 'EMPLOYEE'];

/**
 * Visual tones for service icons. Class strings are spelled out in full so Tailwind can see them.
 * `soft` is the icon tile, `solid` the featured-card gradient.
 */
export const serviceTones = {
  emerald: {
    soft: 'bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20',
    solid: 'from-emerald-500 to-teal-600',
  },
  amber: {
    soft: 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/20',
    solid: 'from-amber-500 to-orange-600',
  },
  sky: {
    soft: 'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/20',
    solid: 'from-sky-500 to-blue-600',
  },
  violet: {
    soft: 'bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/20',
    solid: 'from-violet-500 to-purple-600',
  },
  indigo: {
    soft: 'bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/20',
    solid: 'from-indigo-500 to-blue-700',
  },
  teal: {
    soft: 'bg-teal-50 text-teal-600 ring-teal-100 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-400/20',
    solid: 'from-teal-500 to-cyan-600',
  },
  rose: {
    soft: 'bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/20',
    solid: 'from-rose-500 to-red-600',
  },
};

export const serviceGroups = [
  { id: 'traffic', title: 'تردد و برگ خروج', tone: 'emerald' },
  { id: 'finance', title: 'مالی و پرداخت', tone: 'amber' },
  { id: 'units', title: 'واحدها و پرسنل', tone: 'sky' },
  { id: 'comms', title: 'درخواست و ارتباطات', tone: 'violet' },
  { id: 'admin', title: 'مدیریت و گزارش', tone: 'indigo' },
  { id: 'tools', title: 'ابزارها', tone: 'teal' },
];

/**
 * Every in-app destination, with the roles that may open it (kept in sync with RoleRoute in App.jsx).
 * `badgeKey` reads a live counter supplied by the dashboard.
 */
export const appServices = [
  // Traffic
  { id: 'gate-passes-mine', path: '/gate-passes', title: 'برگ‌های خروج من', shortTitle: 'برگ خروج', description: 'صدور و پیگیری مجوز خروج بار', icon: Truck, group: 'traffic', roles: ['FACTORY_OWNER'], badgeKey: 'pendingGatePasses', keywords: ['مجوز', 'بار', 'کامیون', 'خودرو'] },
  { id: 'gate-passes-approve', path: '/admin/gate-passes', title: 'تایید برگ‌های خروج', shortTitle: 'تایید خروج', description: 'بررسی و تایید برگ خروج واحدها', icon: ClipboardCheck, group: 'traffic', roles: ['SUPER_ADMIN', 'PARK_MANAGER'], badgeKey: 'pendingGatePasses', keywords: ['مجوز', 'بار', 'برگ خروج'] },
  { id: 'guard-gate-passes', path: '/guard/gate-passes', title: 'تایید خروج', shortTitle: 'تایید خروج', description: 'کنترل و ثبت خروج خودروها', icon: ShieldCheck, group: 'traffic', roles: ['SECURITY_GUARD'], badgeKey: 'pendingGatePasses', keywords: ['برگ خروج', 'نگهبانی', 'گیت'] },
  { id: 'guard-scan', path: '/guard/scan', title: 'اسکن QR', shortTitle: 'اسکن QR', description: 'خواندن سریع برگ خروج با دوربین', icon: QrCode, group: 'traffic', roles: ['SUPER_ADMIN', 'SECURITY_GUARD'], keywords: ['کد', 'بارکد', 'دوربین', 'پلاک'] },

  // Finance
  { id: 'invoices', path: '/invoices', title: 'قبض‌های من', shortTitle: 'قبض‌ها', description: 'مشاهده و پرداخت قبض و بدهی', icon: ReceiptText, group: 'finance', roles: ['FACTORY_OWNER', 'PARK_MANAGER'], badgeKey: 'unpaidInvoices', keywords: ['بدهی', 'پرداخت', 'صورتحساب'] },
  { id: 'finance', path: '/admin/finance', title: 'حسابداری و مالی', shortTitle: 'حسابداری', description: 'مطالبات واحدها و صدور قبض', icon: Calculator, group: 'finance', roles: ['SUPER_ADMIN', 'PARK_MANAGER'], keywords: ['قبض', 'بدهی', 'مطالبات', 'صورتحساب'] },
  { id: 'wallet', path: '/factory/wallet', title: 'کیف پول', shortTitle: 'کیف پول', description: 'موجودی و شارژ کیف پول برگ خروج', icon: Wallet, group: 'finance', roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'], keywords: ['شارژ', 'موجودی', 'پول', 'پرداخت'] },

  // Units and staff
  { id: 'factories', path: '/admin/factories', title: 'واحدهای صنعتی', shortTitle: 'واحدها', description: 'مشاهده و مدیریت واحدهای شهرک', icon: Building2, group: 'units', roles: ['SUPER_ADMIN', 'PARK_MANAGER'], keywords: ['کارخانه', 'شرکت'] },
  { id: 'registrations', path: '/admin/registrations', title: 'تایید ثبت‌نام‌ها', shortTitle: 'ثبت‌نام‌ها', description: 'بررسی درخواست عضویت افراد', icon: UserCheck, group: 'units', roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'], keywords: ['عضویت', 'کاربر جدید'] },
  { id: 'park-staff', path: '/admin/park-staff', title: 'پرسنل شهرک', shortTitle: 'پرسنل شهرک', description: 'نگهبان‌ها و کارکنان شهرک', icon: IdCard, group: 'units', roles: ['SUPER_ADMIN', 'PARK_MANAGER'], keywords: ['کارمند', 'نگهبان', 'کارکنان'] },
  { id: 'factory-register', path: '/factory/register', title: 'ثبت واحد صنعتی', shortTitle: 'ثبت واحد', description: 'ثبت یا پیگیری واحد جدید', icon: Factory, group: 'units', roles: ['FACTORY_OWNER'], keywords: ['کارخانه', 'شرکت'] },
  { id: 'factory-staff', path: '/factory/staff', title: 'پرسنل واحد', shortTitle: 'پرسنل واحد', description: 'کارکنان و دسترسی‌های واحد', icon: HardHat, group: 'units', roles: ['FACTORY_OWNER'], keywords: ['کارمند', 'کارکنان', 'کارگر'] },

  // Requests and communications
  { id: 'admin-requests', path: '/admin/requests', title: 'درخواست‌ها', shortTitle: 'درخواست‌ها', description: 'رسیدگی به درخواست واحدها', icon: FileText, group: 'comms', roles: ['SUPER_ADMIN', 'PARK_MANAGER'], badgeKey: 'pendingRequests', keywords: ['مرخصی', 'ماموریت', 'مجوز'] },
  { id: 'my-requests', path: '/requests', title: 'درخواست‌های من', shortTitle: 'درخواست‌ها', description: 'ثبت مرخصی، ماموریت و درخواست', icon: FileText, group: 'comms', roles: ['FACTORY_OWNER', 'EMPLOYEE'], badgeKey: 'pendingRequests', keywords: ['مرخصی', 'ماموریت', 'وام'] },
  { id: 'messages', path: '/messages', title: 'پیام‌ها', shortTitle: 'پیام‌ها', description: 'گفتگو با مدیریت و واحدها', icon: MessageCircle, group: 'comms', roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'GOVERNMENT_OFFICIAL', 'EMPLOYEE'], badgeKey: 'unreadMessages', keywords: ['نامه', 'گفتگو', 'صندوق'] },
  { id: 'admin-announcements', path: '/admin/announcements', title: 'مدیریت اطلاعیه‌ها', shortTitle: 'اطلاعیه‌ها', description: 'انتشار اطلاعیه برای واحدها', icon: Megaphone, group: 'comms', roles: ['SUPER_ADMIN', 'PARK_MANAGER'], keywords: ['خبر', 'اعلان'] },
  { id: 'announcements', path: '/announcements', title: 'اطلاعیه‌ها', shortTitle: 'اطلاعیه‌ها', description: 'آخرین اطلاعیه‌های رسمی', icon: Bell, group: 'comms', roles: ['FACTORY_OWNER', 'GOVERNMENT_OFFICIAL', 'SECURITY_GUARD', 'EMPLOYEE'], keywords: ['خبر', 'اعلان'] },
  { id: 'feedback', path: '/feedback', title: 'انتقادات و پیشنهادات', shortTitle: 'پیشنهادات', description: 'نظر خود را با ما در میان بگذارید', icon: Lightbulb, group: 'comms', roles: ALL_ROLES, keywords: ['شکایت', 'انتقاد', 'نظر'] },

  // Administration and reports
  { id: 'reports', path: '/admin/reports', title: 'گزارش‌ها', shortTitle: 'گزارش‌ها', description: 'شاخص‌ها و عملکرد شهرک', icon: ChartColumn, group: 'admin', roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'GOVERNMENT_OFFICIAL'], keywords: ['آمار', 'نمودار'] },
  { id: 'parks', path: '/superadmin/parks', title: 'شهرک‌ها', shortTitle: 'شهرک‌ها', description: 'ایجاد و پیکربندی شهرک‌ها', icon: MapPinned, group: 'admin', roles: ['SUPER_ADMIN'], keywords: ['شهرک صنعتی'] },
  { id: 'users', path: '/superadmin/users', title: 'کاربران', shortTitle: 'کاربران', description: 'نقش‌ها و وضعیت حساب‌ها', icon: Users, group: 'admin', roles: ['SUPER_ADMIN'], keywords: ['دسترسی', 'حساب'] },
  { id: 'ads-moderation', path: '/superadmin/advertisements', title: 'نظارت بر آگهی‌ها', shortTitle: 'نظارت آگهی', description: 'تایید و مدیریت آگهی‌ها', icon: BadgeCheck, group: 'admin', roles: ['SUPER_ADMIN'], badgeKey: 'pendingAds', keywords: ['آگهی', 'تبلیغ'] },
  { id: 'ad-categories', path: '/superadmin/ad-categories', title: 'دسته‌بندی آگهی', shortTitle: 'دسته آگهی', description: 'دسته‌های دیوار آگهی', icon: Tags, group: 'admin', roles: ['SUPER_ADMIN'], keywords: ['آگهی', 'دسته'] },
  { id: 'banners', path: '/superadmin/banners', title: 'بنرهای داشبورد', shortTitle: 'بنرها', description: 'تصاویر اسلایدر صفحه اصلی', icon: Images, group: 'admin', roles: ['SUPER_ADMIN'], keywords: ['تصویر', 'اسلاید'] },
  { id: 'sms-config', path: '/superadmin/sms-config', title: 'تنظیمات پیامک', shortTitle: 'پیامک', description: 'سرویس ارسال پیامک', icon: Smartphone, group: 'admin', roles: ['SUPER_ADMIN'], keywords: ['اس ام اس', 'sms'] },

  // Tools
  { id: 'market-rates', path: '/market-rates', title: 'نرخ بازار', shortTitle: 'نرخ بازار', description: 'ارز، طلا، سکه و فلزات', icon: TrendingUp, group: 'tools', roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'GOVERNMENT_OFFICIAL'], keywords: ['دلار', 'طلا', 'سکه', 'قیمت'] },
  { id: 'advertisements', path: '/advertisements', title: 'آگهی‌های من', shortTitle: 'آگهی‌ها', description: 'ثبت و مدیریت آگهی', icon: Newspaper, group: 'tools', roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'], keywords: ['تبلیغ', 'فروش'] },
  { id: 'ads-wall', path: '/ads', title: 'دیوار آگهی', shortTitle: 'دیوار آگهی', description: 'آگهی‌های خرید و فروش شهرک', icon: Store, group: 'tools', roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'EMPLOYEE', 'GOVERNMENT_OFFICIAL'], keywords: ['خرید', 'فروش', 'تبلیغ'] },
  { id: 'emergency', path: '/emergency', title: 'هشدار اضطراری', shortTitle: 'اضطراری', description: 'اعلام آتش‌سوزی و حادثه', icon: Siren, group: 'tools', tone: 'rose', roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'SECURITY_GUARD', 'EMPLOYEE'], badgeKey: 'openEmergencies', keywords: ['آتش', 'حریق', 'حادثه', 'کمک'] },
];

/** The two or three things each role does most, shown as large cards at the top of the home screen. */
export const featuredByRole = {
  SUPER_ADMIN: ['parks', 'users', 'ads-moderation'],
  PARK_MANAGER: ['gate-passes-approve', 'admin-requests', 'finance'],
  FACTORY_OWNER: ['gate-passes-mine', 'invoices', 'wallet'],
  SECURITY_GUARD: ['guard-scan', 'guard-gate-passes', 'emergency'],
  GOVERNMENT_OFFICIAL: ['reports', 'market-rates'],
  EMPLOYEE: ['my-requests', 'messages'],
};

const homeTab = { id: 'home', path: '/dashboard', title: 'خانه', icon: House };
const messagesTab = { id: 'messages', path: '/messages', title: 'پیام‌ها', icon: MessageCircle, badgeKey: 'unreadMessages' };
const emergencyTab = { id: 'emergency', path: '/emergency', title: 'اضطراری', icon: Siren, tone: 'danger' };
const profileTab = { id: 'profile', path: '/profile', title: 'پروفایل', icon: CircleUserRound };

/** Fixed bottom-bar (mobile) / header (desktop) tabs. Always four, always starting with home. */
export const tabsByRole = {
  SUPER_ADMIN: [homeTab, messagesTab, emergencyTab, profileTab],
  PARK_MANAGER: [homeTab, messagesTab, emergencyTab, profileTab],
  FACTORY_OWNER: [homeTab, messagesTab, emergencyTab, profileTab],
  SECURITY_GUARD: [homeTab, { id: 'scan', path: '/guard/scan', title: 'اسکن', icon: QrCode }, emergencyTab, profileTab],
  GOVERNMENT_OFFICIAL: [homeTab, messagesTab, { id: 'announcements', path: '/announcements', title: 'اطلاعیه', icon: Bell }, profileTab],
  EMPLOYEE: [homeTab, messagesTab, emergencyTab, profileTab],
};

export const tabsForRole = (role) => tabsByRole[role] || tabsByRole.EMPLOYEE;

/** Services visible to a role; the gate-pass wallet is hidden when the wallet feature is off. */
export const servicesForRole = (role, { showWalletUi = true } = {}) => appServices.filter((service) => (
  service.roles.includes(role) && (service.id !== 'wallet' || showWalletUi)
));

export const featuredServicesForRole = (role, options) => {
  const visible = servicesForRole(role, options);
  return (featuredByRole[role] || [])
    .map((id) => visible.find((service) => service.id === id))
    .filter(Boolean);
};

export const toneForService = (service) => {
  const tone = service.tone || serviceGroups.find((group) => group.id === service.group)?.tone || 'emerald';
  return serviceTones[tone] || serviceTones.emerald;
};

/** Visible services bucketed by group, in group order, with empty groups dropped. */
export const groupServices = (services) => serviceGroups
  .map((group) => ({ ...group, services: services.filter((service) => service.group === group.id) }))
  .filter((group) => group.services.length > 0);

const extraPageTitles = [
  { path: '/dashboard', title: 'خانه' },
  { path: '/profile', title: 'پروفایل' },
  { path: '/settings', title: 'تنظیمات' },
  { path: '/about', title: 'درباره سامانه' },
  { path: '/admin/invoices/create', title: 'صدور قبض' },
  { path: '/admin/invoices', title: 'حسابداری و مالی' },
  { path: '/admin/messages', title: 'ارسال پیام' },
  { path: '/admin/advertisements', title: 'تایید آگهی‌ها' },
  { path: '/guard/emergency', title: 'هشدار اضطراری' },
  { path: '/requests/new', title: 'درخواست جدید' },
  { path: '/requests/tools', title: 'ابزار درخواست' },
  { path: '/advertisements/new', title: 'آگهی جدید' },
  { path: '/invoices/pay', title: 'پرداخت قبض' },
];

const matchesPath = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`);

/** Header title for the current page: the most specific matching service or known page. */
export const pageTitleForPath = (pathname) => {
  const candidates = [...extraPageTitles, ...appServices]
    .filter((entry) => matchesPath(pathname, entry.path))
    .sort((a, b) => b.path.length - a.path.length);
  return candidates[0]?.title || null;
};

const normalizeSearchText = (value) => String(value || '')
  .replace(/[\u064A]/g, 'ی')
  .replace(/[\u0643]/g, 'ک')
  .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
  .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[\u200c\u200f\u200e]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

/** Every whitespace-separated term must appear in the service's title, description or keywords. */
export const searchServices = (services, query) => {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  if (terms.length === 0) return services;
  return services.filter((service) => {
    const haystack = normalizeSearchText([
      service.title,
      service.shortTitle,
      service.description,
      ...(service.keywords || []),
    ].join(' '));
    return terms.every((term) => haystack.includes(term));
  });
};
