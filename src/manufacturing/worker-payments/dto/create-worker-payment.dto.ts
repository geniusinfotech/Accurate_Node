import {
  IsString,
  IsNumber,
  IsOptional,
  IsMongoId,
  IsDateString,
  IsEnum,
} from 'class-validator';

export class CreateWorkerPaymentDto {
  @IsMongoId()
  workerId: string;

  @IsOptional()
  @IsMongoId()
  workBatchId?: string;

  @IsOptional()
  @IsNumber()
  amountDue?: number;

  @IsOptional()
  @IsNumber()
  amountPaid?: number;

  @IsOptional()
  @IsNumber()
  advance?: number;

  @IsOptional()
  @IsNumber()
  deduction?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(['cash', 'bank', 'upi'])
  mode?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsMongoId()
  accountId?: string;
}
