import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AdvertisementStatus, CargoType, EmergencySeverity, FactoryStatus, ParkStatus, RequestPriority, RequestType, Role, VehicleType } from '@prisma/client';

const iranianPhone = /^09\d{9}$/;
const opaqueId = /^[A-Za-z0-9_-]{1,128}$/;
const strongPassword = /^(?=.*[A-Za-z])(?=.*\d).{10,128}$/;
const usernamePattern = /^[a-z0-9._-]{3,64}$/;
const trimString = ({ value }: TransformFnParams) => typeof value === 'string' ? value.trim() : value;
const trimNullableString = ({ value }: TransformFnParams) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};
const lowercaseNullableString = ({ value }: TransformFnParams) => {
  const normalized = trimNullableString({ value } as TransformFnParams);
  return typeof normalized === 'string' ? normalized.toLowerCase() : normalized;
};
const normalizeIranianPhone = ({ value }: TransformFnParams) => {
  if (typeof value !== 'string') return value;
  const digits = value.trim().replace(/\D/g, '');
  if (digits.startsWith('0098')) return `0${digits.slice(4)}`;
  if (digits.startsWith('98')) return `0${digits.slice(2)}`;
  return digits;
};

export class OpaqueIdParamDto {
  @IsString() @Matches(opaqueId) id!: string;
}

export class CreateParkDto {
  @Transform(trimString) @IsString() @Length(2, 40) code!: string;
  @Transform(trimString) @IsString() @Length(2, 160) name!: string;
  @Transform(trimString) @IsString() @Length(2, 80) province!: string;
  @Transform(trimString) @IsString() @Length(2, 80) city!: string;
  @Transform(trimString) @IsString() @Length(2, 240) address!: string;
  @Transform(trimString) @IsString() @Length(6, 20) phoneNumber!: string;
  @Transform(trimNullableString) @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @Transform(trimString) @IsString() @Length(6, 20) guardPhone!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647) totalArea?: number;
  @Transform(trimNullableString) @IsOptional() @IsDateString() establishedDate?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsEnum(ParkStatus) status?: ParkStatus;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @Matches(opaqueId, { each: true }) managerIds?: string[];
}

export class UpdateParkDto {
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 40) code?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 160) name?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 80) province?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 80) city?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 240) address?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(6, 20) phoneNumber?: string;
  @Transform(trimNullableString) @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @Transform(trimString) @IsOptional() @IsString() @Length(6, 20) guardPhone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(2_147_483_647) totalArea?: number;
  @Transform(trimNullableString) @IsOptional() @IsDateString() establishedDate?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsEnum(ParkStatus) status?: ParkStatus;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @Matches(opaqueId, { each: true }) managerIds?: string[];
}

export class CreateManagedUserDto {
  @Transform(normalizeIranianPhone) @Matches(iranianPhone) phoneNumber!: string;
  @Transform(trimString) @IsString() @Length(2, 120) name!: string;
  // Passwords are intentionally not transformed: leading/trailing whitespace is credential data.
  @IsString() @Matches(strongPassword, { message: 'password must be 10-128 characters and contain letters and numbers' }) password!: string;
  @Transform(lowercaseNullableString) @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @Transform(lowercaseNullableString) @IsOptional() @Matches(usernamePattern) username?: string | null;
  @Transform(trimNullableString) @IsOptional() @Matches(/^\d{10}$/) nationalId?: string | null;
  @IsEnum(Role) role!: Role;
  @IsOptional() @IsBoolean() isApproved?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @Matches(opaqueId, { each: true }) managedParkIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @Matches(opaqueId, { each: true }) managedFactoryIds?: string[];
  @Transform(trimNullableString) @IsOptional() @Matches(opaqueId) employeeOfFactoryId?: string | null;
}

