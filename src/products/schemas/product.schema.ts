import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ProductDocument = Product & Document;

// ======================================================
// PRODUCT VARIANT
// ======================================================

@Schema({ _id: false })
export class ProductVariant {
  @Prop({ trim: true })
  variantId: string;

  @Prop({ required: true, uppercase: true, trim: true })
  sku: string;

  @Prop({ trim: true })
  weight?: string;

  @Prop({ min: 0.01 })
  packSize?: number;

  @Prop({
    enum: ['ml', 'L', 'gm', 'kg'],
  })
  packUnit?: string;

  @Prop({ trim: true })
  fragrance?: string;

  @Prop({ trim: true })
  color?: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ min: 0 })
  mrp?: number;

  @Prop({ default: 0, min: 0 })
  stock: number;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const ProductVariantSchema =
  SchemaFactory.createForClass(ProductVariant);

// ======================================================
// PACKAGING
// ======================================================

@Schema({ _id: false })
export class Packaging {
  @Prop({ trim: true })
  type?: string;

  @Prop({ trim: true })
  material?: string;

  @Prop({ trim: true })
  closureType?: string;
}

export const PackagingSchema =
  SchemaFactory.createForClass(Packaging);

// ======================================================
// USAGE INFORMATION
// ======================================================

@Schema({ _id: false })
export class UsageInfo {
  @Prop({ trim: true })
  usageInstructions?: string;

  @Prop({ trim: true })
  dilutionInstructions?: string;

  @Prop({ trim: true })
  recommendedDosage?: string;

  @Prop({ type: [String], default: [] })
  suitableFor: string[];

  @Prop({ type: [String], default: [] })
  notSuitableFor: string[];
}

export const UsageInfoSchema =
  SchemaFactory.createForClass(UsageInfo);

// ======================================================
// SAFETY INFORMATION
// ======================================================

@Schema({ _id: false })
export class SafetyInfo {
  @Prop({ trim: true })
  safetyInstructions?: string;

  @Prop({ trim: true })
  firstAidInstructions?: string;

  @Prop({ default: true })
  keepAwayFromChildren: boolean;

  @Prop({ default: false })
  avoidEyeContact: boolean;

  @Prop({ default: true })
  doNotIngest: boolean;

  @Prop({ default: false })
  doNotMixWithOtherCleaners: boolean;
}

export const SafetyInfoSchema =
  SchemaFactory.createForClass(SafetyInfo);

// ======================================================
// MAIN PRODUCT
// ======================================================

