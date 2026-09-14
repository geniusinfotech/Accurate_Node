import {
  IsString,
  IsEnum,
  IsOptional,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

class RateConfigDto {
  @IsOptional()
  @IsNumber()
  perKg?: number;

  @IsOptional()
  @IsNumber()
  perPcs?: number;
}

export class CreateWorkerDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  // No longer a fixed category — see Worker schema.
  @IsString()
  @IsOptional()
  type?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RateConfigDto)
  rateConfig?: RateConfigDto;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
