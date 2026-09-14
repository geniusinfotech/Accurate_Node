import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsMongoId,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MaterialInfoDto {
  @IsString()
  @IsOptional()
  baseMetal?: string;

  @IsString()
  @IsOptional()
  plating?: string;

  @IsString()
  @IsOptional()
  stoneType?: string;
}

class DimensionsDto {
  @IsString()
  @IsOptional()
  necklaceLength?: string;

  @IsString()
  @IsOptional()
  earringDrop?: string;

  @IsString()
  @IsOptional()
  bangleDiameter?: string;

  @IsString()
  @IsOptional()
  weight?: string;
}

class VariantDto {
  @IsString()
  variantId: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  size?: string;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsArray()
  @IsOptional()
  images?: string[];
}

export class CreateShopProductDto {
  @IsOptional()
  @IsMongoId()
  shopBrandId?: string;

  @IsMongoId()
  shopCategoryId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  purchaseRate?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  mrp?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountPercent?: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => MaterialInfoDto)
  material?: MaterialInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DimensionsDto)
  dimensions?: DimensionsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[];

  @IsArray()
  @IsOptional()
  images?: string[];

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  warranty?: string;

  @IsString()
  @IsOptional()
  careInstructions?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  occasion?: string[];

  @IsBoolean()
  @IsOptional()
  isHypoallergenic?: boolean;

  @IsString()
  @IsOptional()
  closureType?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  reservedStock?: number;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  isFeatured?: boolean;

  @IsOptional()
  isNewArrival?: boolean;

  @IsOptional()
  isBestseller?: boolean;

  @IsOptional()
  isCombo?: boolean;

  @IsOptional()
  isPremium?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'published'])
  status?: string;

  @IsOptional()
  @IsMongoId()
  sourceStockId?: string;

  @IsOptional()
  @IsString()
  lotId?: string;
}
