# MEKSS Industrial Park Management System - Backend

A comprehensive, production-ready backend API for managing industrial parks, built with NestJS, PostgreSQL, and Prisma.

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication with refresh tokens
- OTP verification via SMS (Kaveh Negar integration)
- Role-based access control (RBAC) with 5 user roles
- Multi-tenant architecture support

### 🏭 Factory & Park Management
- Complete factory CRUD operations
- Park management with multi-tenant support
- Employee management
- Service request handling

### 🚪 Gate Pass System
- Digital gate passes with QR codes
- Vehicle and personnel tracking
- Real-time status updates
- Approval workflows

### 💰 Invoice & Payment System
- Automated invoice generation
- ZarinPal payment gateway integration
- Payment tracking and notifications
- Overdue payment handling

### 📢 Communication System
- **Announcements**: Broadcast messages to specific roles/parks
- **Advertisements**: Promotional content management
- **Emergency Alerts**: Critical notifications with SMS/push
- **Internal Messaging**: User-to-user messaging

### 📊 Analytics & Reporting
- Real-time dashboard analytics
- Comprehensive reporting system
- Usage statistics and trends
- Performance metrics

### 🛡️ Security Features
- Rate limiting
- Input validation and sanitization
- SQL injection protection
- XSS protection
- CORS configuration
- Security headers

### 🚀 Performance & Scalability
- Redis caching
- Bull queue for background jobs
- Database connection pooling
- API pagination
- Optimized queries

## Technology Stack

- **Framework**: NestJS 10
- **Language**: TypeScript
- **Database**: PostgreSQL 15
- **ORM**: Prisma 5
- **Authentication**: JWT, Passport
- **Queue**: Bull (Redis)
- **Cache**: Redis
- **SMS Service**: Kaveh Negar
- **Payment Gateway**: ZarinPal
- **File Storage**: MinIO
- **Monitoring**: Health checks
- **Testing**: Jest, Supertest
- **Documentation**: Swagger/OpenAPI

## Project Structure

```
src/
├── auth/                 # Authentication & Authorization
├── factory/              # Factory management
├── gate-pass/            # Gate pass system
├── invoice/              # Invoice & payments
├── message/              # Internal messaging
├── request/              # Service requests
├── announcement/         # Announcements
├── advertisement/        # Advertisements
├── emergency/            # Emergency alerts
├── analytics/            # Analytics & reporting
├── shared/               # Shared utilities
│   ├── services/         # Shared services
│   ├── constants/        # Application constants
│   ├── utils/            # Utility functions
│   └── decorators/       # Custom decorators
└── app.module.ts         # Root module
```

## Installation

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- MinIO (for file storage)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mekss-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment configuration**
   ```bash
   cp .env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   # Application
   NODE_ENV=development
   PORT=3000
   
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/mekss"
   
   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   
   # JWT
   JWT_SECRET=your-jwt-secret
   JWT_REFRESH_SECRET=your-refresh-secret
   
   # SMS Service (Kaveh Negar)
   KAVEH_NEGAR_API_KEY=your-api-key
   KAVEH_NEGAR_SENDER=your-sender-number
   
   # Payment Gateway (ZarinPal)
   ZARINPAL_MERCHANT_ID=your-merchant-id
   ZARINPAL_CALLBACK_URL=http://localhost:3000/api/v1/payment/callback
   
   # File Storage (MinIO)
   MINIO_ENDPOINT=localhost
   MINIO_PORT=9000
   MINIO_ACCESS_KEY=minioadmin
   MINIO_SECRET_KEY=minioadmin
   MINIO_BUCKET_NAME=mekss-files
   
   # Email (Optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your-email
   SMTP_PASSWORD=your-password
   ```

4. **Database setup**
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   ```

5. **Run the application**
   ```bash
   # Development
   npm run start:dev
   
   # Production
   npm run build
   npm run start:prod
   ```

## API Documentation

Once the application is running, visit:
- Swagger UI: `http://localhost:3000/api`
- Health Check: `http://localhost:3000/health`

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Docker Deployment

### Using Docker Compose

1. **Build and run**
   ```bash
   docker-compose up -d
   ```

2. **Stop services**
   ```bash
   docker-compose down
   ```

