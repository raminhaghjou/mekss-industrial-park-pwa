import { IsString, IsEmail, IsOptional, IsEnum, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({
    description: 'Phone number (Iranian format)',
    example: '09123456789',
  })
  @IsString()
  @Matches(/^09\d{9}$/, {
    message: 'Phone number must be in Iranian format (09XXXXXXXXX)',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Password (minimum 8 characters)',
    example: 'StrongPass123!',
  })
  @IsString()
  @Length(8, 100, {
    message: 'Password must be at least 8 characters long',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one lowercase letter, one uppercase letter, and one digit',
  })
  password: string;

  @ApiProperty({
    description: 'Full name',
    example: 'علی احمدی',
  })
  @IsString()
  @Length(2, 100, {
    message: 'Name must be between 2 and 100 characters',
  })
  name: string;

  @ApiProperty({
    description: 'National ID (optional)',
    example: '1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(10, 10, {
    message: 'National ID must be 10 digits',
  })
  nationalId?: string;

  @ApiProperty({
    description: 'Email address (optional)',
    example: 'user@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, {
    message: 'Invalid email format',
  })
  email?: string;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: 'FACTORY_MANAGER',
  })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({
    description: 'Factory ID (required for factory managers)',
    example: 'clj1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  factoryId?: string;

  @ApiProperty({
    description: 'Park ID (required for park managers)',
    example: 'clj1234567890',
    required: false,
  })
  @IsOptional()
  @IsString()
  parkId?: string;
}