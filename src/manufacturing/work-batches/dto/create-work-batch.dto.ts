import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateWorkBatchDto {
  @IsEnum(['raw->chain', 'chain->polish', 'polish->packing', 'polish->refine'])
  stage: string;

  @IsMongoId()
  workerId: string;

  @IsOptional()
  @IsMongoId()
  rawMaterialId?: string;

  @IsOptional()
  @IsMongoId()
  semiFinishedStockId?: string;

  @IsOptional()
  @IsMongoId()
  parentBatchId?: string;

  @IsOptional()
  @IsString()
  lotId?: string;

  @IsNumber()
  kgGivenOut: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pcsGivenOut?: number;

  @IsOptional()
  @IsNumber()
  returnedQuantity?: number;

  @IsOptional()
  @IsNumber()
  returnedPcs?: number;

  @IsOptional()
  @IsNumber()
  returnedWeight?: number;

  @IsOptional()
  @IsNumber()
  defectCount?: number;

  @IsOptional()
  @IsString()
  workType?: string;

  @IsOptional()
  @IsString()
  productGender?: string;

  @IsOptional()
  @IsString()
  finishProductName?: string;

  @IsOptional()
  @IsNumber()
  makingChargePerPcs?: number;

  @IsOptional()
  @IsNumber()
  totalMakingCharge?: number;

  @IsOptional()
  @IsNumber()
  lossPercent?: number;

  @IsOptional()
  @IsString()
  assignNotes?: string;

  @IsOptional()
  @IsString()
  returnNotes?: string;

  @IsOptional()
  @IsDateString()
  dateOut?: string;

  @IsOptional()
  @IsDateString()
  dateIn?: string;

  @IsOptional()
  @IsEnum(['out', 'returned', 'partial'])
  status?: string;
}
