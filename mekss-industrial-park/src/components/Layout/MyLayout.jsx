import React from 'react'
import { Layout, AppBar, Sidebar, Menu, UserMenu, useTranslate } from 'react-admin'
import { Typography, Badge, IconButton, MenuItem, ListItemIcon, ListItemText } from '@mui/material'
import { makeStyles } from '@mui/styles'
import {
  Dashboard as DashboardIcon,
  Business as BusinessIcon,
  People as PeopleIcon,
  AccountCircle as AccountIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  LocationCity as LocationCityIcon
} from '@mui/icons-material'

const useStyles = makeStyles((theme) => ({
  root: {
    '& .RaLayout-content': {
      padding: theme.spacing(2),
    },
  },
  title: {
    flex: 1,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  spacer: {
    flex: 1,
  },
  notifications: {
    marginLeft: theme.spacing(1),
  },
}))

const CustomAppBar = (props) => {
  const classes = useStyles()
  const translate = useTranslate()
  const [notifications, setNotifications] = React.useState(3) // Mock notification count

  const handleNotificationClick = () => {
    // Handle notification click
    console.log('Notifications clicked')
  }

  return (
    <AppBar {...props}>
      <Typography
        variant="h6"
        color="inherit"
        className={classes.title}
        id="react-admin-title"
      />
      <div className={classes.spacer} />
      <IconButton
        color="inherit"
        onClick={handleNotificationClick}
        className={classes.notifications}
      >
        <Badge badgeContent={notifications} color="secondary">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <UserMenu>
        <MenuItem>
          <ListItemIcon>
            <AccountIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{translate('ra.auth.profile')}</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{translate('ra.auth.settings')}</ListItemText>
        </MenuItem>
        <MenuItem>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{translate('ra.auth.logout')}</ListItemText>
        </MenuItem>
      </UserMenu>
    </AppBar>
  )
}

const CustomMenu = () => {
  const translate = useTranslate()

  return (
    <Menu>
      <Menu.DashboardItem
        primaryText={translate('dashboard.title')}
        leftIcon={<DashboardIcon />}
      />
      <Menu.ResourceItem
        name="factories"
        primaryText={translate('resources.factories.name')}
        leftIcon={<BusinessIcon />}
      />
      <Menu.ResourceItem
        name="employees"
        primaryText={translate('resources.employees.name')}
        leftIcon={<PeopleIcon />}
      />
      <Menu.ResourceItem
        name="parks"
        primaryText={translate('resources.parks.name')}
        leftIcon={<LocationCityIcon />}
      />
      <Menu.ResourceItem
        name="users"
        primaryText={translate('resources.users.name')}
        leftIcon={<PeopleIcon />}
      />
    </Menu>
  )
}

const CustomSidebar = (props) => (
  <Sidebar {...props}>
    <CustomMenu />
  </Sidebar>
)

const MyLayout = (props) => (
  <Layout
    {...props}
    appBar={CustomAppBar}
    sidebar={CustomSidebar}
    className={useStyles().root}
  />
)

export default MyLayout