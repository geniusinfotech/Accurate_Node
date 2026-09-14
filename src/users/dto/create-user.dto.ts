/* eslint-disable prettier/prettier */
import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsArray,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Role } from '../../auth/roles.enum';


export class CreateUserDto {
  @IsOptional()
  username?: string;

  @IsNotEmpty()
  firstname: string;

  @IsNotEmpty()
  lastname: string;

  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsOptional()
  phone?: string;

  @IsObject()
  @IsOptional()
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  @IsArray()
  @IsOptional()
  roles?: Role[];
}
