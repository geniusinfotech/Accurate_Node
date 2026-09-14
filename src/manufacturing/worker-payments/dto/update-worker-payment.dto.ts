import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkerPaymentDto } from './create-worker-payment.dto';

export class UpdateWorkerPaymentDto extends PartialType(
  CreateWorkerPaymentDto,
) {}
