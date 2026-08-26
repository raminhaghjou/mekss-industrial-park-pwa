import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Min, MinLength } from 'class-validator';

const iranianPhone = /^09\d{9}$/;

export class CreateParkDto {
  @IsString() @Length(2, 40) code!: string;
  @IsString() @Length(2, 160) name!: string;
  @IsString() @Length(2, 80) province!: string;
  @IsString() @Length(2, 80) city!: string;
  @IsString() @Length(2, 240) address!: string;
  @IsString() @Length(6, 20) phoneNumber!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @Length(6, 20) guardPhone!: string;
  @IsOptional() @IsInt() @Min(0) totalArea?: number;
  @IsOptional() @IsDateString() establishedDate?: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) managerIds?: string[];
}

export class UpdateParkDto {
  @IsOptional() @IsString() @Length(2, 160) name?: string;
  @IsOptional() @IsString() @Length(2, 80) province?: string;
  @IsOptional() @IsString() @Length(2, 80) city?: string;
  @IsOptional() @IsString() @Length(2, 240) address?: string;
  @IsOptional() @IsString() @Length(6, 20) phoneNumber?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(6, 20) guardPhone?: string;
  @IsOptional() @IsInt() @Min(0) totalArea?: number;
  @IsOptional() @IsDateString() establishedDate?: string;
  @IsOptional() @IsString() @Length(0, 2000) description?: string;
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) status?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) managerIds?: string[];
}

export class CreateManagedUserDto {
  @Matches(iranianPhone) phoneNumber!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @MinLength(10) password!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsIn(['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'SECURITY_GUARD', 'GOVERNMENT_OFFICIAL', 'EMPLOYEE']) role!: string;
  @IsOptional() @IsBoolean() isApproved?: boolean;
}

export class UpdateManagedUserDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn(['SUPER_ADMIN', 'PARK_MANAGER', 'FACTORY_OWNER', 'SECURITY_GUARD', 'GOVERNMENT_OFFICIAL', 'EMPLOYEE']) role?: string;
  @IsOptional() @IsBoolean() isApproved?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MinLength(10) password?: string;
}

export class CreateAnnouncementDto {
  @IsString() @Length(2, 200) title!: string;
  @IsString() @Length(2, 8000) content!: string;
  @IsOptional() @IsBoolean() isGlobal?: boolean;
  @IsOptional() @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsString() parkId?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
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
  @IsArray() @ArrayMaxSize(500) @IsString({ each: true }) recipientIds!: string[];
  @IsString() @Length(2, 200) subject!: string;
  @IsString() @Length(2, 4000) body!: string;
}

export class ReportQueryDto {
  @IsIn(['financial', 'gatepass', 'requests']) type!: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class ResetPasswordAdminDto {
  @IsString() @MinLength(10) newPassword!: string;
}

export class PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) pageSize?: number;
  @IsOptional() @IsString() search?: string;
}
