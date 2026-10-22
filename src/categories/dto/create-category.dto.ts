/* eslint-disable prettier/prettier */

import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCategoryDto {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsNotEmpty()
    @IsString()
    slug: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true || value === 1 || value === '1')
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true || value === 1 || value === '1')
    @IsBoolean()
    showOnHomepage?: boolean;

    @IsOptional()
    @IsString()
    image?: string;

    @IsOptional()
    @IsString()
    homepageCoverImage?: string;
}

