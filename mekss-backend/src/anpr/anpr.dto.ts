import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const opaqueId = /^[A-Za-z0-9_-]{1,128}$/;
const sessionIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

export class RecognizeQueryDto {
  @IsOptional() @IsString() @Matches(sessionIdPattern) sessionId?: string;
  /** `photo`: decide from this single image instead of fusing a live stream. */
  @IsOptional() @IsIn(['live', 'photo']) mode?: 'live' | 'photo';
}

export class SessionParamDto {
  @IsString() @Matches(sessionIdPattern) sessionId!: string;
}

export class PlateAlternativeDto {
  @IsString() @MaxLength(32) plate!: string;
  @IsNumber() @Min(0) @Max(1) p!: number;
}

/** A plate recognised on the device (offline worker) or typed by the guard. */
export class MatchPlateDto {
  @IsString() @MaxLength(32) plate!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(1) confidence?: number;
  @IsOptional() @IsIn(['DEVICE', 'MANUAL']) engine?: 'DEVICE' | 'MANUAL';
  @IsOptional() @IsInt() @Min(1) @Max(1000) frames?: number;
  @IsOptional() @IsString() @Matches(sessionIdPattern) sessionId?: string;
  @IsOptional() @IsInt() @Min(0) @Max(60_000) latencyMs?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsNumber({}, { each: true }) @Min(0, { each: true }) @Max(1, { each: true })
  charConfidences?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => PlateAlternativeDto)
  alternatives?: PlateAlternativeDto[];
}

export class ConfirmPlateReadDto {
  @IsOptional() @IsString() @MaxLength(32) plate?: string;
  @IsOptional() @IsString() @Matches(opaqueId) gatePassId?: string;
}
