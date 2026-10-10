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
import { AdvertisementStatus, CargoType, EmergencySeverity, FactoryStatus, InvoiceItemType, MarketRateKey, ParkStatus, PlateType, RequestPriority, RequestType, Role, VehicleType } from '@prisma/client';
import { canonicalPlateOrRaw, IRAN_LICENSE_PLATE_PATTERN } from '../anpr/plate-grammar';

const iranianPhone = /^09\d{9}$/;
const opaqueId = /^[A-Za-z0-9_-]{1,128}$/;
const strongPassword = /^(?=.*[A-Za-z])(?=.*\d).{10,128}$/;
const usernamePattern = /^[a-z0-9._-]{3,64}$/;
const nationalIdPattern = /^\d{10}$/;
const iranLicensePlatePattern = IRAN_LICENSE_PLATE_PATTERN;
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
const toAsciiDigits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
const normalizeIranianPhone = ({ value }: TransformFnParams) => {
  if (typeof value !== 'string') return value;
  const digits = toAsciiDigits(value.trim()).replace(/\D/g, '');
  if (digits.startsWith('0098')) return `0${digits.slice(4)}`;
  if (digits.startsWith('98') && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith('9')) return `0${digits}`;
  return digits;
};
const normalizeNationalId = ({ value }: TransformFnParams) => {
  if (typeof value !== 'string') return value;
  return toAsciiDigits(value.trim()).replace(/\D/g, '');
};
const normalizeLicensePlate = ({ value }: TransformFnParams) => {
  if (typeof value !== 'string') return value;
  return canonicalPlateOrRaw(value);
};

export class OpaqueIdParamDto {
  @IsString() @Matches(opaqueId) id!: string;
}

export class OpaqueUserIdParamDto {
  @IsString() @Matches(opaqueId) id!: string;
  @IsString() @Matches(opaqueId) userId!: string;
}

export class MarketRateKeyParamDto {
  @IsEnum(MarketRateKey) key!: MarketRateKey;
}

export class QrCodeParamDto {
  @IsString() @Length(8, 128) @Matches(/^[A-Za-z0-9_-]+$/) code!: string;
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
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(120) ceoName?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(500) shopUrl?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(1000) logo?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsString() @Matches(opaqueId) parkId!: string;
  @IsString() @Matches(opaqueId) managerId!: string;
}

/** Factory self-registration by FACTORY_OWNER — managerId is the authenticated actor. */
export class RegisterFactoryDto {
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
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(120) ceoName?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(500) shopUrl?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(1000) logo?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsObject() socialMedia?: Record<string, string> | null;
  @IsString() @Matches(opaqueId) parkId!: string;
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
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(120) ceoName?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsUrl({ require_protocol: true }) @MaxLength(500) shopUrl?: string | null;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(1000) logo?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsObject() socialMedia?: Record<string, string> | null;
}

export class CreateFactoryStaffDto {
  @Transform(normalizeIranianPhone) @Matches(iranianPhone) phoneNumber!: string;
  @Transform(trimString) @IsString() @Length(2, 120) name!: string;
  @IsString() @Matches(strongPassword, { message: 'password must be 10-128 characters and contain letters and numbers' }) password!: string;
  @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsEnum(RequestType, { each: true }) canApproveRequestTypes!: RequestType[];
}

export class UpdateFactoryStaffDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsEnum(RequestType, { each: true }) canApproveRequestTypes?: RequestType[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateParkStaffDto {
  @Transform(normalizeIranianPhone) @Matches(iranianPhone) phoneNumber!: string;
  @Transform(trimString) @IsString() @Length(2, 120) name!: string;
  @IsString() @Matches(strongPassword, { message: 'password must be 10-128 characters and contain letters and numbers' }) password!: string;
  @Transform(lowercaseNullableString) @IsOptional() @Matches(usernamePattern) username?: string | null;
  @Transform(trimNullableString) @IsOptional() @Matches(nationalIdPattern) nationalId?: string | null;
  @Transform(lowercaseNullableString) @IsOptional() @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @IsString() @Matches(opaqueId) parkId?: string;
}

export class UpdateParkStaffDto {
  @Transform(normalizeIranianPhone) @IsOptional() @Matches(iranianPhone) phoneNumber?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @Matches(strongPassword, { message: 'password must be 10-128 characters and contain letters and numbers' }) password?: string;
  @Transform(lowercaseNullableString) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(usernamePattern) username?: string | null;
  @Transform(trimNullableString) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(nationalIdPattern) nationalId?: string | null;
  @Transform(lowercaseNullableString) @IsOptional() @ValidateIf((_, v) => v !== null) @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class WalletTopUpDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9_999_999_999_999.99) amount!: number;
}

