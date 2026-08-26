import { useState } from 'react';
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

const Main = styled('main')(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginRight: -drawerWidth,
  '&[data-open="true"]': {
    marginRight: 0,
  },
}));

const AppBarStyled = styled(AppBar)(() => ({
  '&[data-open="true"]': {
    width: `calc(100% - ${drawerWidth}px)`,
    marginRight: drawerWidth,
  },
}));

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
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const isMenuOpen = Boolean(anchorEl);

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

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBarStyled position="fixed" data-open={open}>
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
            <IconButton size="large" onClick={handleProfileMenuOpen} color="inherit">
              <Avatar sx={{ width: 32, height: 32 }}>
                {user?.name?.charAt(0) || <AccountCircleIcon />}
              </Avatar>
            </IconButton>
          </Box>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="end"
            onClick={handleDrawerOpen}
            sx={{ ...(open && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>
        </Toolbar>
      </AppBarStyled>
      
      <Drawer
        sx={{ width: drawerWidth, flexShrink: 0, '& .MuiDrawer-paper': { width: drawerWidth } }}
        variant="persistent"
        anchor="right"
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}><MenuIcon /></IconButton>
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
      </Drawer>
      
      <Main data-open={open}>
        <DrawerHeader />
        <Outlet />
      </Main>
      
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
