-- Initial canonical MEKSS schema. Generated from prisma/schema.prisma and committed for prisma migrate deploy.

CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'SECURITY_GUARD', 'GOVERNMENT_OFFICIAL', 'EMPLOYEE');
CREATE TYPE "RequestType" AS ENUM ('MISSION', 'TRANSFER', 'DAILY_LEAVE', 'HOURLY_LEAVE', 'LOAN', 'SETTLEMENT', 'CONSTRUCTION_PERMIT', 'FINAL_INSPECTION', 'APPOINTMENT', 'OTHER');
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'VERIFIED', 'FAILED', 'CANCELLED');
CREATE TYPE "GatePassStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'EXPIRED');
CREATE TYPE "CargoType" AS ENUM ('RAW_MATERIALS', 'FINISHED_GOODS', 'WASTE', 'SUPPLIES', 'EQUIPMENT', 'OTHER');
CREATE TYPE "VehicleType" AS ENUM ('TRUCK', 'VAN', 'CAR', 'MOTORCYCLE', 'OTHER');
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED');
CREATE TYPE "FactoryStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE "ParkStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "MessageStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');
CREATE TYPE "AdvertisementCategory" AS ENUM ('EQUIPMENT', 'SERVICES', 'RAW_MATERIALS', 'JOB_LISTINGS', 'REAL_ESTATE', 'OTHER');
CREATE TYPE "AdvertisementStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'PASSWORD_RESET', 'SENSITIVE_ACTION');
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'EMERGENCY');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "phoneNumber" TEXT NOT NULL, "username" TEXT, "password" TEXT NOT NULL,
  "name" TEXT NOT NULL, "nationalId" TEXT, "email" TEXT, "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
  "isApproved" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false, "avatar" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "lastLoginAt" TIMESTAMP(3), CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IndustrialPark" (
  "id" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "province" TEXT NOT NULL, "city" TEXT NOT NULL,
  "address" TEXT NOT NULL, "phoneNumber" TEXT NOT NULL, "email" TEXT, "guardPhone" TEXT NOT NULL,
  "totalArea" INTEGER NOT NULL DEFAULT 0, "totalFactories" INTEGER NOT NULL DEFAULT 0, "activeFactories" INTEGER NOT NULL DEFAULT 0,
  "establishedDate" TIMESTAMP(3), "description" TEXT, "logo" TEXT, "status" "ParkStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IndustrialPark_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Factory" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "licenseNumber" TEXT NOT NULL, "licenseExpiry" TIMESTAMP(3),
  "nationalId" TEXT NOT NULL, "activityType" TEXT NOT NULL, "address" TEXT NOT NULL, "location" JSONB,
  "phoneNumber" TEXT NOT NULL, "email" TEXT, "website" TEXT, "description" TEXT, "establishedDate" TIMESTAMP(3),
  "employees" INTEGER NOT NULL DEFAULT 0, "status" "FactoryStatus" NOT NULL DEFAULT 'PENDING', "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "managerId" TEXT NOT NULL, "parkId" TEXT NOT NULL,
  CONSTRAINT "Factory_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "FactoryEmployee" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "phoneNumber" TEXT NOT NULL, "nationalId" TEXT NOT NULL, "email" TEXT,
  "position" TEXT NOT NULL, "department" TEXT NOT NULL, "hireDate" TIMESTAMP(3) NOT NULL, "salary" DECIMAL(15,2) NOT NULL,
  "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE', "emergencyContact" TEXT, "address" TEXT, "birthDate" TIMESTAMP(3), "avatar" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "factoryId" TEXT NOT NULL,
  CONSTRAINT "FactoryEmployee_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GatePass" (
  "id" TEXT NOT NULL, "cargoType" "CargoType" NOT NULL, "cargoDescription" TEXT, "driverName" TEXT NOT NULL,
  "driverNationalId" TEXT NOT NULL, "driverPhone" TEXT NOT NULL, "vehicleType" "VehicleType" NOT NULL, "licensePlate" TEXT NOT NULL,
  "licensePlatePhoto" TEXT, "exitDate" TIMESTAMP(3) NOT NULL, "entryDate" TIMESTAMP(3), "status" "GatePassStatus" NOT NULL DEFAULT 'PENDING',
  "notes" TEXT, "qrCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3), "factoryId" TEXT NOT NULL, "createdById" TEXT NOT NULL, "approvedById" TEXT, "verifiedById" TEXT,
  CONSTRAINT "GatePass_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL, "invoiceNumber" TEXT NOT NULL, "amount" DECIMAL(15,2) NOT NULL, "taxAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(15,2) NOT NULL, "description" TEXT NOT NULL, "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueDate" TIMESTAMP(3) NOT NULL, "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING', "paymentDate" TIMESTAMP(3),
  "paymentMethod" TEXT, "paymentRef" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "factoryId" TEXT NOT NULL, "createdById" TEXT NOT NULL, "paidById" TEXT, CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaymentTransaction" (
  "id" TEXT NOT NULL, "authority" TEXT NOT NULL, "amount" DECIMAL(15,2) NOT NULL, "status" "PaymentStatus" NOT NULL DEFAULT 'INITIATED',
  "provider" TEXT NOT NULL DEFAULT 'ZARINPAL', "referenceId" TEXT, "providerStatus" JSONB, "verifiedAt" TIMESTAMP(3),
  "failureReason" TEXT, "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "invoiceId" TEXT NOT NULL, "initiatedById" TEXT, CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Message" (
  "id" TEXT NOT NULL, "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "status" "MessageStatus" NOT NULL DEFAULT 'UNREAD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  "senderId" TEXT NOT NULL, "receiverId" TEXT NOT NULL, CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Request" (
  "id" TEXT NOT NULL, "type" "RequestType" NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "data" JSONB NOT NULL,
  "attachments" TEXT[] NOT NULL, "status" "RequestStatus" NOT NULL DEFAULT 'PENDING', "priority" "RequestPriority" NOT NULL DEFAULT 'MEDIUM',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3), "rejectedAt" TIMESTAMP(3), "rejectionReason" TEXT, "creatorId" TEXT NOT NULL, "approverId" TEXT,
  "factoryId" TEXT NOT NULL, CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "isGlobal" BOOLEAN NOT NULL DEFAULT false,
  "isPinned" BOOLEAN NOT NULL DEFAULT false, "priority" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3), "parkId" TEXT, "createdById" TEXT NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Advertisement" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "category" "AdvertisementCategory" NOT NULL, "province" TEXT NOT NULL, "city" TEXT NOT NULL,
  "content" TEXT NOT NULL, "price" DECIMAL(15,2), "contactInfo" JSONB NOT NULL, "images" TEXT[] NOT NULL,
  "status" "AdvertisementStatus" NOT NULL DEFAULT 'PENDING', "isApproved" BOOLEAN NOT NULL DEFAULT false, "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL, CONSTRAINT "Advertisement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SecurityGuard" (
  "id" TEXT NOT NULL, "shiftStart" TIMESTAMP(3) NOT NULL, "shiftEnd" TIMESTAMP(3) NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "userId" TEXT NOT NULL, "parkId" TEXT NOT NULL,
  CONSTRAINT "SecurityGuard_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "RefreshToken" (
  "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
  "userAgent" TEXT, "ipAddress" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "userId" TEXT NOT NULL,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OtpChallenge" (
  "id" TEXT NOT NULL, "codeHash" TEXT NOT NULL, "purpose" "OtpPurpose" NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0, "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "phoneNumber" TEXT NOT NULL, "userId" TEXT, CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Notification" (
  "id" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT NOT NULL, "type" "NotificationType" NOT NULL DEFAULT 'INFO',
  "isRead" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "readAt" TIMESTAMP(3),
  "userId" TEXT NOT NULL, CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL, "action" TEXT NOT NULL, "entity" TEXT NOT NULL, "entityId" TEXT NOT NULL, "changes" JSONB,
  "ipAddress" TEXT, "userAgent" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "userId" TEXT,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "_ParkManager" ("A" TEXT NOT NULL, "B" TEXT NOT NULL);

CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_nationalId_key" ON "User"("nationalId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_isApproved_isActive_idx" ON "User"("role", "isApproved", "isActive");
CREATE UNIQUE INDEX "IndustrialPark_code_key" ON "IndustrialPark"("code");
CREATE INDEX "IndustrialPark_province_city_idx" ON "IndustrialPark"("province", "city");
CREATE INDEX "IndustrialPark_status_idx" ON "IndustrialPark"("status");
CREATE UNIQUE INDEX "Factory_licenseNumber_key" ON "Factory"("licenseNumber");
CREATE UNIQUE INDEX "Factory_nationalId_key" ON "Factory"("nationalId");
CREATE INDEX "Factory_managerId_idx" ON "Factory"("managerId");
CREATE INDEX "Factory_parkId_status_idx" ON "Factory"("parkId", "status");
CREATE INDEX "Factory_isApproved_idx" ON "Factory"("isApproved");
CREATE UNIQUE INDEX "FactoryEmployee_nationalId_key" ON "FactoryEmployee"("nationalId");
CREATE UNIQUE INDEX "FactoryEmployee_email_key" ON "FactoryEmployee"("email");
CREATE INDEX "FactoryEmployee_factoryId_status_idx" ON "FactoryEmployee"("factoryId", "status");
CREATE INDEX "FactoryEmployee_phoneNumber_idx" ON "FactoryEmployee"("phoneNumber");
CREATE UNIQUE INDEX "GatePass_qrCode_key" ON "GatePass"("qrCode");
CREATE INDEX "GatePass_factoryId_status_idx" ON "GatePass"("factoryId", "status");
CREATE INDEX "GatePass_createdAt_idx" ON "GatePass"("createdAt");
CREATE INDEX "GatePass_driverNationalId_idx" ON "GatePass"("driverNationalId");
CREATE INDEX "GatePass_licensePlate_idx" ON "GatePass"("licensePlate");
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX "Invoice_paymentRef_key" ON "Invoice"("paymentRef");
CREATE INDEX "Invoice_factoryId_status_idx" ON "Invoice"("factoryId", "status");
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE UNIQUE INDEX "PaymentTransaction_authority_key" ON "PaymentTransaction"("authority");
CREATE UNIQUE INDEX "PaymentTransaction_referenceId_key" ON "PaymentTransaction"("referenceId");
CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON "PaymentTransaction"("idempotencyKey");
CREATE INDEX "PaymentTransaction_invoiceId_status_idx" ON "PaymentTransaction"("invoiceId", "status");
CREATE INDEX "Message_receiverId_status_idx" ON "Message"("receiverId", "status");
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");
CREATE INDEX "Request_factoryId_status_idx" ON "Request"("factoryId", "status");
CREATE INDEX "Request_creatorId_createdAt_idx" ON "Request"("creatorId", "createdAt");
CREATE INDEX "Announcement_parkId_createdAt_idx" ON "Announcement"("parkId", "createdAt");
CREATE INDEX "Announcement_isGlobal_createdAt_idx" ON "Announcement"("isGlobal", "createdAt");
CREATE INDEX "Advertisement_category_status_idx" ON "Advertisement"("category", "status");
CREATE INDEX "Advertisement_province_city_idx" ON "Advertisement"("province", "city");
CREATE INDEX "Advertisement_createdAt_idx" ON "Advertisement"("createdAt");
CREATE UNIQUE INDEX "SecurityGuard_userId_shiftStart_key" ON "SecurityGuard"("userId", "shiftStart");
CREATE INDEX "SecurityGuard_parkId_isActive_idx" ON "SecurityGuard"("parkId", "isActive");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");
CREATE INDEX "OtpChallenge_phoneNumber_purpose_expiresAt_idx" ON "OtpChallenge"("phoneNumber", "purpose", "expiresAt");
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE UNIQUE INDEX "_ParkManager_AB_unique" ON "_ParkManager"("A", "B");
CREATE INDEX "_ParkManager_B_index" ON "_ParkManager"("B");

ALTER TABLE "Factory" ADD CONSTRAINT "Factory_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Factory" ADD CONSTRAINT "Factory_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FactoryEmployee" ADD CONSTRAINT "FactoryEmployee_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GatePass" ADD CONSTRAINT "GatePass_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Request" ADD CONSTRAINT "Request_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Request" ADD CONSTRAINT "Request_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Request" ADD CONSTRAINT "Request_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Advertisement" ADD CONSTRAINT "Advertisement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SecurityGuard" ADD CONSTRAINT "SecurityGuard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityGuard" ADD CONSTRAINT "SecurityGuard_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "IndustrialPark"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_ParkManager" ADD CONSTRAINT "_ParkManager_A_fkey" FOREIGN KEY ("A") REFERENCES "IndustrialPark"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_ParkManager" ADD CONSTRAINT "_ParkManager_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
