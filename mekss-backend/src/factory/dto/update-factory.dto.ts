import { PartialType } from '@nestjs/swagger';
import { CreateFactoryDto } from './create-factory.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { FactoryStatus } from '@prisma/client';

export class UpdateFactoryDto extends PartialType(CreateFactoryDto) {
  @ApiPropertyOptional({ enum: FactoryStatus })
  @IsOptional()
  @IsEnum(FactoryStatus)
  status?: FactoryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;
}
