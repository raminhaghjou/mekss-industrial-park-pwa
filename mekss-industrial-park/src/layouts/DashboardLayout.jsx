import { useState, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarItem,
  SidebarMenu,
  SidebarSection,
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Badge,
  Divider,
  useDisclosure,
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
  Phone,
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

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuTriggerRef = useRef(null);

  const filteredNavItems = useMemo(() => {
    return navigationItems.filter(item => item.roles.includes(user?.role));
  }, [user?.role]);

  const activeItem = filteredNavItems.find(item => location.pathname === item.path);

  const handleLogout = async () => {
    await logout();
    showNotification('با موفقیت خارج شدید', 'success');
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden lg:flex" defaultCollapsed={false}>
        <SidebarHeader className="flex items-center gap-2 px-4 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-lg font-bold text-white">
            M
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground">MEKSS</span>
            <span className="text-xs text-foreground-500">مدیریت شهرک صنعتی</span>
          </div>
        </SidebarHeader>
        
        <Divider />
        
        <SidebarContent>
          <SidebarSection title="منوی اصلی">
            {filteredNavItems.map((item) => (
              <SidebarItem
                key={item.path}
                onClick={() => navigate(item.path)}
                isActive={location.pathname === item.path}
                startContent={<item.icon className="h-5 w-5" />}
              >
                {item.text}
              </SidebarItem>
            ))}
          </SidebarSection>
        </SidebarContent>
      </Sidebar>

      {/* Mobile Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-default-200 px-4 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-lg font-bold text-white">
                  M
                </div>
                <span className="font-bold">MEKSS</span>
              </div>
              <Button variant="light" isIconOnly onClick={() => setSidebarOpen(false)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex flex-col gap-1 p-2">
              {filteredNavItems.map((item) => (
                <Button
                  key={item.path}
                  variant={location.pathname === item.path ? 'flat' : 'light'}
                  color={location.pathname === item.path ? 'primary' : 'default'}
                  className="justify-start"
                  startContent={<item.icon className="h-5 w-5" />}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                >
                  {item.text}
                </Button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Top Navbar */}
        <Navbar isBordered className="shadow-sm">
          <NavbarContent>
            <Button
              ref={menuTriggerRef}
              variant="light"
              isIconOnly
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <NavbarBrand>
              <h1 className="text-lg font-bold text-foreground">
                {activeItem?.text || 'سامانه مدیریت شهرک صنعتی'}
              </h1>
            </NavbarBrand>
          </NavbarContent>

          <NavbarContent justify="end">
            <NavbarItem>
              <Badge color="danger" content="" shape="circle" isInvisible={true}>
                <Button variant="light" isIconOnly>
                  <Bell className="h-5 w-5" />
                </Button>
              </Badge>
            </NavbarItem>
            
            <NavbarItem>
              <Dropdown placement="bottom-end">
                <DropdownTrigger>
                  <Button variant="light" className="flex items-center gap-2">
                    <Avatar
                      name={user?.name?.charAt(0) || 'U'}
                      size="sm"
                      className="bg-gradient-to-br from-primary-500 to-primary-700 text-white"
                    />
                    <div className="hidden flex-col items-start md:flex">
                      <span className="text-sm font-medium">{user?.name || 'کاربر'}</span>
                      <span className="text-xs text-foreground-500">{roleLabels[user?.role] || user?.role}</span>
                    </div>
                  </Button>
                </DropdownTrigger>
                <DropdownMenu aria-label="Profile actions">
                  <DropdownItem
                    key="profile"
                    startContent={<User className="h-4 w-4" />}
                    onClick={() => navigate('/profile')}
                  >
                    پروفایل
                  </DropdownItem>
                  <DropdownItem
                    key="settings"
                    startContent={<Settings className="h-4 w-4" />}
                    onClick={() => navigate('/settings')}
                  >
                    تنظیمات
                  </DropdownItem>
                  <DropdownItem
                    key="logout"
                    color="danger"
                    startContent={<LogOut className="h-4 w-4" />}
                    onClick={handleLogout}
                  >
                    خروج
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </NavbarItem>
          </NavbarContent>
        </Navbar>

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
