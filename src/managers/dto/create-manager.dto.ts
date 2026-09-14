/* eslint-disable prettier/prettier */
import {
    IsEmail,
    IsNotEmpty,
    MinLength,
    IsArray,
    IsOptional,
    IsObject,
    IsString,
    IsEnum,
} from 'class-validator';
import { Permission } from '../../auth/permissions.enum';

export class CreateManagerDto {
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

    @IsArray()
    @IsOptional()
    @IsEnum(Permission, { each: true })
    permissions?: Permission[];

    @IsArray()
    @IsOptional()
    dashboardWidgets?: string[];
}

