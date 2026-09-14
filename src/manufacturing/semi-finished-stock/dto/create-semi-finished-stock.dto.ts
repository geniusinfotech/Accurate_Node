import {
  IsString,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsEnum,
} from 'class-validator';

export class CreateSemiFinishedStockDto {
  @IsString()
  stage: string;

  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsMongoId()
  rawMaterialId?: string;

  @IsOptional()
  @IsMongoId()
  batchId?: string;

  @IsOptional()
  @IsString()
  lotId?: string;

  @IsOptional()
  @IsEnum(['ready', 'processing', 'completed', 'published'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
