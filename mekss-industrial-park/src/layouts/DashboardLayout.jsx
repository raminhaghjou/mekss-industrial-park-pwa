import { useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownPopover,
  DropdownMenu,
  DropdownItem,
  Separator,
} from '@heroui/react';
import {
  LayoutDashboard,
  Building2,
  FileText,
  Receipt,
  Ticket,
  MessageSquare,
  Bell,
  Megaphone,
  AlertTriangle,
  Settings,
  User,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  MapPin,
  ChevronLeft,
  MoreHorizontal,
  Wallet,
  UserPlus,
  LineChart,
  ScanLine,
  Factory,
} from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { useActiveFactory } from '../providers/ActiveFactoryProvider';
import { useNotification } from '../providers/NotificationProvider';
import { messageApi } from '../services/api/message.api';
import { roleLabels } from '../constants/persianLabels';

const navigationItems = [
  { path: '/dashboard', text: 'داشبورد', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'SECURITY_GUARD', 'GOVERNMENT_OFFICIAL', 'EMPLOYEE'] },
  { path: '/admin/factories', text: 'واحدهای صنعتی', icon: Building2, roles: ['SUPER_ADMIN', 'PARK_MANAGER'] },
  { path: '/factory/register', text: 'ثبت واحد صنعتی', icon: Factory, roles: ['FACTORY_OWNER'] },
  { path: '/factory/staff', text: 'پرسنل واحد', icon: UserPlus, roles: ['FACTORY_OWNER'] },
  { path: '/factory/wallet', text: 'کیف پول', icon: Wallet, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'] },
  { path: '/admin/invoices', text: 'قبض‌ها', icon: Receipt, roles: ['SUPER_ADMIN', 'PARK_MANAGER'] },
  { path: '/invoices', text: 'قبض‌های من', icon: Receipt, roles: ['FACTORY_OWNER'] },
  { path: '/admin/gate-passes', text: 'برگ‌های خروج', icon: Ticket, roles: ['SUPER_ADMIN', 'PARK_MANAGER'] },
  { path: '/gate-passes', text: 'برگ‌های خروج من', icon: Ticket, roles: ['FACTORY_OWNER'] },
  { path: '/guard/gate-passes', text: 'تایید خروج', icon: ShieldCheck, roles: ['SECURITY_GUARD'] },
  { path: '/guard/scan', text: 'اسکن QR', icon: ScanLine, roles: ['SUPER_ADMIN', 'SECURITY_GUARD'] },
  { path: '/admin/requests', text: 'درخواست‌ها', icon: FileText, roles: ['SUPER_ADMIN', 'PARK_MANAGER'] },
  { path: '/requests', text: 'درخواست‌های من', icon: FileText, roles: ['FACTORY_OWNER', 'EMPLOYEE'] },
  { path: '/messages', text: 'پیام‌ها', icon: MessageSquare, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'GOVERNMENT_OFFICIAL', 'EMPLOYEE'] },
  { path: '/market-rates', text: 'نرخ بازار', icon: LineChart, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'GOVERNMENT_OFFICIAL'] },
  { path: '/announcements', text: 'اطلاعیه‌ها', icon: Bell, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'GOVERNMENT_OFFICIAL', 'SECURITY_GUARD', 'EMPLOYEE'] },
  { path: '/advertisements', text: 'آگهی‌ها', icon: Megaphone, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'] },
  { path: '/emergency', text: 'هشدار اضطراری', icon: AlertTriangle, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'SECURITY_GUARD'] },
  { path: '/superadmin/parks', text: 'شهرک‌ها', icon: MapPin, roles: ['SUPER_ADMIN'] },
  { path: '/superadmin/users', text: 'کاربران', icon: Users, roles: ['SUPER_ADMIN'] },
  { path: '/admin/reports', text: 'گزارش‌ها', icon: FileText, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'GOVERNMENT_OFFICIAL'] },
];

const bottomNavPathsByRole = {
  SUPER_ADMIN: ['/dashboard', '/superadmin/parks', '/superadmin/users', '/admin/reports'],
  PARK_MANAGER: ['/dashboard', '/admin/factories', '/admin/requests', '/admin/invoices'],
  FACTORY_OWNER: ['/dashboard', '/invoices', '/requests', '/gate-passes'],
  SECURITY_GUARD: ['/dashboard', '/guard/gate-passes', '/guard/scan', '/emergency'],
  GOVERNMENT_OFFICIAL: ['/dashboard', '/admin/reports', '/announcements', '/messages'],
  EMPLOYEE: ['/dashboard', '/requests', '/messages', '/announcements'],
};

