import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  IsMongoId,
  Min,
} from 'class-validator';

export class CreateDealerLedgerDto {
  @IsMongoId()
  @IsOptional()
  dealerId?: string;

  @IsEnum(['purchase', 'payment'])
  @IsNotEmpty()
  type: 'purchase' | 'payment';

  @IsNumber()
  @Min(0)
  amount: number;

  @IsMongoId()
  @IsOptional()
  refPurchaseId?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  mode?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsMongoId()
  @IsOptional()
  accountId?: string;
}
