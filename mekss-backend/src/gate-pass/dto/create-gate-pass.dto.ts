import { IsString, IsEnum, IsOptional, IsDateString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CargoType, VehicleType } from '@prisma/client';

export class CreateGatePassDto {
  @ApiProperty({
    description: 'Factory ID',
    example: 'clj1234567890',
  })
  @IsString()
  factoryId: string;

  @ApiProperty({
    description: 'Cargo type',
    enum: CargoType,
    example: CargoType.RAW_MATERIALS,
  })
  @IsEnum(CargoType)
  cargoType: CargoType;

  @ApiProperty({
    description: 'Cargo description',
    example: 'مواد اولیه برای تولید',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500, {
    message: 'Cargo description must not exceed 500 characters',
  })
  cargoDescription?: string;

  @ApiProperty({
    description: 'Driver full name',
    example: 'احمد محمدی',
  })
  @IsString()
  @Length(2, 100, {
    message: 'Driver name must be between 2 and 100 characters',
  })
  driverName: string;

  @ApiProperty({
    description: 'Driver national ID',
    example: '1234567890',
  })
  @IsString()
  @Length(10, 10, {
    message: 'National ID must be 10 digits',
  })
  @Matches(/^\d{10}$/, {
    message: 'National ID must contain only digits',
  })
  driverNationalId: string;

  @ApiProperty({
    description: 'Driver phone number',
    example: '09123456789',
  })
  @IsString()
  @Matches(/^09\d{9}$/, {
    message: 'Phone number must be in Iranian format (09XXXXXXXXX)',
  })
  driverPhone: string;

  @ApiProperty({
    description: 'Vehicle type',
    enum: VehicleType,
    example: VehicleType.TRUCK,
  })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({
    description: 'License plate number',
    example: '12ط345ایران',
  })
  @IsString()
  @Length(5, 15, {
    message: 'License plate must be between 5 and 15 characters',
  })
  licensePlate: string;

  @ApiProperty({
    description: 'Exit date and time (ISO format)',
    example: '2024-01-15T14:30:00Z',
  })
  @IsDateString()
  exitDate: string;

  @ApiProperty({
    description: 'Entry date and time (ISO format)',
    example: '2024-01-16T10:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @ApiProperty({
    description: 'Additional notes',
    example: 'راننده ملزم به رعایت مقررات ایمنی می‌باشد',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000, {
    message: 'Notes must not exceed 1000 characters',
  })
  notes?: string;
}