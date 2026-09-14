import {
  IsNumber,
  IsOptional,
  IsString,
  IsMongoId,
  Min,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class AddWorkBatchCompletionDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pcsReturned?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightReturned?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defectCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  makingChargePerPcs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalMakingCharge?: number;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsMongoId()
  addedToStockId?: string;

  @IsOptional()
  @IsBoolean()
  isFinal?: boolean;
}
