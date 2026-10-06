/* eslint-disable prettier/prettier */
import { IsString, IsEmail, IsOptional, MinLength, IsNotEmpty, ValidateNested, Matches, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '../roles.enum';

export class AddressDto {
  @IsString()
  @IsNotEmpty()
  street: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  zip: string;

  @IsString()
  @IsNotEmpty()
  country: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  firstname?: string;

  @IsString()
  @MinLength(2)
  @IsOptional()
  lastname?: string;

  // Backwards-compat: storefront signup historically sent a single `name`.
  // Whitelisted here so `forbidNonWhitelisted` doesn't reject it; the
  // service splits it into firstname/lastname when those are absent.
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @Matches(/^\+?[0-9\s\-()]{10,20}$/, { message: 'phone must be a valid phone number' })
  @IsOptional()
  phone?: string;

  @ValidateNested()
  @Type(() => AddressDto)
  @IsOptional()
  address?: AddressDto;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsArray()
  @IsOptional()
  roles?: Role[];
}
