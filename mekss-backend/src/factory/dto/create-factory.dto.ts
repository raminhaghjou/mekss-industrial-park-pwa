import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class CreateFactoryDto {
  @ApiProperty({ example: 'کارخانه نمونه' })
  @IsString()
  @Length(2, 200)
  name: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  licenseNumber: string;

  @ApiProperty({ example: '10101234567' })
  @IsString()
  nationalId: string;

  @ApiProperty({ example: 'تولید قطعات فلزی' })
  @IsString()
  activityType: string;

  @ApiProperty({ example: 'تهران، شهرک صنعتی' })
  @IsString()
  address: string;

  @ApiProperty({ example: '02112345678' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'park-id' })
  @IsString()
  parkId: string;

  @ApiProperty({ required: false, description: 'Manager user id; defaults to current user' })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiProperty({ required: false, example: { lat: 35.7, lng: 51.4 } })
  @IsOptional()
  location?: { lat: number; lng: number };
}