/** Online wallet top-up through the payment gateway: whole Rials, 10,000 to 2,000,000,000. */
export class StartWalletTopUpDto {
  @Type(() => Number) @IsInt() @Min(10_000) @Max(2_000_000_000) amount!: number;
}

export class UpdateMarketRateDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(9_999_999_999_999.9999) value!: number;
  @Transform(trimString) @IsOptional() @IsString() @Length(1, 80) label?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(1, 40) unit?: string;
}

export class SendDirectMessageDto {
  @IsString() @Matches(opaqueId) receiverId!: string;
  @IsString() @Length(2, 200) subject!: string;
  @IsString() @Length(2, 4000) body!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(500, { each: true }) attachments?: string[];
}

export class ListMessagesQueryDto {
  @Transform(trimString) @IsOptional() @IsString() @MaxLength(200) search?: string;
  @Transform(trimString) @IsOptional() @IsString() @MaxLength(200) subject?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
}

export class PublicSmsRequestDto {
  @Transform(normalizeIranianPhone) @Matches(iranianPhone) phoneNumber!: string;
  @Transform(trimString) @IsString() @Length(1, 8) code!: string;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(2000) text?: string | null;
}

/** Vehicle types accepted for new gate passes; TRUCK stays in the enum only for historical records. */
export const ACTIVE_VEHICLE_TYPES: readonly VehicleType[] = [
  VehicleType.KHAVAR,
  VehicleType.TAK,
  VehicleType.TEN_WHEELER,
  VehicleType.TRAILER,
  VehicleType.VAN,
  VehicleType.CAR,
  VehicleType.MOTORCYCLE,
  VehicleType.OTHER,
];
const vehicleTypeMessage = { message: 'نوع خودرو معتبر نیست' };

export class CreateGatePassDto {
  @IsString() @Matches(opaqueId) factoryId!: string;
  @IsEnum(CargoType) cargoType!: CargoType;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(2000) cargoDescription?: string | null;
  @Transform(trimString) @IsString() @Length(2, 120) driverName!: string;
  @Transform(normalizeNationalId) @Matches(nationalIdPattern, { message: 'کد ملی باید ۱۰ رقم باشد' }) driverNationalId!: string;
  @Transform(normalizeIranianPhone) @Matches(iranianPhone, { message: 'شماره موبایل باید به صورت 09XXXXXXXXX باشد' }) driverPhone!: string;
  @IsIn(ACTIVE_VEHICLE_TYPES, vehicleTypeMessage) vehicleType!: VehicleType;
  @Transform(normalizeLicensePlate) @Matches(iranLicensePlatePattern, { message: 'شماره پلاک معتبر نیست' }) licensePlate!: string;
  @IsOptional() @IsEnum(PlateType) plateType?: PlateType;
  @IsOptional() @IsString() @MaxLength(1000) licensePlatePhoto?: string;
  @IsDateString({}, { message: 'تاریخ خروج نامعتبر است' }) exitDate!: string;
  @IsOptional() @IsBoolean() saveAsDefaultDriver?: boolean;
}