export class UpdateManagedUserDto {
  @Transform(normalizeIranianPhone) @IsOptional() @Matches(iranianPhone) phoneNumber?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 120) name?: string;
  @Transform(lowercaseNullableString) @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @Transform(lowercaseNullableString) @IsOptional() @Matches(usernamePattern) username?: string | null;
  @Transform(trimNullableString) @IsOptional() @Matches(/^\d{10}$/) nationalId?: string | null;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() isApproved?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @Matches(opaqueId, { each: true }) managedParkIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ArrayUnique() @Matches(opaqueId, { each: true }) managedFactoryIds?: string[];
  @Transform(trimNullableString) @IsOptional() @Matches(opaqueId) employeeOfFactoryId?: string | null;
}

export class ResetPasswordAdminDto {
  // Do not trim passwords; the exact submitted value is hashed.
  @IsString() @Matches(strongPassword, { message: 'newPassword must be 10-128 characters and contain letters and numbers' }) newPassword!: string;
}

export class FactoryAdminQueryDto {
  @IsOptional() @IsEnum(FactoryStatus) status?: FactoryStatus;
  @Transform(trimString) @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() @Matches(opaqueId) parkId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class CreateFactoryDto {
  @Transform(trimString) @IsString() @Length(2, 160) name!: string;
  @Transform(trimString) @IsString() @Length(2, 80) licenseNumber!: string;
  @Transform(trimString) @IsString() @Matches(/^\d{10,11}$/) nationalId!: string;
  @Transform(trimString) @IsString() @Length(2, 120) activityType!: string;
  @Transform(trimString) @IsString() @Length(2, 240) address!: string;
  @Transform(trimString) @IsString() @Length(6, 20) @Matches(/^[+0-9 ()-]+$/) phoneNumber!: string;
  @Transform(trimNullableString) @IsOptional() @IsString() @Length(6, 20) @Matches(/^[+0-9 ()-]+$/) phoneNumber2?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @Length(6, 20) @Matches(/^[+0-9 ()-]+$/) landline?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @Length(6, 20) @Matches(/^[+0-9 ()-]+$/) fax?: string | null;
  @Transform(lowercaseNullableString) @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(300) website?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsDateString() licenseExpiry?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsDateString() establishedDate?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) employees?: number;
  @IsString() @Matches(opaqueId) parkId!: string;
  @IsString() @Matches(opaqueId) managerId!: string;
}

export class UpdateFactoryDto {
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 160) name?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 80) licenseNumber?: string;
  @Transform(trimString) @IsOptional() @IsString() @Matches(/^\d{10,11}$/) nationalId?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 120) activityType?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 240) address?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(6, 20) @Matches(/^[+0-9 ()-]+$/) phoneNumber?: string;
  @Transform(trimNullableString) @IsOptional() @IsString() @Length(6, 20) @Matches(/^[+0-9 ()-]+$/) phoneNumber2?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @Length(6, 20) @Matches(/^[+0-9 ()-]+$/) landline?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @Length(6, 20) @Matches(/^[+0-9 ()-]+$/) fax?: string | null;
  @Transform(lowercaseNullableString) @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(300) website?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsDateString() licenseExpiry?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsDateString() establishedDate?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) employees?: number;
}

export class CreateGatePassDto {
  @IsString() @Matches(opaqueId) factoryId!: string;
  @IsEnum(CargoType) cargoType!: CargoType;
  @IsOptional() @IsString() @MaxLength(2000) cargoDescription?: string;
  @IsString() @Length(2, 120) driverName!: string;
  @IsString() @Matches(/^\d{10}$/) driverNationalId!: string;
  @Matches(iranianPhone) driverPhone!: string;
  @IsEnum(VehicleType) vehicleType!: VehicleType;
  @IsString() @Length(4, 20) licensePlate!: string;
  @IsOptional() @IsString() @MaxLength(1000) licensePlatePhoto?: string;
  @IsDateString() exitDate!: string;
}

export class CreateInvoiceDto {
  @IsString() @Matches(opaqueId) factoryId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9_999_999_999_999.99) amount!: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999_999.99) taxAmount?: number;
  @IsString() @Length(2, 2000) description!: string;
  @IsDateString() dueDate!: string;
}

