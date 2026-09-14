import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCashBankAccountDto } from './create-cash-bank-account.dto';

export class UpdateCashBankAccountDto extends PartialType(
  CreateCashBankAccountDto,
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