@Schema({
  timestamps: true,
})
export class Product {
  // ====================================================
  // BASIC INFORMATION
  // ====================================================

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Brand',
    index: true,
  })
  brandId?: MongooseSchema.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  })
  categoryId: MongooseSchema.Types.ObjectId;

  @Prop({
    required: true,
    trim: true,
  })
  name: string;

  @Prop({
    unique: true,
    sparse: true,
    index: true,
    lowercase: true,
    trim: true,
  })
  slug?: string;

  @Prop({
    required: true,
    unique: true,
    index: true,
    uppercase: true,
    trim: true,
  })
  sku: string;

  @Prop({
    trim: true,
  })
  shortDescription?: string;

  @Prop({
    trim: true,
  })
  description?: string;

  // ====================================================
  // LIQUID PRODUCT INFORMATION
  // ====================================================

  @Prop({
    required: true,
    enum: [
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
    ],
    index: true,
  })
  productType: string;

  @Prop({
    default: 'Liquid',
    trim: true,
  })
  productForm?: string;

  @Prop({
    default: false,
    index: true,
  })
  isConcentrated: boolean;

  @Prop({
    trim: true,
  })
  concentration?: string;

  @Prop({
    min: 0,
    max: 14,
  })
  phValue?: number;

  // ====================================================
  // FRAGRANCE / APPEARANCE
  // ====================================================

  @Prop({
    trim: true,
    index: true,
  })
  fragrance?: string;

  @Prop({
    trim: true,
  })
  color?: string;

  @Prop({
    type: [String],
    default: [],
  })
  availableFragrances: string[];

  // ====================================================
  // INGREDIENTS
  // ====================================================

  @Prop({
    type: [String],
    default: [],
  })
  ingredients: string[];

  @Prop({
    trim: true,
  })
  ingredientDescription?: string;

  // ====================================================
  // BENEFITS
  // ====================================================

  @Prop({
    type: [String],
    default: [],
  })
  benefits: string[];

  @Prop({
    type: [String],
    default: [],
  })
  features: string[];

  // ====================================================
  // USAGE
  // ====================================================

  @Prop({
    type: UsageInfoSchema,
  })
  usage?: UsageInfo;

  // ====================================================
  // SAFETY
  // ====================================================

  @Prop({
    type: SafetyInfoSchema,
  })
  safety?: SafetyInfo;

  // ====================================================
  // PACKAGING
  // ====================================================

  @Prop({
    type: PackagingSchema,
  })
  packaging?: Packaging;

  // ====================================================
  // PRICING
  // ====================================================

  @Prop({
    required: true,
    min: 0,
  })
  price: number;

  @Prop({
    min: 0,
  })
  mrp?: number;

  @Prop({
    default: 0,
    min: 0,
    max: 100,
  })
  discountPercent?: number;

  @Prop({
    default: 0,
    min: 0,
  })
  discount?: number;

  // ====================================================
  // INVENTORY
  // ====================================================

  @Prop({
    required: true,
    default: 0,
    min: 0,
  })
  stock: number;

  @Prop({
    default: 0,
    min: 0,
  })
  reservedStock: number;

  @Prop({
    type: [ProductVariantSchema],
    default: [],
  })
  variants: ProductVariant[];

  // ====================================================
  // MEDIA
  // ====================================================

  @Prop({
    type: [String],
    default: [],
  })
  images: string[];

  @Prop({
    trim: true,
  })
  videoUrl?: string;

  // ====================================================
  // SEO
  // ====================================================

  @Prop({
    type: [String],
    default: [],
  })
  tags: string[];

  @Prop({
    type: [String],
    default: [],
  })
  keywords: string[];

  @Prop({
    trim: true,
  })
  metaTitle?: string;

  @Prop({
    trim: true,
  })
  metaDescription?: string;

  // ====================================================
  // PRODUCT INFORMATION
  // ====================================================

  @Prop({
    trim: true,
  })
  warranty?: string;

  @Prop({
    trim: true,
  })
  shelfLife?: string;

  @Prop({
    trim: true,
  })
  storageInstructions?: string;

  // ====================================================
  // CERTIFICATION / TAX
  // ====================================================

  @Prop({
    type: [String],
    default: [],
  })
  certifications: string[];

  @Prop({
    trim: true,
    index: true,
  })
  hsnCode?: string;

  @Prop({
    trim: true,
  })
  gstRate?: string;

  // ====================================================
  // BATCH INFORMATION
  // ====================================================

  @Prop({
    trim: true,
    index: true,
  })
  batchNumber?: string;

  @Prop()
  manufacturingDate?: Date;

  @Prop()
  expiryDate?: Date;

  // ====================================================
  // FLAGS
  // ====================================================

  @Prop({
    default: true,
    index: true,
  })
  isActive: boolean;

  @Prop({
    default: false,
    index: true,
  })
  isFeatured: boolean;

  @Prop({
    default: false,
    index: true,
  })
  isNewArrival: boolean;

  @Prop({
    default: false,
    index: true,
  })
  isBestseller: boolean;

  @Prop({
    default: false,
  })
  isPremium: boolean;

  // ====================================================
  // STATUS
  // ====================================================

  @Prop({
    type: String,
    enum: ['draft', 'pending', 'published', 'archived'],
    default: 'published',
    index: true,
  })
  status: string;

  @Prop({
    type: String,
    enum: ['in_stock', 'low_stock', 'out_of_stock'],
    default: 'in_stock',
  })
  stockStatus?: string;
}

export const ProductSchema =
  SchemaFactory.createForClass(Product);

// Lets read endpoints return the category name: .populate('category', 'name').
ProductSchema.virtual('category', {
  ref: 'Category',
  localField: 'categoryId',
  foreignField: '_id',
  justOne: true,
});
ProductSchema.set('toJSON', { virtuals: true });

// ======================================================
// AUTO CALCULATE DISCOUNT
// ======================================================

ProductSchema.pre('save', function (next) {
  if (this.mrp && this.mrp > 0 && this.price >= 0) {
    this.discountPercent = Math.round(
      ((this.mrp - this.price) / this.mrp) * 100,
    );

    this.discount = Math.max(
      this.mrp - this.price,
      0,
    );
  }

  next();
});

// ======================================================
// INDEXES
// ======================================================

ProductSchema.index({
  productType: 1,
  isActive: 1,
});

ProductSchema.index({
  categoryId: 1,
  isActive: 1,
});

ProductSchema.index({
  brandId: 1,
  isActive: 1,
});

ProductSchema.index({
  price: 1,
});

ProductSchema.index({
  tags: 1,
});

ProductSchema.index({
  name: 'text',
  shortDescription: 'text',
  description: 'text',
  tags: 'text',
  keywords: 'text',
  fragrance: 'text',
  ingredients: 'text',
});