export class UpdateGatePassDto {
  @IsOptional() @IsEnum(CargoType) cargoType?: CargoType;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(2000) cargoDescription?: string | null;
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 120) driverName?: string;
  @Transform(normalizeNationalId) @IsOptional() @Matches(nationalIdPattern, { message: 'کد ملی باید ۱۰ رقم باشد' }) driverNationalId?: string;
  @Transform(normalizeIranianPhone) @IsOptional() @Matches(iranianPhone, { message: 'شماره موبایل باید به صورت 09XXXXXXXXX باشد' }) driverPhone?: string;
  @IsOptional() @IsIn(ACTIVE_VEHICLE_TYPES, vehicleTypeMessage) vehicleType?: VehicleType;
  @Transform(normalizeLicensePlate) @IsOptional() @Matches(iranLicensePlatePattern, { message: 'شماره پلاک معتبر نیست' }) licensePlate?: string;
  @IsOptional() @IsEnum(PlateType) plateType?: PlateType;
  @IsOptional() @IsString() @MaxLength(1000) licensePlatePhoto?: string;
  @IsOptional() @IsDateString({}, { message: 'تاریخ خروج نامعتبر است' }) exitDate?: string;
}

export class InvoiceItemDto {
  @IsEnum(InvoiceItemType) type!: InvoiceItemType;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(200) title?: string | null;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9_999_999_999_999.99) amount!: number;
}

const hasItems = (o: { items?: unknown[] }) => Array.isArray(o.items) && o.items.length > 0;

export class CreateInvoiceDto {
  /** Bill an industrial unit (default). Required unless targetType=PARK. */
  @ValidateIf((o: CreateInvoiceDto) => (o.targetType || 'FACTORY') === 'FACTORY')
  @IsString() @Matches(opaqueId) factoryId?: string;
  /** Bill a whole park (super-admin only). Required when targetType=PARK. */
  @ValidateIf((o: CreateInvoiceDto) => o.targetType === 'PARK')
  @IsString() @Matches(opaqueId) parkId?: string;
  @IsOptional() @IsIn(['FACTORY', 'PARK']) targetType?: 'FACTORY' | 'PARK';
  /** Line items; when present the base amount is their sum. */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto) items?: InvoiceItemDto[];
  @ValidateIf((o: CreateInvoiceDto) => !hasItems(o))
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9_999_999_999_999.99) amount?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999_999.99) taxAmount?: number;
  /** Daily late fee in Rials, accrued each calendar day after dueDate until payment. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999_999.99) latePenaltyPerDay?: number;
  @ValidateIf((o: CreateInvoiceDto) => !hasItems(o) || (o.description !== undefined && o.description !== null && o.description !== ''))
  @IsString() @Length(2, 2000) description?: string;
  @IsDateString() dueDate!: string;
}

export class ListInvoicesQueryDto {
  /** payable = debts I owe; managed = factory AR I collect (park manager / SA). */
  @IsOptional() @IsIn(['payable', 'managed']) scope?: 'payable' | 'managed';
  @IsOptional() @IsIn(['PENDING', 'OVERDUE', 'PAID', 'CANCELLED', 'AWAITING_CONFIRMATION', 'INSTALLMENTS']) status?: string;
  @IsOptional() @IsDateString() fromDate?: string;
  @IsOptional() @IsDateString() toDate?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxAmount?: number;
}

export class UpdateInvoiceDto {
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9_999_999_999_999.99) amount?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999_999.99) taxAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999_999.99) latePenaltyPerDay?: number;
  @IsOptional() @IsString() @Length(2, 2000) description?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsIn(['PENDING', 'OVERDUE', 'CANCELLED']) status?: 'PENDING' | 'OVERDUE' | 'CANCELLED';
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto) items?: InvoiceItemDto[];
}

const optionalNote = () => (target: object, propertyKey: string) => {
  Transform(trimNullableString)(target, propertyKey);
  IsOptional()(target, propertyKey);
  IsString()(target, propertyKey);
  MaxLength(1000)(target, propertyKey);
};

export class InvoiceDiscountDto {
  /** Total discount on the base amount (amount + tax); the late penalty is never discounted. */
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999_999.99) discountAmount!: number;
  @optionalNote() note?: string | null;
}

export class InstallmentPlanItemDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9_999_999_999_999.99) amount!: number;
  @IsDateString() dueDate!: string;
}

