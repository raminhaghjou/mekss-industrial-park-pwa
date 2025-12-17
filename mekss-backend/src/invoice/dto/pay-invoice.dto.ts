import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PayInvoiceDto {
  @ApiProperty({
    description: 'Payment method',
    example: 'ONLINE',
    required: false,
  })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}