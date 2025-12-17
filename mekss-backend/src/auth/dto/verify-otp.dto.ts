import { IsString, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
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
    description: 'OTP code (6 digits)',
    example: '123456',
  })
  @IsString()
  @Length(6, 6, {
    message: 'OTP must be 6 digits',
  })
  @Matches(/^\d{6}$/, {
    message: 'OTP must contain only digits',
  })
  otp: string;
}