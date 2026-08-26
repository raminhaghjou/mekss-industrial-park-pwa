import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { messageApi } from '../services/api/message.api';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  Badge,
  MenuItem,
  Menu,
  Avatar,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  Receipt as ReceiptIcon,
  Assignment as AssignmentIcon,
  Campaign as CampaignIcon,
  AdUnits as AdUnitsIcon,
  Warning as WarningIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Message as MessageIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Security as SecurityIcon,
  SupervisorAccount as SuperAdminIcon,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const drawerWidth = 280;

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-start',
}));

export const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery(
    /** @param {import('@mui/material').Theme} theme */ (theme) => theme.breakpoints.up('lg'),
  );
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const isMenuOpen = Boolean(anchorEl);

  // Start with the rail open on desktop only; mobile/tablet always begin
  // closed since their drawer is temporary and overlays the page.
  useEffect(() => {
    setOpen(isDesktop);
  }, [isDesktop]);

  const { data: inbox } = useQuery({
    queryKey: ['messages', 'inbox'],
    queryFn: () => messageApi.getInbox().then((res) => res.data),
    staleTime: 30_000,
  });
  const unreadCount = (inbox || []).filter((message) => message.status === 'UNREAD').length;

  const handleDrawerOpen = () => setOpen(true);
  const handleDrawerClose = () => setOpen(false);
  const handleProfileMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleProfileMenuClose = () => setAnchorEl(null);

  const handleLogout = () => {
    logout();
    handleProfileMenuClose();
  };

  const handleNavigate = (path) => {
    navigate(path);
    handleProfileMenuClose();
    // On mobile/tablet the drawer overlays the page, so it must close after
    // a selection; on desktop the persistent rail stays exactly as the user
    // left it.
    if (!isDesktop) setOpen(false);
  }

  const getMenuItems = () => {
    const baseItems = [
      { text: 'داشبورد', icon: <DashboardIcon />, path: '/dashboard' },
    ];

    const roleBasedItems = {
      FACTORY_OWNER: [
        { text: 'برگ خروج', icon: <ConfirmationNumberIcon />, path: '/gate-passes' },
        { text: 'قبض‌ها', icon: <ReceiptIcon />, path: '/invoices' },
        { text: 'صندوق پیام', icon: <MessageIcon />, path: '/messages' },
        { text: 'درخواست‌های من', icon: <AssignmentIcon />, path: '/requests' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/announcements' },
        { text: 'آگهی‌ها', icon: <AdUnitsIcon />, path: '/advertisements' },
        { text: 'امداد و حریق', icon: <WarningIcon />, path: '/emergency' },
      ],
      PARK_MANAGER: [
        { text: 'مدیریت واحدها', icon: <BusinessIcon />, path: '/admin/factories' },
        { text: 'تایید برگ خروج', icon: <ConfirmationNumberIcon />, path: '/admin/gate-passes' },
        { text: 'مدیریت قبض‌ها', icon: <ReceiptIcon />, path: '/admin/invoices' },
        { text: 'تایید درخواست‌ها', icon: <AssignmentIcon />, path: '/admin/requests' },
        { text: 'ارسال پیام', icon: <MessageIcon />, path: '/admin/messages' },
        { text: 'مدیریت اطلاعیه‌ها', icon: <CampaignIcon />, path: '/admin/announcements' },
        { text: 'تایید آگهی‌ها', icon: <AdUnitsIcon />, path: '/admin/advertisements' },
        { text: 'گزارش‌گیری', icon: <AnalyticsIcon />, path: '/admin/reports' },
      ],
      SECURITY_GUARD: [
        { text: 'برگ‌های خروج در انتظار', icon: <SecurityIcon />, path: '/guard/gate-passes' },
        { text: 'مشاهده اعلام حریق', icon: <WarningIcon />, path: '/guard/emergency' },
      ],
      GOVERNMENT_OFFICIAL: [
        { text: 'گزارش‌ها و آمار', icon: <AnalyticsIcon />, path: '/admin/reports' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/announcements' },
      ],
      SUPER_ADMIN: [
          { text: 'مدیریت شهرک‌ها', icon: <AdminPanelSettingsIcon />, path: '/superadmin/parks' },
          { text: 'مدیریت کاربران', icon: <SuperAdminIcon />, path: '/superadmin/users' },
          { text: 'تایید آگهی‌ها', icon: <AdUnitsIcon />, path: '/superadmin/advertisements' },
          { text: 'تنظیمات پیامک', icon: <SettingsIcon />, path: '/superadmin/sms-config' },
      ]
    };

    return [...baseItems, ...(roleBasedItems[user?.role] || [])];
  };

  const menuItems = getMenuItems();

  const drawerContent = (
    <>
      <DrawerHeader>
        <IconButton onClick={handleDrawerClose} aria-label="بستن منو"><MenuIcon /></IconButton>
      </DrawerHeader>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton onClick={() => handleNavigate(item.path)}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavigate('/profile')}><ListItemIcon><PersonIcon /></ListItemIcon><ListItemText primary="پروفایل" /></ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={() => handleNavigate('/settings')}><ListItemIcon><SettingsIcon /></ListItemIcon><ListItemText primary="تنظیمات" /></ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}><ListItemIcon><LogoutIcon /></ListItemIcon><ListItemText primary="خروج" /></ListItemButton>
        </ListItem>
      </List>
    </>
  );

  const desktopOpen = isDesktop && open;

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          ...(desktopOpen && {
            width: { lg: `calc(100% - ${drawerWidth}px)` },
            marginRight: { lg: `${drawerWidth}px` },
          }),
        }}
      >
        <Toolbar>
          {/* <img src="/logo.png" alt="Mekss Logo" style={{ height: 40, marginLeft: 16 }} /> */}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            سامانه مدیریت شهرک صنعتی مکث
          </Typography>
          <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
            <IconButton size="large" color="inherit" onClick={() => handleNavigate('/messages')} aria-label="پیام‌ها">
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton size="large" onClick={handleProfileMenuOpen} color="inherit" aria-label="منوی حساب کاربری">
              <Avatar sx={{ width: 32, height: 32 }}>
                {user?.name?.charAt(0) || <AccountCircleIcon />}
              </Avatar>
            </IconButton>
          </Box>
          <IconButton
            color="inherit"
            aria-label="باز کردن منو"
            edge="end"
            onClick={handleDrawerOpen}
            sx={{ ...(open && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth, maxWidth: '85vw', boxSizing: 'border-box' } }}
        variant={isDesktop ? 'persistent' : 'temporary'}
        anchor="right"
        open={open}
        onClose={handleDrawerClose}
        ModalProps={{ keepMounted: true }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: 3,
          ...(desktopOpen && { marginRight: { lg: 0 } }),
          ...(!desktopOpen && { marginRight: { lg: `-${drawerWidth}px` } }),
        }}
      >
        <DrawerHeader />
        <Outlet />
      </Box>

      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        keepMounted
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={isMenuOpen}
        onClose={handleProfileMenuClose}
      >
        <MenuItem onClick={() => handleNavigate('/profile')}>پروفایل</MenuItem>
        <MenuItem onClick={() => handleNavigate('/settings')}>تنظیمات</MenuItem>
        <MenuItem onClick={handleLogout}>خروج</MenuItem>
      </Menu>
    </Box>
  );
};
