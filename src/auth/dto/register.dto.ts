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
  @MinLength(3)
  firstname: string;

  @IsString()
  @MinLength(3)
  lastname: string;

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