export class CreateRequestDto {
  @IsString() @Matches(opaqueId) factoryId!: string;
  @IsEnum(RequestType) type!: RequestType;
  @IsString() @Length(2, 200) title!: string;
  @IsString() @Length(2, 8000) description!: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(500, { each: true }) attachments?: string[];
  @IsOptional() @IsEnum(RequestPriority) priority?: RequestPriority;
}

export class ReasonDto {
  @IsString() @Length(1, 2000) @Matches(/\S/, { message: 'reason must not be blank' }) reason!: string;
}

export class CreateAnnouncementDto {
  @IsString() @Length(2, 200) title!: string;
  @IsString() @Length(2, 8000) content!: string;
  @IsOptional() @IsBoolean() isGlobal?: boolean;
  @IsOptional() @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsString() @Matches(opaqueId) parkId?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class AdvertisementContactInfoDto {
  @ValidateIf((value: AdvertisementContactInfoDto) => value.phone !== undefined || value.phoneNumber === undefined)
  @IsString() @Length(6, 20) @Matches(/^[+0-9 ()-]+$/) phone?: string;
  @ValidateIf((value: AdvertisementContactInfoDto) => value.phoneNumber !== undefined)
  @IsString() @Length(6, 20) @Matches(/^[+0-9 ()-]+$/) phoneNumber?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
}

export class CreateAdvertisementDto {
  @IsString() @Length(2, 200) title!: string;
  @IsString() @Length(2, 80) category!: string;
  @IsString() @Length(2, 80) province!: string;
  @IsString() @Length(2, 80) city!: string;
  @IsOptional() @IsString() @Length(2, 240) address?: string;
  @IsString() @Length(2, 8000) content!: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999_999.99) price?: number;
  @IsObject() @ValidateNested() @Type(() => AdvertisementContactInfoDto) contactInfo!: AdvertisementContactInfoDto;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(1000, { each: true }) images?: string[];
  @IsOptional() @IsString() @Matches(opaqueId) parkId?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class AdvertisementAdminQueryDto {
  @IsOptional() @IsIn(['PENDING', 'HISTORY']) view?: 'PENDING' | 'HISTORY';
  @IsOptional() @IsEnum(AdvertisementStatus) status?: AdvertisementStatus;
  @Transform(trimString) @IsOptional() @IsString() @MaxLength(200) search?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(1, 80) category?: string;
  @IsOptional() @IsString() @Matches(opaqueId) parkId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class AdvertisementModerationDto {
  @IsBoolean() approved!: boolean;
  @Transform(trimString)
  @ValidateIf((value: AdvertisementModerationDto) => value.approved === false || value.rejectionReason !== undefined)
  @IsString() @Length(1, 2000) @Matches(/\S/, { message: 'rejectionReason must not be blank' }) rejectionReason?: string;
}

export class UpdateAnnouncementDto {
  @IsOptional() @IsString() @Length(2, 200) title?: string;
  @IsOptional() @IsString() @Length(2, 8000) content?: string;
  @IsOptional() @IsBoolean() isGlobal?: boolean;
  @IsOptional() @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class SendMessageDto {
  @IsArray() @ArrayMaxSize(500) @Matches(opaqueId, { each: true }) recipientIds!: string[];
  @IsString() @Length(2, 200) subject!: string;
  @IsString() @Length(2, 4000) body!: string;
}

export class ReportQueryDto {
  @IsIn(['financial', 'gatepass', 'requests']) type!: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class EmergencyLocationDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
}

export class CreateEmergencyDto {
  @IsString() @Length(2, 200) title!: string;
  @IsString() @Length(2, 8000) description!: string;
  @IsOptional() @IsEnum(EmergencySeverity) severity?: EmergencySeverity;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => EmergencyLocationDto) location?: EmergencyLocationDto;
}

export class PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
