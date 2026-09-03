import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { useNotification } from '../providers/NotificationProvider';
import { roleLabels } from '../constants/persianLabels';

const navigationItems = [
  { path: '/dashboard', text: 'داشبورد', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'SECURITY_GUARD', 'GOVERNMENT_OFFICIAL', 'EMPLOYEE'] },
  { path: '/admin/factories', text: 'واحدهای صنعتی', icon: Building2, roles: ['SUPER_ADMIN', 'PARK_MANAGER'] },
  { path: '/admin/invoices', text: 'قبض‌ها', icon: Receipt, roles: ['SUPER_ADMIN', 'PARK_MANAGER'] },
  { path: '/invoices', text: 'قبض‌های من', icon: Receipt, roles: ['FACTORY_OWNER'] },
  { path: '/admin/gate-passes', text: 'برگ‌های خروج', icon: Ticket, roles: ['SUPER_ADMIN', 'PARK_MANAGER'] },
  { path: '/gate-passes', text: 'برگ‌های خروج من', icon: Ticket, roles: ['FACTORY_OWNER'] },
  { path: '/guard/gate-passes', text: 'تایید خروج', icon: ShieldCheck, roles: ['SECURITY_GUARD'] },
  { path: '/admin/requests', text: 'درخواست‌ها', icon: FileText, roles: ['SUPER_ADMIN', 'PARK_MANAGER'] },
  { path: '/requests', text: 'درخواست‌های من', icon: FileText, roles: ['FACTORY_OWNER'] },
  { path: '/messages', text: 'پیام‌ها', icon: MessageSquare, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'GOVERNMENT_OFFICIAL', 'EMPLOYEE'] },
  { path: '/announcements', text: 'اطلاعیه‌ها', icon: Bell, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'GOVERNMENT_OFFICIAL', 'SECURITY_GUARD', 'EMPLOYEE'] },
  { path: '/advertisements', text: 'آگهی‌ها', icon: Megaphone, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER'] },
  { path: '/emergency', text: 'هشدار اضطراری', icon: AlertTriangle, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'SECURITY_GUARD'] },
  { path: '/superadmin/parks', text: 'شهرک‌ها', icon: MapPin, roles: ['SUPER_ADMIN'] },
  { path: '/superadmin/users', text: 'کاربران', icon: Users, roles: ['SUPER_ADMIN'] },
  { path: '/admin/reports', text: 'گزارش‌ها', icon: FileText, roles: ['SUPER_ADMIN', 'PARK_MANAGER', 'GOVERNMENT_OFFICIAL'] },
];

const SidebarBrand = () => (
  <div className="flex items-center gap-2 px-4 py-6">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-lg font-bold text-white">
      M
    </div>
    <div className="flex flex-col">
      <span className="text-sm font-bold text-foreground">MEKSS</span>
      <span className="text-xs text-foreground-500">مدیریت شهرک صنعتی</span>
    </div>
  </div>
);

const NavButton = ({ item, isActive, onPress }) => (
  <Button
    variant={isActive ? 'secondary' : 'ghost'}
    className={`w-full justify-start gap-2 ${isActive ? 'bg-primary/10 font-medium text-primary' : ''}`}
    onPress={onPress}
  >
    <item.icon className="h-5 w-5 shrink-0" />
    {item.text}
  </Button>
);

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredNavItems = useMemo(() => {
    return navigationItems.filter(item => item.roles.includes(user?.role));
  }, [user?.role]);

  const activeItem = filteredNavItems.find(item => location.pathname === item.path);

  const handleLogout = async () => {
    await logout();
    showNotification('با موفقیت خارج شدید', 'success');
    navigate('/login');
  };

  const navigateTo = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-e border-default-200 bg-background lg:flex">
        <SidebarBrand />
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <p className="px-3 py-2 text-xs font-semibold text-foreground-500">منوی اصلی</p>
          {filteredNavItems.map((item) => (
            <NavButton
              key={item.path}
              item={item}
              isActive={location.pathname === item.path}
              onPress={() => navigate(item.path)}
            />
          ))}
        </nav>
      </aside>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute right-0 top-0 flex h-full w-72 flex-col bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-default-200 px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-lg font-bold text-white">
                  M
                </div>
                <span className="font-bold">MEKSS</span>
              </div>
              <Button variant="ghost" isIconOnly onPress={() => setSidebarOpen(false)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-col gap-1 overflow-y-auto p-2">
              {filteredNavItems.map((item) => (
                <NavButton
                  key={item.path}
                  item={item}
                  isActive={location.pathname === item.path}
                  onPress={() => navigateTo(item.path)}
                />
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-default-200 bg-background px-4 shadow-sm">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              isIconOnly
              className="lg:hidden"
              onPress={() => setSidebarOpen(true)}
              aria-label="باز کردن منو"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="truncate text-lg font-bold text-foreground">
              {activeItem?.text || 'سامانه مدیریت شهرک صنعتی'}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" isIconOnly aria-label="اعلان‌ها">
              <Bell className="h-5 w-5" />
            </Button>

            <Dropdown>
              <DropdownTrigger>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar size="sm" className="bg-gradient-to-br from-primary-500 to-primary-700 text-white">
                    <Avatar.Fallback>{user?.name?.charAt(0) || 'U'}</Avatar.Fallback>
                  </Avatar>
                  <div className="hidden flex-col items-start md:flex">
                    <span className="text-sm font-medium">{user?.name || 'کاربر'}</span>
                    <span className="text-xs text-foreground-500">{roleLabels[user?.role] || user?.role}</span>
                  </div>
                </Button>
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

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
