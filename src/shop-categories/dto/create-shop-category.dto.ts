/* eslint-disable prettier/prettier */

import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsArray } from 'class-validator';

export class CreateShopCategoryDto {
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
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsBoolean()
    showOnHomepage?: boolean;

    @IsOptional()
    @IsString()
    homepageCoverImage?: string;

}