const bottomShortLabels = {
  '/dashboard': 'خانه',
  '/invoices': 'قبض',
  '/requests': 'درخواست',
  '/gate-passes': 'خروج',
  '/admin/factories': 'واحدها',
  '/admin/requests': 'درخواست',
  '/admin/invoices': 'قبض',
  '/guard/gate-passes': 'خروج',
  '/guard/scan': 'اسکن',
  '/emergency': 'اضطراری',
  '/announcements': 'اطلاعیه',
  '/superadmin/parks': 'شهرک',
  '/superadmin/users': 'کاربر',
  '/admin/reports': 'گزارش',
  '/messages': 'پیام',
  '/requests': 'درخواست',
  '/profile': 'پروفایل',
  '/guard/scan': 'QR',
};

const profileShortcut = { path: '/profile', text: 'پروفایل', icon: User, roles: ['EMPLOYEE'] };

const SidebarBrand = () => (
  <div className="flex items-center gap-2 px-4 py-6">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f4c81] text-lg font-bold text-white">
      M
    </div>
    <div className="flex flex-col">
      <span className="text-sm font-bold text-foreground">MEKSS</span>
      <span className="text-xs text-foreground-500">مدیریت شهرک صنعتی</span>
    </div>
  </div>
);

const NavButton = ({ item, isActive, onPress, badge }) => (
  <Button
    variant={isActive ? 'secondary' : 'ghost'}
    className={`w-full justify-start gap-2 ${isActive ? 'bg-primary/10 font-medium text-primary' : ''}`}
    onPress={onPress}
  >
    <item.icon className="h-5 w-5 shrink-0" />
    <span className="flex-1 text-start">{item.text}</span>
    {badge > 0 && (
      <span className="rounded-full bg-[#0f4c81] px-1.5 py-0.5 text-[10px] font-bold text-white">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </Button>
);

const isPathActive = (pathname, path) => (
  pathname === path || (path !== '/dashboard' && pathname.startsWith(`${path}/`))
);

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();
  const { factories, activeFactory, setActiveFactoryId } = useActiveFactory();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: unreadData } = useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => messageApi.getUnreadCount().then((res) => res.data),
    refetchInterval: 60_000,
    enabled: Boolean(user),
  });
  const unreadCount = Number(unreadData?.count || 0);

  const filteredNavItems = useMemo(() => {
    return navigationItems.filter((item) => item.roles.includes(user?.role));
  }, [user?.role]);

  const bottomItems = useMemo(() => {
    const paths = bottomNavPathsByRole[user?.role] || ['/dashboard'];
    return paths.map((path) => {
      if (path === '/profile') return profileShortcut;
      return filteredNavItems.find((item) => item.path === path);
    }).filter(Boolean);
  }, [filteredNavItems, user?.role]);

  const activeItem = [...filteredNavItems]
    .reverse()
    .find((item) => isPathActive(location.pathname, item.path));

  const handleLogout = async () => {
    await logout();
    showNotification('با موفقیت خارج شدید', 'success');
    navigate('/login');
  };

  const navigateTo = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const showFactorySwitcher = user?.role === 'FACTORY_OWNER' && factories.length > 1;

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-e border-default-200 bg-background lg:flex">
        <SidebarBrand />
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <p className="px-3 py-2 text-xs font-semibold text-foreground-500">منوی اصلی</p>
          {filteredNavItems.map((item) => (
            <NavButton
              key={item.path}
              item={item}
              isActive={isPathActive(location.pathname, item.path)}
              onPress={() => navigate(item.path)}
              badge={item.path === '/messages' ? unreadCount : 0}
            />
          ))}
        </nav>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex h-full w-[min(20rem,88vw)] flex-col bg-background pb-safe shadow-2xl">
            <div className="flex items-center justify-between border-b border-default-200 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f4c81] text-lg font-bold text-white">
                  M
                </div>
                <div>
                  <p className="font-bold">MEKSS</p>
                  <p className="text-xs text-foreground-500">{roleLabels[user?.role] || user?.role}</p>
                </div>
              </div>
              <Button variant="ghost" isIconOnly className="touch-target" onPress={() => setSidebarOpen(false)} aria-label="بستن منو">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
              {filteredNavItems.map((item) => (
                <NavButton
                  key={item.path}
                  item={item}
                  isActive={isPathActive(location.pathname, item.path)}
                  onPress={() => navigateTo(item.path)}
                  badge={item.path === '/messages' ? unreadCount : 0}
                />
              ))}
            </nav>
            <div className="space-y-1 border-t border-default-200 p-2">
              <NavButton item={{ path: '/profile', text: 'پروفایل', icon: User }} isActive={location.pathname === '/profile'} onPress={() => navigateTo('/profile')} />
              <NavButton item={{ path: '/settings', text: 'تنظیمات', icon: Settings }} isActive={location.pathname === '/settings'} onPress={() => navigateTo('/settings')} />
              <Button variant="ghost" className="w-full justify-start gap-2 text-danger" onPress={handleLogout}>
                <LogOut className="h-5 w-5 shrink-0" />
                خروج از حساب
              </Button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-default-200 bg-background/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-sm backdrop-blur lg:h-16 lg:px-4 lg:py-0 lg:pt-0">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              isIconOnly
              className="touch-target lg:hidden"
              onPress={() => setSidebarOpen(true)}
              aria-label="باز کردن منو"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="truncate text-base font-bold text-foreground lg:text-lg">
              {activeItem?.text || 'سامانه مدیریت شهرک صنعتی'}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {showFactorySwitcher && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="tertiary" size="sm" className="max-w-[10rem] truncate text-xs">
                    {activeFactory?.name || 'انتخاب واحد'}
                  </Button>
                </DropdownTrigger>
                <DropdownPopover placement="bottom end">
                  <DropdownMenu aria-label="انتخاب واحد فعال">
                    {factories.map((factory) => (
                      <DropdownItem
                        key={factory.id}
                        id={factory.id}
                        onPress={() => setActiveFactoryId(factory.id)}
                      >
                        {factory.name}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </DropdownPopover>
              </Dropdown>
            )}

            <Button
              variant="ghost"
              isIconOnly
              aria-label="پیام‌ها"
              className="relative"
              onPress={() => navigate('/messages')}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0f4c81] px-1 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '۹+' : unreadCount.toLocaleString('fa-IR')}
                </span>
              )}
            </Button>

            <Dropdown>
              <DropdownTrigger>
                <div className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1.5 hover:bg-default-100">
                  <Avatar size="sm" className="bg-[#0f4c81] text-white">
                    <Avatar.Fallback>{user?.name?.charAt(0) || 'U'}</Avatar.Fallback>
                  </Avatar>
                  <div className="hidden flex-col items-start md:flex">
                    <span className="text-sm font-medium">{user?.name || 'کاربر'}</span>
                    <span className="text-xs text-foreground-500">{roleLabels[user?.role] || user?.role}</span>
                  </div>
                </div>
              </DropdownTrigger>
              <DropdownPopover placement="bottom end">
                <DropdownMenu aria-label="Profile actions">
                  <DropdownItem
                    id="profile"
                    className="flex items-center gap-2"
                    onPress={() => navigate('/profile')}
                  >
                    <User className="h-4 w-4" />
                    پروفایل
                  </DropdownItem>
                  <DropdownItem
                    id="settings"
                    className="flex items-center gap-2"
                    onPress={() => navigate('/settings')}
                  >
                    <Settings className="h-4 w-4" />
                    تنظیمات
                  </DropdownItem>
                  <DropdownItem
                    id="logout"
                    variant="danger"
                    className="flex items-center gap-2"
                    onPress={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    خروج
                  </DropdownItem>
                </DropdownMenu>
              </DropdownPopover>
            </Dropdown>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 pb-app sm:p-4 md:p-6 lg:p-8 lg:pb-8">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>

        <nav
          aria-label="ناوبری موبایل"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-default-200 bg-background/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-background/90 lg:hidden"
        >
          <div className="grid grid-cols-5">
            {bottomItems.map((item) => {
              const active = isPathActive(location.pathname, item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`relative flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium transition ${
                    active ? 'text-[#0f4c81]' : 'text-foreground-500'
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${active ? 'stroke-[2.25]' : ''}`} />
                  <span className="max-w-full truncate">{bottomShortLabels[item.path] || item.text}</span>
                  {item.path === '/messages' && unreadCount > 0 && (
                    <span className="absolute end-2 top-2 h-1.5 w-1.5 rounded-full bg-[#0f4c81]" />
                  )}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="flex min-h-[3.75rem] flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium text-foreground-500"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>منو</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default DashboardLayout;