export class InvoiceInstallmentsDto {
  /** Equal split into `count` installments starting at firstDueDate, every intervalDays (default 30). */
  @ValidateIf((o: InvoiceInstallmentsDto) => !Array.isArray(o.installments) || !o.installments.length)
  @Type(() => Number) @IsInt() @Min(2) @Max(36) count?: number;
  @ValidateIf((o: InvoiceInstallmentsDto) => !Array.isArray(o.installments) || !o.installments.length)
  @IsDateString() firstDueDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(365) intervalDays?: number;
  /** Custom schedule; amounts must add up exactly to the net base amount. */
  @IsOptional() @IsArray() @ArrayMaxSize(36) @ValidateNested({ each: true }) @Type(() => InstallmentPlanItemDto) installments?: InstallmentPlanItemDto[];
  @optionalNote() note?: string | null;
}

export const MANUAL_SETTLEMENT_METHODS = ['CASH', 'CHECK', 'POS', 'TRANSFER'] as const;

export class InvoiceSettleDto {
  @IsIn(MANUAL_SETTLEMENT_METHODS) method!: (typeof MANUAL_SETTLEMENT_METHODS)[number];
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(120) reference?: string | null;
  @IsOptional() @IsDateString() paidAt?: string;
  @optionalNote() note?: string | null;
}

export class InvoiceExtendDueDto {
  @IsDateString() dueDate!: string;
  @optionalNote() note?: string | null;
}

export class InvoiceImportQueryDto {
  @IsOptional() @IsIn(['true', 'false', '1', '0']) dryRun?: string;
  @IsOptional() @IsIn(['FACTORY', 'PARK']) target?: 'FACTORY' | 'PARK';
}

export class InvoiceTemplateQueryDto {
  @IsOptional() @IsIn(['CHARGE', 'PLATFORM']) category?: 'CHARGE' | 'PLATFORM';
  @IsOptional() @IsIn(['FACTORY', 'PARK']) target?: 'FACTORY' | 'PARK';
}

export class ResolveEmergencyDto {
  @optionalNote() note?: string | null;
}

// Backslashes are rejected: browsers treat `/\host` like `//host` (off-site).
const bannerLink = /^(https:\/\/[^\s<>"'\\]+|\/(?![/\\])[^\s<>"'\\]*)$/;

export class CreateBannerDto {
  @Transform(trimString) @IsString() @Length(2, 120) title!: string;
  @IsString() @Matches(opaqueId) desktopImageId!: string;
  @IsString() @Matches(opaqueId) mobileImageId!: string;
  @Transform(trimNullableString) @IsOptional() @IsString() @MaxLength(500)
  @Matches(bannerLink, { message: 'لینک باید با https:// یا / شروع شود' }) linkUrl?: string | null;
  @IsOptional() @IsBoolean() openInNewTab?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000) sortOrder?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() startsAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() endsAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @Matches(opaqueId) parkId?: string | null;
}

export class UpdateBannerDto {
  // Non-nullable columns: `null` must fail validation (IsOptional would let it through).
  @Transform(trimString) @ValidateIf((_, v) => v !== undefined) @IsString() @Length(2, 120) title?: string;
  @ValidateIf((_, v) => v !== undefined) @IsString() @Matches(opaqueId) desktopImageId?: string;
  @ValidateIf((_, v) => v !== undefined) @IsString() @Matches(opaqueId) mobileImageId?: string;
  @Transform(trimNullableString) @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(500)
  @Matches(bannerLink, { message: 'لینک باید با https:// یا / شروع شود' }) linkUrl?: string | null;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() openInNewTab?: boolean;
  @ValidateIf((_, v) => v !== undefined) @IsBoolean() isActive?: boolean;
  @ValidateIf((_, v) => v !== undefined) @Type(() => Number) @IsInt() @Min(0) @Max(10_000) sortOrder?: number;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() startsAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() endsAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @Matches(opaqueId) parkId?: string | null;
}

export class CreateRequestDto {
  @IsString() @Matches(opaqueId) factoryId!: string;
  @IsEnum(RequestType) type!: RequestType;
  @IsString() @Length(2, 200) title!: string;
  @IsString() @Length(2, 8000) description!: string;
  @IsOptional() @IsObject() data?: Record<string, unknown>;
  @IsOptional() @IsBoolean() isToParkManager?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(500, { each: true }) attachments?: string[];
  @IsOptional() @IsEnum(RequestPriority) priority?: RequestPriority;
}

export class ReasonDto {
  @IsString() @Length(1, 2000) @Matches(/\S/, { message: 'reason must not be blank' }) reason!: string;
}

export class ApproveRegistrationDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ArrayUnique() @IsEnum(RequestType, { each: true }) canApproveRequestTypes?: RequestType[];
}

