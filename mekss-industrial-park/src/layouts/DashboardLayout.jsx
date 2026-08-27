import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AppBar,
  Avatar,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import {
  AccountCircle as AccountCircleIcon,
  AdUnits as AdUnitsIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Analytics as AnalyticsIcon,
  Assignment as AssignmentIcon,
  Business as BusinessIcon,
  Campaign as CampaignIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  Dashboard as DashboardIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Message as MessageIcon,
  MoreHoriz as MoreIcon,
  Notifications as NotificationsIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  SupervisorAccount as SuperAdminIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useAuth } from '../providers/AuthProvider';
import { messageApi } from '../services/api/message.api';

const EXPANDED_DRAWER_WIDTH = 288;
const COLLAPSED_DRAWER_WIDTH = 88;
const MOBILE_DRAWER_WIDTH = 304;

const roleLabels = {
  FACTORY_OWNER: 'مدیر واحد صنعتی',
  PARK_MANAGER: 'مدیر شهرک',
  SECURITY_GUARD: 'نگهبان',
  GOVERNMENT_OFFICIAL: 'نماینده دولت',
  SUPER_ADMIN: 'مدیر کل سامانه',
};

const dashboardItem = { text: 'داشبورد', icon: <DashboardIcon />, path: '/dashboard' };

