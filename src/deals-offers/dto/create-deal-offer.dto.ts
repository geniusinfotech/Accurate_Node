import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateDealOfferDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  discountPercentage: number;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsNotEmpty()
  @IsDateString()
  validFrom: string;

  @IsNotEmpty()
  @IsDateString()
  validUntil: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map((s) => s.trim());
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  targetProducts?: string[];

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value.split(',').map((s) => s.trim());
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  targetCategories?: string[];
}