### Production Deployment

1. **Build the image**
   ```bash
   docker build -t mekss-backend .
   ```

2. **Run the container**
   ```bash
   docker run -d \
     --name mekss-backend \
     -p 3000:3000 \
     --env-file .env \
     mekss-backend
   ```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Application port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_REFRESH_SECRET` | JWT refresh secret | - |
| `KAVEH_NEGAR_API_KEY` | SMS service API key | - |
| `ZARINPAL_MERCHANT_ID` | Payment gateway merchant ID | - |

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh token
- `POST /api/v1/auth/verify-otp` - Verify OTP
- `POST /api/v1/auth/logout` - User logout

### Factories
- `GET /api/v1/factories` - List factories
- `POST /api/v1/factories` - Create factory
- `GET /api/v1/factories/:id` - Get factory details
- `PUT /api/v1/factories/:id` - Update factory
- `DELETE /api/v1/factories/:id` - Delete factory

### Gate Passes
- `GET /api/v1/gate-passes` - List gate passes
- `POST /api/v1/gate-passes` - Create gate pass
- `GET /api/v1/gate-passes/:id` - Get gate pass details
- `PUT /api/v1/gate-passes/:id` - Update gate pass
- `POST /api/v1/gate-passes/:id/approve` - Approve gate pass
- `POST /api/v1/gate-passes/:id/reject` - Reject gate pass

### Invoices
- `GET /api/v1/invoices` - List invoices
- `POST /api/v1/invoices` - Create invoice
- `GET /api/v1/invoices/:id` - Get invoice details
- `PUT /api/v1/invoices/:id` - Update invoice
- `POST /api/v1/invoices/:id/pay` - Pay invoice

### Requests
- `GET /api/v1/requests` - List requests
- `POST /api/v1/requests` - Create request
- `GET /api/v1/requests/:id` - Get request details
- `PUT /api/v1/requests/:id` - Update request
- `POST /api/v1/requests/:id/approve` - Approve request
- `POST /api/v1/requests/:id/reject` - Reject request

### Announcements
- `GET /api/v1/announcements` - List announcements
- `POST /api/v1/announcements` - Create announcement
- `GET /api/v1/announcements/:id` - Get announcement details
- `PUT /api/v1/announcements/:id` - Update announcement
- `DELETE /api/v1/announcements/:id` - Delete announcement

### Emergency Alerts
- `GET /api/v1/emergency` - List emergency alerts
- `POST /api/v1/emergency` - Create emergency alert
- `GET /api/v1/emergency/:id` - Get emergency details
- `PUT /api/v1/emergency/:id` - Update emergency
- `POST /api/v1/emergency/:id/action` - Take action on emergency

### Analytics
- `GET /api/v1/analytics/dashboard` - Get dashboard data
- `GET /api/v1/analytics/factories` - Factory analytics
- `GET /api/v1/analytics/gate-passes` - Gate pass analytics
- `GET /api/v1/analytics/invoices` - Invoice analytics
- `GET /api/v1/analytics/reports` - Generate reports

## User Roles & Permissions

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
- Invoice viewing

### Security Guard
- Gate pass verification
- Emergency alerts
- Announcement viewing

### Government Official
- Read-only access to all data
- Analytics and reporting
- Compliance monitoring

## Monitoring & Logging

The application includes:
- Health check endpoints
- Request logging
- Error tracking
- Performance monitoring
- Security event logging

## Security Best Practices

1. **Authentication**
   - Strong password requirements
   - JWT token rotation
   - OTP verification
   - Session management

2. **Authorization**
   - Role-based access control
   - Resource-level permissions
   - API endpoint protection

3. **Data Protection**
   - Input validation
   - SQL injection prevention
   - XSS protection
   - Sensitive data encryption

4. **Infrastructure**
   - HTTPS enforcement
   - Rate limiting
   - CORS configuration
   - Security headers

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation

## Roadmap

- [ ] Mobile app API optimization
- [ ] Advanced analytics features
- [ ] AI-powered insights
- [ ] Integration with IoT devices
- [ ] Multi-language support
- [ ] Advanced reporting tools

---

**MEKSS Industrial Park Management System** - Empowering industrial parks with modern technology.
