import { useEffect, useMemo, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Avatar,
  Dropdown,
  DropdownTrigger,
  DropdownPopover,
  DropdownMenu,
  DropdownItem,
} from '@heroui/react';
import { Bell, Settings, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { useActiveFactory } from '../providers/ActiveFactoryProvider';
import { useNotification } from '../providers/NotificationProvider';
import { messageApi } from '../services/api/message.api';
import { roleLabels } from '../constants/persianLabels';
import { pageTitleForPath, tabsForRole } from '../constants/appServices';
import { AuthenticatedImage } from '../components/common/AuthenticatedImage';
import { BackButton } from '../components/common/BackButton';

const isPathActive = (pathname, path) => (
  pathname === path || (path !== '/dashboard' && pathname.startsWith(`${path}/`))
);

const formatBadge = (count) => (count > 9 ? '۹+' : count.toLocaleString('fa-IR'));

const BrandMark = () => (
  <div className="flex items-center gap-2">
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-brand)] text-lg font-black text-white shadow-[0_6px_14px_-8px_var(--color-brand)]">
      M
    </div>
    <div className="flex flex-col leading-tight">
      <span className="text-sm font-black tracking-wide text-foreground">MEKSS</span>
      <span className="text-[11px] text-foreground-500">سامانه شهرک صنعتی</span>
    </div>
  </div>
);

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const { factories, activeFactory, setActiveFactoryId } = useActiveFactory();

  const { data: unreadData } = useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: () => messageApi.getUnreadCount().then((res) => res.data),
    refetchInterval: 30_000,
    enabled: Boolean(user),
  });
  const unreadCount = Number(unreadData?.count || 0);
  const unreadNotifications = unreadData ? Number(unreadData.notifications || 0) : null;
  const seenNotificationCountRef = useRef(null);

  useEffect(() => {
    if (unreadNotifications === null) return;
    const previous = seenNotificationCountRef.current;
    seenNotificationCountRef.current = unreadNotifications;
    if (previous === null) {
      if (unreadNotifications > 0) {
        showNotification(`${unreadNotifications.toLocaleString('fa-IR')} اعلان خوانده‌نشده دارید`, 'warning');
      }
      return;
    }
    if (unreadNotifications <= previous) return;
    messageApi.getNotifications()
      .then((res) => {
        const latest = (res.data || []).find((item) => !item.isRead);
        if (!latest) return;
        const severity = latest.type === 'WARNING' || latest.type === 'EMERGENCY' ? 'warning'
          : latest.type === 'SUCCESS' ? 'success' : 'info';
        showNotification(`${latest.title}: ${latest.body}`, severity);
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      })
      .catch(() => {});
  }, [unreadNotifications, showNotification, queryClient]);

  const tabs = useMemo(() => tabsForRole(user?.role), [user?.role]);
  const tabBadge = (tab) => (tab.badgeKey === 'unreadMessages' ? unreadCount : 0);
  const isHome = location.pathname === '/dashboard';
  const pageTitle = pageTitleForPath(location.pathname) || 'سامانه مدیریت شهرک صنعتی';

  const handleLogout = async () => {
    await logout();
    showNotification('با موفقیت خارج شدید', 'success');
    navigate('/login');
  };

  const showFactorySwitcher = user?.role === 'FACTORY_OWNER' && factories.length > 1;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-default-200/70 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 dark:border-white/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:px-4 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {isHome ? (
              <BrandMark />
            ) : (
              <>
                <BackButton />
                <h1 className="truncate text-base font-bold text-foreground lg:text-lg">{pageTitle}</h1>
              </>
            )}
          </div>

          <nav aria-label="ناوبری اصلی" className="hidden items-center gap-1 rounded-2xl bg-default-100/80 p-1 lg:flex dark:bg-white/5">
            {tabs.map((tab) => {
              const active = isPathActive(location.pathname, tab.path);
              const badge = tabBadge(tab);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => navigate(tab.path)}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] ${
                    active
                      ? 'bg-content1 text-[var(--color-brand)] shadow-[0_2px_8px_-4px_rgba(15,23,42,0.3)]'
                      : tab.tone === 'danger'
                        ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10'
                        : 'text-foreground-600 hover:bg-content1/70 hover:text-foreground'
                  }`}
                >
                  <tab.icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
                  {tab.title}
                  {badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white tabular-nums">
                      {formatBadge(badge)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex flex-1 shrink-0 items-center justify-end gap-1.5">
            {showFactorySwitcher && (
              <Dropdown>
                <DropdownTrigger>
                  <Button variant="tertiary" size="sm" className="max-w-[10rem] truncate rounded-xl text-xs">
                    {activeFactory?.name || 'انتخاب واحد'}
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
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
              aria-label={unreadCount > 0 ? `پیام‌ها — ${unreadCount.toLocaleString('fa-IR')} خوانده‌نشده` : 'پیام‌ها'}
              className="relative rounded-xl"
              onPress={() => navigate('/messages')}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                  {formatBadge(unreadCount)}
                </span>
              )}
            </Button>

            <Dropdown>
              <DropdownTrigger>
                <div
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-1.5 hover:bg-default-100"
                  aria-label="حساب کاربری"
                >
                  <Avatar size="sm" className="overflow-hidden bg-[var(--color-brand)] text-white">
                    {user?.avatar ? (
                      <AuthenticatedImage
                        fileId={user.avatar}
                        alt=""
                        className="h-full w-full object-cover"
                        fallback={<Avatar.Fallback>{user?.name?.charAt(0) || 'U'}</Avatar.Fallback>}
                      />
                    ) : (
                      <Avatar.Fallback>{user?.name?.charAt(0) || 'U'}</Avatar.Fallback>
                    )}
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
                    خروج از حساب
                  </DropdownItem>
                </DropdownMenu>
              </DropdownPopover>
            </Dropdown>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden p-3 pb-app sm:p-4 md:p-6 lg:p-8 lg:pb-8">
        <div className="mx-auto max-w-7xl animate-fade-in">
          <Outlet />
        </div>
      </main>

      <nav
        aria-label="ناوبری موبایل"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-default-200/70 bg-background/90 pb-safe backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 lg:hidden dark:border-white/10"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 px-2">
          {tabs.map((tab) => {
            const active = isPathActive(location.pathname, tab.path);
            const badge = tabBadge(tab);
            const danger = tab.tone === 'danger';
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.path)}
                aria-current={active ? 'page' : undefined}
                data-testid={`tab-${tab.id}`}
                className={`group relative flex min-h-[4rem] flex-col items-center justify-center gap-1 text-[11px] font-semibold outline-none transition active:scale-95 motion-reduce:transform-none ${
                  active ? 'text-[var(--color-brand)]' : danger ? 'text-rose-600 dark:text-rose-300' : 'text-foreground-500'
                }`}
              >
                <span
                  className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200 group-focus-visible:ring-2 group-focus-visible:ring-[var(--color-brand)] ${
                    active ? 'bg-[var(--color-brand-soft)]' : danger ? 'bg-rose-50 dark:bg-rose-500/10' : ''
                  }`}
                >
                  <tab.icon className={`h-5 w-5 ${active ? 'stroke-[2.3]' : ''}`} aria-hidden="true" />
                  {badge > 0 && (
                    <span className="absolute -top-1 end-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white ring-2 ring-background">
                      {formatBadge(badge)}
                    </span>
                  )}
                </span>
                <span>{tab.title}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default DashboardLayout;
