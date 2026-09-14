import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCashBankEntryDto {
  @IsEnum(['receipt', 'payment'])
  @IsNotEmpty()
  voucherType: 'receipt' | 'payment';

  @IsMongoId()
  @IsNotEmpty()
  accountId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  mode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsEnum(['dealer', 'customer', 'worker', 'other'])
  refType?: 'dealer' | 'customer' | 'worker' | 'other';

  @IsOptional()
  @IsString()
  refId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  refName?: string;
}
