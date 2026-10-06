import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsMongoId,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
  Max,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Product Variant
 *
 * Example:
 * 500ml Lemon
 * 1L Lemon
 * 5L Lemon
 */
export class ProductVariantDto {
  @IsString()
  @IsOptional()
  variantId?: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsString()
  @IsOptional()
  weight?: string;

  @IsNumber()
  @IsOptional()
  @Min(0.01)
  packSize?: number;

  @IsString()
  @IsOptional()
  @IsIn(['ml', 'L', 'gm', 'kg'])
  packUnit?: string;

  @IsString()
  @IsOptional()
  fragrance?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  mrp?: number;

  @IsNumber()
  @Min(0)
  stock: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Packaging Information
 */
export class PackagingDto {
  @IsString()
  @IsOptional()
  type?: string;
  // Bottle, Pouch, Can, Jar, Bucket, Pump Bottle, Flip Cap etc.

  @IsString()
  @IsOptional()
  material?: string;
  // HDPE, PET, Plastic etc.

  @IsString()
  @IsOptional()
  closureType?: string;
  // Pump, Flip Cap, Screw Cap, Trigger Spray etc.
}

/**
 * Usage Information
 */
export class UsageInfoDto {
  @IsString()
  @IsOptional()
  usageInstructions?: string;

  @IsString()
  @IsOptional()
  dilutionInstructions?: string;

  @IsString()
  @IsOptional()
  recommendedDosage?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  suitableFor?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  notSuitableFor?: string[];
}

/**
 * Product Safety Information
 */
export class SafetyInfoDto {
  @IsString()
  @IsOptional()
  safetyInstructions?: string;

  @IsString()
  @IsOptional()
  firstAidInstructions?: string;

  @IsBoolean()
  @IsOptional()
  keepAwayFromChildren?: boolean;

  @IsBoolean()
  @IsOptional()
  avoidEyeContact?: boolean;

  @IsBoolean()
  @IsOptional()
  doNotIngest?: boolean;

  @IsBoolean()
  @IsOptional()
  doNotMixWithOtherCleaners?: boolean;
}

/**
 * Main Product DTO
 */
export class CreateProductDto {
  // -----------------------------------------
  // BASIC INFORMATION
  // -----------------------------------------

  @IsOptional()
  @IsMongoId()
  brandId?: string;

  @IsMongoId()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsNotEmpty()
  sku: string;

  @IsString()
  @IsOptional()
  shortDescription?: string;

  @IsString()
  @IsOptional()
  description?: string;

