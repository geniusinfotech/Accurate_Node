import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type ProductDocument = Product & Document;

// --- Sub-Schemas (Embedded) ---

@Schema({ _id: false })
export class Variant {
  @Prop({ required: true })
  variantId: string;

  @Prop()
  color?: string;

  @Prop()
  size?: string;

  @Prop({ required: true, default: 0, min: 0 })
  stock: number;

  @Prop({ type: [String], default: [] })
  images: string[];
}

export const VariantSchema = SchemaFactory.createForClass(Variant);

@Schema({ _id: false })
export class MaterialInfo {
  @Prop({ trim: true })
  baseMetal?: string; // e.g., Brass, Copper, Stainless Steel, Alloy

  @Prop({ trim: true })
  plating?: string; // e.g., 22K Gold Plated, Rhodium, Rose Gold, Antique Gold

  @Prop({ type: [String], default: [] })
  stoneType?: string[]; // e.g., ["Kundan", "Cubic Zirconia", "Pearls"]

  @Prop({ trim: true })
  finish?: string; // e.g., Glossy, Antique, Matte, Oxidised
}

export const MaterialInfoSchema = SchemaFactory.createForClass(MaterialInfo);

@Schema({ _id: false })
export class Dimensions {
  @Prop({ trim: true })
  necklaceLength?: string;

  @Prop({ trim: true })
  earringDrop?: string;

  @Prop({ trim: true })
  bangleDiameter?: string;

  @Prop({ trim: true })
  pendantSize?: string;

  @Prop({ type: Number, min: 0 })
  weightGrams?: number; // Numeric weight allows filtering by light/heavy items

  @Prop({ trim: true })
  weight?: string; // Legacy string weight representation
}

export const DimensionsSchema = SchemaFactory.createForClass(Dimensions);

// --- Main Product Schema ---

@Schema({ timestamps: true })
export class Product {
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

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    unique: true,
    sparse: true,
    index: true,
    lowercase: true,
    trim: true,
  })
  slug: string;

  @Prop({
    unique: true,
    required: true,
    index: true,
    uppercase: true,
    trim: true,
  })
  sku: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ min: 0 })
  mrp?: number;

  @Prop({ default: 0, min: 0, max: 100 })
  discountPercent?: number;

  @Prop({ default: 0, min: 0 })
  discount?: number;

  @Prop({ required: true, default: 0, min: -999999 })
  stock: number;

  @Prop({ default: 0, min: 0 })
  reservedStock: number;

  @Prop({ type: MaterialInfoSchema })
  material?: MaterialInfo;

  @Prop({ type: DimensionsSchema })
  dimensions?: Dimensions;

  @Prop({ type: [VariantSchema], default: [] })
  variants: Variant[];

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop()
  videoUrl?: string;

  @Prop({ trim: true })
  description?: string;

  // Imitation Jewelry Specific Field Additions
  @Prop({ trim: true })
  closureType?: string; // e.g., "Adjustable Drawstring (Dori)", "Lobster Claw", "Hook"

  @Prop({ type: Boolean, default: true })
  isHypoallergenic?: boolean;

  @Prop({ type: [String], default: [], index: true })
  occasion?: string[]; // e.g., ["Festive", "Wedding", "Party Wear", "Everyday"]

  @Prop({
    type: [String],
    default: [
      'Keep away from water, perfumes, and direct heat.',
      'Store in an airtight zip-lock pouch or soft box after use.',
      'Wipe gently with a clean dry cloth after wear.',
    ],
  })
  careInstructions?: string;

  @Prop({ default: 'No warranty' })
  warranty?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ min: 0, max: 5 })
  ratingAvg?: number;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({
    type: String,
    enum: ['pending', 'published', 'archived'],
    default: 'published',
    index: true,
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SemiFinishedStock' })
  sourceStockId?: MongooseSchema.Types.ObjectId;

  @Prop({ index: true, sparse: true })
  lotId?: string;

  // --- Preserved Badges & Flags ---
  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ default: false })
  isNewArrival: boolean;

  @Prop({ default: false })
  isBestseller: boolean;

  @Prop({ default: false })
  isCombo: boolean;

  @Prop({ default: false })
  isPremium: boolean;

  // Computed stock status
  @Prop({
    type: String,
    enum: ['in_stock', 'low_stock', 'out_of_stock'],
    default: 'in_stock',
  })
  stockStatus: string;

  // SEO
  @Prop({ trim: true })
  metaTitle?: string;

  @Prop({ trim: true })
  metaDescription?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Auto-calculate discount percentage before saving
ProductSchema.pre('save', function (next) {
  if (this.mrp && this.mrp > 0 && this.price > 0) {
    this.discountPercent = Math.round(
      ((this.mrp - this.price) / this.mrp) * 100,
    );
    this.discount = this.mrp - this.price;
  }
  next();
});

// Compound & Search Indexes
ProductSchema.index({ isFeatured: 1 });
ProductSchema.index({ isNewArrival: 1 });
ProductSchema.index({ isBestseller: 1 });
ProductSchema.index({ isPremium: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ tags: 1 });
ProductSchema.index({ 'material.baseMetal': 1 });
ProductSchema.index({ 'material.plating': 1 });

ProductSchema.index({
  name: 'text',
  description: 'text',
  tags: 'text',
  'material.baseMetal': 'text',
  'material.plating': 'text',
});