export class CreateAnnouncementDto {
  @IsString() @Length(2, 200) title!: string;
  @IsString() @Length(2, 8000) content!: string;
  @IsOptional() @IsBoolean() isGlobal?: boolean;
  @IsOptional() @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsString() @Matches(opaqueId) parkId?: string;
  /** When set, announcement is limited to one industrial unit (manager + employees). */
  @IsOptional() @IsString() @Matches(opaqueId) factoryId?: string;
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

export class UpdateAdvertisementDto {
  @IsString() @Length(2, 200) title!: string;
  @IsString() @Length(2, 80) category!: string;
  @IsString() @Length(2, 80) province!: string;
  @IsString() @Length(2, 80) city!: string;
  @IsOptional() @IsString() @Length(2, 240) address?: string;
  @IsString() @Length(2, 8000) content!: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(9_999_999_999_999.99) price?: number;
  @IsObject() @ValidateNested() @Type(() => AdvertisementContactInfoDto) contactInfo!: AdvertisementContactInfoDto;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(1000, { each: true }) images?: string[];
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
  /** After approval, promote to the featured slider (subject to monthly cap). */
  @IsOptional() @IsBoolean() promoteFeatured?: boolean;
}

export class PublicAdvertisementQueryDto {
  @Transform(trimString) @IsOptional() @IsString() @MaxLength(200) search?: string;
  @Transform(trimString) @IsOptional() @IsString() @Length(1, 80) category?: string;
  @IsOptional() @IsIn(['all', 'fresh']) view?: 'all' | 'fresh';
}

export class CreateAdvertisementCategoryDto {
  @Transform(trimString) @IsString() @Length(2, 40) @Matches(/^[A-Z0-9_]+$/) key!: string;
  @Transform(trimString) @IsString() @Length(2, 80) label!: string;
}

export class UpdateAdvertisementCategoryDto {
  @Transform(trimString) @IsOptional() @IsString() @Length(2, 80) label?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateAdvertisementFeaturedSettingDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) monthlyCap!: number;
}

export class CreateFeedbackDto {
  @Transform(trimString) @IsString() @Length(2, 200) subject!: string;
  @Transform(trimString) @IsString() @Length(2, 8000) body!: string;
  @IsOptional() @IsString() @Matches(opaqueId) recipientParkId?: string;
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

export class BroadcastFactoryManagersMessageDto {
  @IsString() @Length(2, 200) subject!: string;
  @IsString() @Length(2, 4000) body!: string;
}

/** Scoped broadcast audiences for role-aware messaging. */
export class BroadcastMessageDto {
  @IsString() @Length(2, 200) subject!: string;
  @IsString() @Length(2, 4000) body!: string;
  @IsIn(['SYSTEM_ALL', 'PARK_ALL', 'FACTORY_UNIT', 'FACTORY_EMPLOYEES'])
  audience!: 'SYSTEM_ALL' | 'PARK_ALL' | 'FACTORY_UNIT' | 'FACTORY_EMPLOYEES';
  @IsOptional() @IsString() @Matches(opaqueId) parkId?: string;
  @IsOptional() @IsString() @Matches(opaqueId) factoryId?: string;
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
  @IsOptional() @IsString() @Matches(opaqueId) parkId?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => EmergencyLocationDto) location?: EmergencyLocationDto;
}

export class UpdateGatePassWalletSettingDto {
  @IsBoolean() requireWalletBalance!: boolean;
}

export class PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
