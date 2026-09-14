/* eslint-disable prettier/prettier */
import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateBannerDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsString()
  ctaText?: string;

  @IsOptional()
  @IsEnum(['image', 'video'])
  desktopMediaType?: 'image' | 'video';

  @IsOptional()
  @IsEnum(['image', 'video'])
  mobileMediaType?: 'image' | 'video';

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') return value === 'true';
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') return parseInt(value, 10);
    return value;
  })
  @IsNumber()
  displayOrder?: number;
}
