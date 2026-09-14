/* eslint-disable prettier/prettier */
import {
    IsEmail,
    IsNotEmpty,
    MinLength,
    IsOptional,
    IsObject,
    IsString,
    IsArray,
    IsEnum,
} from 'class-validator';
import { Role } from '../../auth/roles.enum';

export class CreateAdminDto {
    @IsOptional()
    @IsString()
    username?: string;

    @IsNotEmpty()
    @IsString()
    firstname: string;

    @IsNotEmpty()
    @IsString()
    lastname: string;

    @IsNotEmpty()
    @IsString()
    @MinLength(6)
    password: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsOptional()
    @IsString()
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

    @IsObject()
    @IsOptional()
    settings?: Record<string, any>;

    @IsArray()
    @IsOptional()
    @IsEnum(Role, { each: true })
    roles?: Role[];
}
