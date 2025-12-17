import { IsString, IsNumber, IsOptional, IsDateString, Min, Max, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'Factory ID',
    example: 'clj1234567890',
  })
  @IsString()
  factoryId: string;

  @ApiProperty({
    description: 'Invoice amount (in Rials)',
    example: 1000000,
  })
  @IsNumber()
  @Min(1000, {
    message: 'Amount must be at least 1000 Rials',
  })
  @Max(1000000000, {
    message: 'Amount cannot exceed 1 billion Rials',
  })
  amount: number;

  @ApiProperty({
    description: 'Invoice description',
    example: 'هزینه خدمات ماهانه',
  })
  @IsString()
  @Length(1, 500, {
    message: 'Description must be between 1 and 500 characters',
  })
  description: string;

  @ApiProperty({
    description: 'Due date (ISO format)',
    example: '2024-02-15T23:59:59Z',
  })
  @IsDateString()
  dueDate: string;

  @ApiProperty({
    description: 'Additional notes',
    example: 'لطفاً تا تاریخ سررسید پرداخت فرمایید',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000, {
    message: 'Notes must not exceed 1000 characters',
  })
  notes?: string;
}