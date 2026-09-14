import { PartialType } from '@nestjs/mapped-types';
import { CreateSemiFinishedStockDto } from './create-semi-finished-stock.dto';

export class UpdateSemiFinishedStockDto extends PartialType(
  CreateSemiFinishedStockDto,
) {}
