import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
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
  useTheme,
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
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const drawerWidth = 280;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginRight: -drawerWidth,
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginRight: 0,
  }),
}));

const AppBarStyled = styled(AppBar, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginRight: drawerWidth,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-start',
}));

export const DashboardLayout = ({ children }) => {
  const theme = useTheme();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const isMenuOpen = Boolean(anchorEl);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleProfileMenuClose();
  };

  const getMenuItems = () => {
    const baseItems = [
      { text: 'داشبورد', icon: <DashboardIcon />, path: '/dashboard' },
    ];

    const roleBasedItems = {
      ADMIN: [
        { text: 'کارخانه‌ها', icon: <BusinessIcon />, path: '/factories' },
        { text: 'مجوزهای تردد', icon: <ConfirmationNumberIcon />, path: '/gate-passes' },
        { text: 'فاکتورها', icon: <ReceiptIcon />, path: '/invoices' },
        { text: 'درخواست‌ها', icon: <AssignmentIcon />, path: '/requests' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/announcements' },
        { text: 'تبلیغات', icon: <AdUnitsIcon />, path: '/advertisements' },
        { text: 'هشدارهای اضطراری', icon: <WarningIcon />, path: '/emergency' },
        { text: 'تحلیل‌ها', icon: <AnalyticsIcon />, path: '/analytics' },
      ],
      PARK_MANAGER: [
        { text: 'کارخانه‌ها', icon: <BusinessIcon />, path: '/factories' },
        { text: 'مجوزهای تردد', icon: <ConfirmationNumberIcon />, path: '/gate-passes' },
        { text: 'فاکتورها', icon: <ReceiptIcon />, path: '/invoices' },
        { text: 'درخواست‌ها', icon: <AssignmentIcon />, path: '/requests' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/announcements' },
        { text: 'تبلیغات', icon: <AdUnitsIcon />, path: '/advertisements' },
        { text: 'هشدارهای اضطراری', icon: <WarningIcon />, path: '/emergency' },
        { text: 'تحلیل‌ها', icon: <AnalyticsIcon />, path: '/analytics' },
      ],
      FACTORY_OWNER: [
        { text: 'کارخانه من', icon: <BusinessIcon />, path: '/factories' },
        { text: 'مجوزهای تردد', icon: <ConfirmationNumberIcon />, path: '/gate-passes' },
        { text: 'فاکتورها', icon: <ReceiptIcon />, path: '/invoices' },
        { text: 'درخواست‌ها', icon: <AssignmentIcon />, path: '/requests' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/announcements' },
        { text: 'تبلیغات', icon: <AdUnitsIcon />, path: '/advertisements' },
      ],
      SECURITY_GUARD: [
        { text: 'مجوزهای تردد', icon: <ConfirmationNumberIcon />, path: '/gate-passes' },
        { text: 'هشدارهای اضطراری', icon: <WarningIcon />, path: '/emergency' },
        { text: 'اطلاعیه‌ها', icon: <CampaignIcon />, path: '/announcements' },
      ],
      GOVERNMENT_OFFICIAL: [
        { text: 'کارخانه‌ها', icon: <BusinessIcon />, path: '/factories' },
        { text: 'مجوزهای تردد', icon: <ConfirmationNumberIcon />, path: '/gate-passes' },
        { text: 'فاکتورها', icon: <ReceiptIcon />, path: '/invoices' },
        { text: 'درخواست‌ها', icon: <AssignmentIcon />, path: '/requests' },
        { text: 'تحلیل‌ها', icon: <AnalyticsIcon />, path: '/analytics' },
      ],
    };

    return [...baseItems, ...(roleBasedItems[user?.role] || [])];
  };

  const menuItems = getMenuItems();

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBarStyled position="fixed" open={open}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            سیستم مدیریت مجتمع صنعتی MEKSS
          </Typography>
          <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
            <IconButton
              size="large"
              aria-label="show new notifications"
              color="inherit"
            >
              <Badge badgeContent={0} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleProfileMenuOpen}
              color="inherit"
            >
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
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
          },
        }}
        variant="persistent"
        anchor="right"
        open={open}
      >
        <DrawerHeader>
          <IconButton onClick={handleDrawerClose}>
            <MenuIcon />
          </IconButton>
        </DrawerHeader>
        <Divider />
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton onClick={() => window.location.href = item.path}>
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          <ListItem disablePadding>
            <ListItemButton onClick={() => window.location.href = '/profile'}>
              <ListItemIcon><PersonIcon /></ListItemIcon>
              <ListItemText primary="پروفایل" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={() => window.location.href = '/settings'}>
              <ListItemIcon><SettingsIcon /></ListItemIcon>
              <ListItemText primary="تنظیمات" />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout}>
              <ListItemIcon><LogoutIcon /></ListItemIcon>
              <ListItemText primary="خروج" />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      
      <Main open={open}>
        <DrawerHeader />
        {children}
      </Main>
      
      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={isMenuOpen}
        onClose={handleProfileMenuClose}
      >
        <MenuItem onClick={() => { window.location.href = '/profile'; handleProfileMenuClose(); }}>
          <Typography textAlign="center">پروفایل</Typography>
        </MenuItem>
        <MenuItem onClick={() => { window.location.href = '/settings'; handleProfileMenuClose(); }}>
          <Typography textAlign="center">تنظیمات</Typography>
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <Typography textAlign="center">خروج</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
};