  // -----------------------------------------
  // LIQUID PRODUCT INFORMATION
  // -----------------------------------------

  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const clean = value.toLowerCase().trim().replace(/[\s-]+/g, '_');
    const valid = [
      'liquid_detergent',
      'dishwash',
      'fabric_conditioner',
      'floor_cleaner',
      'phenyl',
      'handwash',
      'toilet_cleaner',
      'bathroom_cleaner',
      'multipurpose_cleaner',
      'glass_cleaner',
      'tile_cleaner',
      'fabric_whitener',
      'kitchen_cleaner',
      'car_cleaner',
      'other',
    ];
    if (valid.includes(clean)) return clean;
    if (clean.includes('detergent') || clean.includes('laundry'))
      return 'liquid_detergent';
    if (clean.includes('dish')) return 'dishwash';
    if (clean.includes('floor')) return 'floor_cleaner';
    if (clean.includes('toilet')) return 'toilet_cleaner';
    if (clean.includes('bath')) return 'bathroom_cleaner';
    if (clean.includes('hand')) return 'handwash';
    if (clean.includes('glass')) return 'glass_cleaner';
    if (clean.includes('tile')) return 'tile_cleaner';
    if (clean.includes('car')) return 'car_cleaner';
    if (clean.includes('phenyl') || clean.includes('phenyle')) return 'phenyl';
    if (clean.includes('condition')) return 'fabric_conditioner';
    if (clean.includes('whitener')) return 'fabric_whitener';
    if (clean.includes('multi')) return 'multipurpose_cleaner';
    if (clean.includes('kitchen')) return 'kitchen_cleaner';
    return clean || 'other';
  })
  @IsIn([
    'liquid_detergent',
    'dishwash',
    'fabric_conditioner',
    'floor_cleaner',
    'phenyl',
    'handwash',
    'toilet_cleaner',
    'bathroom_cleaner',
    'multipurpose_cleaner',
    'glass_cleaner',
    'tile_cleaner',
    'fabric_whitener',
    'kitchen_cleaner',
    'car_cleaner',
    'other',
  ])
  productType: string;

  @IsString()
  @IsOptional()
  productForm?: string;
  // Liquid, Gel, Concentrated Liquid, Foam etc.

  @IsBoolean()
  @IsOptional()
  isConcentrated?: boolean;

  @IsString()
  @IsOptional()
  concentration?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(14)
  phValue?: number;

  // -----------------------------------------
  // FRAGRANCE / APPEARANCE
  // -----------------------------------------

  @IsString()
  @IsOptional()
  fragrance?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  availableFragrances?: string[];

  // -----------------------------------------
  // INGREDIENTS
  // -----------------------------------------

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  ingredients?: string[];

  @IsString()
  @IsOptional()
  ingredientDescription?: string;

  // -----------------------------------------
  // PRODUCT BENEFITS
  // -----------------------------------------

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  benefits?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  features?: string[];

  // -----------------------------------------
  // USAGE
  // -----------------------------------------

  @IsOptional()
  @ValidateNested()
  @Type(() => UsageInfoDto)
  usage?: UsageInfoDto;

  // -----------------------------------------
  // SAFETY
  // -----------------------------------------

  @IsOptional()
  @ValidateNested()
  @Type(() => SafetyInfoDto)
  safety?: SafetyInfoDto;

  // -----------------------------------------
  // PACKAGING
  // -----------------------------------------

  @IsOptional()
  @ValidateNested()
  @Type(() => PackagingDto)
  packaging?: PackagingDto;

  // -----------------------------------------
  // MAIN PRODUCT PRICE
  // -----------------------------------------

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  mrp?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountPercent?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discount?: number;

  // -----------------------------------------
  // INVENTORY
  // -----------------------------------------

  @IsNumber()
  @Min(0)
  stock: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  reservedStock?: number;

  // -----------------------------------------
  // VARIANTS
  // -----------------------------------------

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  // -----------------------------------------
  // IMAGES / VIDEO
  // -----------------------------------------

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @IsString()
  @IsOptional()
  videoUrl?: string;

  // -----------------------------------------
  // SEO / TAGS
  // -----------------------------------------

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  keywords?: string[];

  @IsString()
  @IsOptional()
  metaTitle?: string;

  @IsString()
  @IsOptional()
  metaDescription?: string;

  // -----------------------------------------
  // PRODUCT ATTRIBUTES
  // -----------------------------------------

  @IsString()
  @IsOptional()
  warranty?: string;

  @IsString()
  @IsOptional()
  shelfLife?: string;

  @IsString()
  @IsOptional()
  storageInstructions?: string;

  // -----------------------------------------
  // CERTIFICATION / COMPLIANCE
  // -----------------------------------------

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  certifications?: string[];

  @IsString()
  @IsOptional()
  hsnCode?: string;

  @IsString()
  @IsOptional()
  gstRate?: string;

  // -----------------------------------------
  // BATCH INFORMATION
  // -----------------------------------------

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsOptional()
  manufacturingDate?: Date;

  @IsOptional()
  expiryDate?: Date;

  // -----------------------------------------
  // STATUS
  // -----------------------------------------

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @IsBoolean()
  @IsOptional()
  isNewArrival?: boolean;

  @IsBoolean()
  @IsOptional()
  isBestseller?: boolean;

  @IsBoolean()
  @IsOptional()
  isPremium?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'pending', 'published', 'archived'])
  status?: string;
}