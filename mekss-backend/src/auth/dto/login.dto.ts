import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
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
    description: 'Password',
    example: 'StrongPass123!',
  })
  @IsString()
  password: string;
}