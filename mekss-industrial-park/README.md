# MEKSS Industrial Park Management System - Frontend

A complete React PWA (Progressive Web App) for managing industrial parks, built with React 18, TypeScript, and Material-UI.

## 🌟 Features

### Core Features
- **React 18** with TypeScript
- **Progressive Web App** (PWA) with offline support
- **Persian RTL** interface throughout
- **Material-UI** with custom theming
- **Role-based dashboards** for all user types
- **Real-time updates** with WebSocket support
- **Mobile responsive** design
- **JWT authentication** with token management

### User Interfaces
- **Admin Dashboard**: Full system control
- **Park Manager Dashboard**: Park oversight
- **Factory Owner Dashboard**: Factory operations
- **Security Guard Dashboard**: Gate operations
- **Government Official Dashboard**: Compliance monitoring

### Technical Features
- **React Query** for state management
- **React Router** for navigation
- **Axios** for API calls
- **Recharts** for data visualization
- **Date-fns** for date handling
- **PWA** with service worker
- **RTL support** with Persian locale
- **Dark/Light mode** theming

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Configuration
Create a `.env` file in the root directory:
```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
```

## 📁 Project Structure

```
src/
├── components/          # Reusable components
│   ├── common/         # Common components (Loading, RTL, etc.)
│   ├── dashboard/      # Dashboard-specific components
│   ├── forms/          # Form components
│   └── ui/             # UI components
├── layouts/            # Layout components
│   └── DashboardLayout.jsx
├── pages/              # Page components
│   ├── auth/           # Authentication pages
│   ├── dashboard/      # Dashboard page
│   ├── factories/      # Factory management pages
│   ├── gate-passes/    # Gate pass pages
│   ├── invoices/       # Invoice pages
│   └── ...             # Other pages
├── providers/          # Context providers
│   ├── AuthProvider.jsx
│   ├── ThemeProvider.jsx
│   └── NotificationProvider.jsx
├── services/           # API services
│   └── api/            # API modules
├── hooks/              # Custom hooks
├── utils/              # Utility functions
├── App.jsx             # Main app component
├── main.jsx            # Entry point
└── index.css           # Global styles
```

## 🎯 User Roles

### Admin
- Full system access
- User management
- System configuration
- Analytics and reporting

### Park Manager
- Park-specific management
- Factory oversight
- Service request approval
- Emergency management

### Factory Owner
- Factory management
- Employee management
- Gate pass requests
- Invoice management

### Security Guard
- Gate pass verification
- Emergency alerts
- Announcement viewing

### Government Official
- Read-only access to all data
- Analytics and reporting
- Compliance monitoring

## 🧩 Components

### Layout Components
- **DashboardLayout**: Main layout with sidebar and header
- **AuthLayout**: Authentication page layout

### Common Components
- **LoadingScreen**: Loading indicator
- **RTL**: RTL support wrapper
- **PrivateRoute**: Route protection

### Dashboard Components
- **StatsCards**: Statistics display cards
- **RecentActivity**: Recent activity feed
- **QuickActions**: Quick action buttons
- **ChartContainer**: Data visualization

### Form Components
- **LoginForm**: User login
- **RegisterForm**: User registration
- **GatePassForm**: Gate pass creation
- **RequestForm**: Service request creation

## 🔧 Configuration

### Theme Configuration
The theme is configured in `src/providers/ThemeProvider.jsx`:
- Persian RTL support
- Dark/Light mode toggle
- Custom color palette
- Typography settings

### API Configuration
API services are in `src/services/api/`:
- Base API configuration
- Authentication API
- Factory management API
- Gate pass API
- Invoice API
- Analytics API

### PWA Configuration
PWA settings are in `vite.config.js`:
- Service worker registration
- Offline support
- App manifest
- Caching strategies

## 📱 PWA Features

### Service Worker
- Offline functionality
- Background sync
- Push notifications ready
- Cache management

### App Manifest
- App name and icons
- Display mode
- Theme colors
- Language and direction

## 🎨 Styling

### Material-UI Theme
- Custom color palette
- Persian typography
- RTL support
- Dark/Light modes

### Global Styles
- RTL fixes for Material-UI
- Custom scrollbar
- Loading animations
- Responsive breakpoints

## 🔒 Security

### Authentication
- JWT token management
- Automatic token refresh
- Secure storage
- Role-based routing

### API Security
- Request interceptors
- Token injection
- Error handling
- Automatic logout on 401

## 📊 State Management

### React Query
- Server state management
- Automatic caching
- Background refetching
- Optimistic updates

### Context Providers
- Authentication state
- Theme state
- Notification state
- Global app state

## 🚀 Performance

### Code Splitting
- Lazy loading of routes
- Component code splitting
- Vendor chunk separation

### Caching
- Service worker caching
- API response caching
- Image optimization
- Static asset caching

### Optimization
- Tree shaking
- Minification
- Compression
- Bundle analysis

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm test:watch

# Run tests with coverage
npm test:cov
```

## 📦 Build & Deployment

### Build
```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Deployment
```dockerfile
# Multi-stage build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Environment Variables
```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
VITE_APP_NAME=MEKSS Industrial Park
VITE_APP_VERSION=1.0.0
```

## 🌐 Internationalization

### Persian (Farsi) Support
- RTL layout
- Persian date formatting
- Persian number formatting
- Persian typography

### RTL Support
- CSS RTL fixes
- Component RTL adjustments
- Layout direction
- Text alignment

## 🔧 Development Tools

### Recommended VS Code Extensions
- ESLint
- Prettier
- React Snippets
- Material-UI Snippets
- Tailwind CSS IntelliSense

### Debugging
- React DevTools
- Redux DevTools
- Network tab
- Console logging

## 📚 Documentation

### API Documentation
- Swagger/OpenAPI docs at `/api`
- Auto-generated client code
- TypeScript definitions

### Component Documentation
- JSDoc comments
- Prop types
- Usage examples

### Deployment Guide
- Docker deployment
- Nginx configuration
- SSL setup
- CI/CD pipeline

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation
- Review troubleshooting guides
- Check API documentation
- Create an issue in the repository

---

**MEKSS Industrial Park Management System** - Empowering industrial parks with modern technology.

For detailed setup instructions, refer to the main project documentation.