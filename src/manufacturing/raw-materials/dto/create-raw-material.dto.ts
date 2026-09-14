import {
  IsString,
  IsNumber,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsMongoId,
  Min,
} from 'class-validator';

export class CreateRawMaterialDto {
  @IsString()
  @IsNotEmpty()
  materialName: string;

  @IsString()
  @IsOptional()
  dealerName?: string;

  @IsMongoId()
  @IsOptional()
  dealerId?: string;

  @IsString()
  @IsOptional()
  lotId?: string;

  // 'kg' = bought loose by weight, 'roll' = bought as rolls. Either way
  // `quantity` stays the total weight in kg so stock maths is unchanged.
  @IsIn(['kg', 'roll'])
  @IsOptional()
  unit?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  rolls?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  kgPerRoll?: number;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  pricePerKg: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalAmount?: number;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  purchaseDate?: string;
}