const navigationByRole = {
  FACTORY_OWNER: [
    {
      label: 'عملیات واحد',
      items: [
        { text: 'برگ‌های خروج', icon: <ConfirmationNumberIcon />, path: '/gate-passes' },
        { text: 'قبض‌ها', icon: <ReceiptIcon />, path: '/invoices' },
        { text: 'درخواست‌های من', icon: <AssignmentIcon />, path: '/requests' },
      ],
    },
    {
      label: 'ارتباطات',
      items: [
        { text: 'صندوق پیام', icon: <MessageIcon />, path: '/messages' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/announcements' },
        { text: 'آگهی‌ها', icon: <AdUnitsIcon />, path: '/advertisements' },
        { text: 'امداد و حریق', icon: <WarningIcon />, path: '/emergency' },
      ],
    },
  ],
  PARK_MANAGER: [
    {
      label: 'مدیریت شهرک',
      items: [
        { text: 'واحدهای صنعتی', icon: <BusinessIcon />, path: '/admin/factories' },
        { text: 'برگ‌های خروج', icon: <ConfirmationNumberIcon />, path: '/admin/gate-passes' },
        { text: 'قبض‌ها', icon: <ReceiptIcon />, path: '/admin/invoices' },
        { text: 'درخواست‌ها', icon: <AssignmentIcon />, path: '/admin/requests' },
        { text: 'گزارش‌ها', icon: <AnalyticsIcon />, path: '/admin/reports' },
      ],
    },
    {
      label: 'انتشار و ارتباطات',
      items: [
        { text: 'ارسال پیام', icon: <MessageIcon />, path: '/admin/messages' },
        { text: 'صندوق پیام', icon: <NotificationsIcon />, path: '/messages' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/admin/announcements' },
        { text: 'آگهی‌ها', icon: <AdUnitsIcon />, path: '/admin/advertisements' },
        { text: 'امداد و حریق', icon: <WarningIcon />, path: '/emergency' },
      ],
    },
  ],
  SECURITY_GUARD: [
    {
      label: 'حراست و ایمنی',
      items: [
        { text: 'برگ‌های در انتظار', icon: <SecurityIcon />, path: '/guard/gate-passes' },
        { text: 'اعلام‌های حریق', icon: <WarningIcon />, path: '/guard/emergency' },
        { text: 'صندوق پیام', icon: <MessageIcon />, path: '/messages' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/announcements' },
      ],
    },
  ],
  GOVERNMENT_OFFICIAL: [
    {
      label: 'نظارت',
      items: [
        { text: 'گزارش‌ها و آمار', icon: <AnalyticsIcon />, path: '/admin/reports' },
        { text: 'قبض‌ها', icon: <ReceiptIcon />, path: '/invoices' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/announcements' },
        { text: 'صندوق پیام', icon: <MessageIcon />, path: '/messages' },
      ],
    },
  ],
  SUPER_ADMIN: [
    {
      label: 'مدیریت سامانه',
      items: [
        { text: 'شهرک‌ها', icon: <AdminPanelSettingsIcon />, path: '/superadmin/parks' },
        { text: 'کاربران', icon: <SuperAdminIcon />, path: '/superadmin/users' },
        { text: 'تنظیمات پیامک', icon: <SettingsIcon />, path: '/superadmin/sms-config' },
      ],
    },
    {
      label: 'عملیات شهرک',
      items: [
        { text: 'واحدهای صنعتی', icon: <BusinessIcon />, path: '/admin/factories' },
        { text: 'برگ‌های خروج', icon: <ConfirmationNumberIcon />, path: '/admin/gate-passes' },
        { text: 'قبض‌ها', icon: <ReceiptIcon />, path: '/admin/invoices' },
        { text: 'درخواست‌ها', icon: <AssignmentIcon />, path: '/admin/requests' },
        { text: 'ارسال پیام', icon: <MessageIcon />, path: '/admin/messages' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/admin/announcements' },
        { text: 'آگهی‌ها', icon: <AdUnitsIcon />, path: '/superadmin/advertisements' },
        { text: 'گزارش‌ها', icon: <AnalyticsIcon />, path: '/admin/reports' },
      ],
    },
    {
      label: 'حراست و ایمنی',
      items: [
        { text: 'کنترل برگ خروج', icon: <SecurityIcon />, path: '/guard/gate-passes' },
        { text: 'اعلام‌های حریق', icon: <WarningIcon />, path: '/guard/emergency' },
      ],
    },
  ],
};

const EMPTY_GROUPS = [];

const primaryMobilePathByRole = {
  FACTORY_OWNER: '/gate-passes',
  PARK_MANAGER: '/admin/factories',
  SECURITY_GUARD: '/guard/gate-passes',
  GOVERNMENT_OFFICIAL: '/admin/reports',
  SUPER_ADMIN: '/superadmin/parks',
};

const isPathActive = (currentPath, itemPath) =>
  currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery(
    /** @param {import('@mui/material').Theme} theme */ (theme) => theme.breakpoints.up('lg'),
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(true);
  const [profileAnchor, setProfileAnchor] = useState(null);

  const roleGroups = navigationByRole[user?.role] || EMPTY_GROUPS;
  const allNavigationItems = useMemo(
    () => [dashboardItem, ...roleGroups.flatMap((group) => group.items)],
    [roleGroups],
  );

  const { data: inbox } = useQuery({
    queryKey: ['messages', 'inbox'],
    queryFn: () => messageApi.getInbox().then((response) => response.data),
    staleTime: 30_000,
  });
  const unreadCount = Array.isArray(inbox)
    ? inbox.filter((message) => message.status === 'UNREAD').length
    : 0;

  const activeItem = allNavigationItems
    .slice()
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => isPathActive(location.pathname, item.path));

  const handleNavigate = (path) => {
    navigate(path);
    setMobileDrawerOpen(false);
    setProfileAnchor(null);
  };

  const handleLogout = () => {
    setProfileAnchor(null);
    logout();
  };

  const renderNavigationItem = (item, expanded) => {
    const selected = isPathActive(location.pathname, item.path);
    const button = (
      <ListItemButton
        selected={selected}
        onClick={() => handleNavigate(item.path)}
        aria-current={selected ? 'page' : undefined}
        aria-label={!expanded ? item.text : undefined}
        sx={{
          minHeight: 48,
          justifyContent: expanded ? 'initial' : 'center',
          px: expanded ? 1.5 : 1,
          mx: 1,
          my: 0.25,
        }}
      >
        <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', me: expanded ? 1.5 : 0 }}>
          {item.icon}
        </ListItemIcon>
        {expanded && <ListItemText primary={item.text} primaryTypographyProps={{ noWrap: true }} />}
      </ListItemButton>
    );

    return (
      <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
        {expanded ? button : <Tooltip title={item.text} placement="left">{button}</Tooltip>}
      </ListItem>
    );
  };

  const drawerContent = (expanded, temporary = false) => (
    <Box
      component="nav"
      aria-label="منوی اصلی سامانه"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        pt: 'env(safe-area-inset-top)',
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.25}
        sx={{ minHeight: 72, px: expanded ? 2 : 1.5, flexShrink: 0 }}
      >
        <Box
          aria-hidden="true"
          sx={{
            width: 40,
            height: 40,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 2.5,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontWeight: 800,
            letterSpacing: '-0.04em',
          }}
        >
          M
        </Box>
        {expanded && (
          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Typography variant="subtitle1" fontWeight={800} noWrap>MEKSS</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>مدیریت شهرک صنعتی</Typography>
          </Box>
        )}
        <Tooltip title={temporary ? 'بستن منو' : expanded ? 'جمع کردن منو' : 'باز کردن منو'}>
          <IconButton
            onClick={() => temporary ? setMobileDrawerOpen(false) : setRailExpanded((value) => !value)}
            aria-label={temporary ? 'بستن منو' : expanded ? 'جمع کردن منو' : 'باز کردن منو'}
            size="small"
          >
            {temporary ? <ChevronRightIcon /> : expanded ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </IconButton>
        </Tooltip>
      </Stack>

      <Divider />
      <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        <List disablePadding>{renderNavigationItem(dashboardItem, expanded)}</List>
        {roleGroups.map((group) => (
          <List
            key={group.label}
            disablePadding
            subheader={expanded ? (
              <ListSubheader
                disableSticky
                component="div"
                sx={{ bgcolor: 'transparent', lineHeight: '36px', fontSize: '0.72rem', fontWeight: 700 }}
              >
                {group.label}
              </ListSubheader>
            ) : <Divider sx={{ my: 1, mx: 2 }} />}
          >
            {group.items.map((item) => renderNavigationItem(item, expanded))}
          </List>
        ))}
      </Box>

      <Divider />
      {expanded && (
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, py: 1.5 }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main' }}>
            {user?.name?.charAt(0) || <AccountCircleIcon />}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>{user?.name || 'کاربر سامانه'}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {roleLabels[user?.role] || user?.role}
            </Typography>
          </Box>
        </Stack>
      )}
      <List disablePadding sx={{ px: 1, pb: 1 }}>
        {renderNavigationItem({ text: 'پروفایل', icon: <PersonIcon />, path: '/profile' }, expanded)}
        {renderNavigationItem({ text: 'تنظیمات', icon: <SettingsIcon />, path: '/settings' }, expanded)}
        <ListItem disablePadding>
          <Tooltip title={!expanded ? 'خروج از حساب' : ''} placement="left">
            <ListItemButton
              onClick={handleLogout}
              aria-label="خروج از حساب"
              sx={{
                minHeight: 48,
                justifyContent: expanded ? 'initial' : 'center',
                px: expanded ? 1.5 : 1,
                mx: 1,
                color: 'error.main',
              }}
            >
              <ListItemIcon sx={{ minWidth: 0, justifyContent: 'center', me: expanded ? 1.5 : 0, color: 'inherit' }}>
                <LogoutIcon />
              </ListItemIcon>
              {expanded && <ListItemText primary="خروج از حساب" />}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      </List>
    </Box>
  );

  const primaryMobileItem = allNavigationItems.find(
    (item) => item.path === primaryMobilePathByRole[user?.role],
  ) || dashboardItem;
  const bottomPaths = ['/dashboard', primaryMobileItem.path, '/messages', '/announcements'];
  const bottomValue = bottomPaths.find((path) => isPathActive(location.pathname, path)) || false;

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      {isDesktop && (
        <Drawer
          variant="permanent"
          anchor="right"
          open
          sx={{
            width: railExpanded ? EXPANDED_DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: railExpanded ? EXPANDED_DRAWER_WIDTH : COLLAPSED_DRAWER_WIDTH,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              borderInlineStart: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {drawerContent(railExpanded)}
        </Drawer>
      )}

      {!isDesktop && (
        <Drawer
          variant="temporary"
          anchor="right"
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: MOBILE_DRAWER_WIDTH,
              maxWidth: 'calc(100vw - 40px)',
              boxSizing: 'border-box',
              borderStartStartRadius: 24,
              borderEndStartRadius: 24,
            },
          }}
        >
          {drawerContent(true, true)}
        </Drawer>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, flexGrow: 1 }}>
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            top: 0,
            bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(248, 250, 252, 0.82)' : 'rgba(13, 15, 18, 0.82)',
            backdropFilter: 'saturate(160%) blur(18px)',
            WebkitBackdropFilter: 'saturate(160%) blur(18px)',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 60, sm: 68 }, pt: 'env(safe-area-inset-top)', px: { xs: 1.25, sm: 2.5 } }}>
            {!isDesktop && (
              <IconButton onClick={() => setMobileDrawerOpen(true)} aria-label="باز کردن منوی اصلی" edge="start">
                <MenuIcon />
              </IconButton>
            )}
            <Box sx={{ minWidth: 0, flexGrow: 1, px: 1 }}>
              <Typography component="h1" variant="subtitle1" fontWeight={800} noWrap>
                {activeItem?.text || 'سامانه مدیریت شهرک صنعتی'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
                {roleLabels[user?.role] || 'پنل کاربری MEKSS'}
              </Typography>
            </Box>
            <Tooltip title="پیام‌ها">
              <IconButton onClick={() => handleNavigate('/messages')} aria-label={`${unreadCount} پیام خوانده‌نشده`}>
                <Badge badgeContent={unreadCount} max={99} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="حساب کاربری">
              <IconButton onClick={(event) => setProfileAnchor(event.currentTarget)} aria-label="باز کردن منوی حساب کاربری">
                <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.9rem' }}>
                  {user?.name?.charAt(0) || <AccountCircleIcon fontSize="small" />}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          id="main-content"
          sx={{
            width: '100%',
            maxWidth: 1600,
            mx: 'auto',
            flexGrow: 1,
            p: { xs: 1.5, sm: 2.5, lg: 3 },
            pb: { xs: 'calc(92px + env(safe-area-inset-bottom))', lg: 3 },
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {!isDesktop && (
        <BottomNavigation
          showLabels
          value={bottomValue}
          onChange={(_event, value) => {
            if (value === 'more') setMobileDrawerOpen(true);
            else handleNavigate(value);
          }}
          aria-label="دسترسی سریع"
          sx={{
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            height: 'calc(68px + env(safe-area-inset-bottom))',
            pb: 'env(safe-area-inset-bottom)',
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: (theme) => theme.palette.mode === 'light' ? 'rgba(255, 255, 255, 0.94)' : 'rgba(24, 26, 30, 0.94)',
            backdropFilter: 'saturate(150%) blur(18px)',
            WebkitBackdropFilter: 'saturate(150%) blur(18px)',
          }}
        >
          <BottomNavigationAction label="خانه" value="/dashboard" icon={<DashboardIcon />} />
          <BottomNavigationAction label={primaryMobileItem.text} value={primaryMobileItem.path} icon={primaryMobileItem.icon} />
          <BottomNavigationAction
            label="پیام‌ها"
            value="/messages"
            icon={<Badge badgeContent={unreadCount} max={99} color="error"><MessageIcon /></Badge>}
          />
          <BottomNavigationAction label="اطلاعیه‌ها" value="/announcements" icon={<CampaignIcon />} />
          <BottomNavigationAction label="بیشتر" value="more" icon={<MoreIcon />} />
        </BottomNavigation>
      )}

      <Menu
        anchorEl={profileAnchor}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        open={Boolean(profileAnchor)}
        onClose={() => setProfileAnchor(null)}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 190 } } }}
      >
        <MenuItem onClick={() => handleNavigate('/profile')}><PersonIcon fontSize="small" sx={{ me: 1.25 }} />پروفایل</MenuItem>
        <MenuItem onClick={() => handleNavigate('/settings')}><SettingsIcon fontSize="small" sx={{ me: 1.25 }} />تنظیمات</MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}><LogoutIcon fontSize="small" sx={{ me: 1.25 }} />خروج از حساب</MenuItem>
      </Menu>
    </Box>
  );
};
