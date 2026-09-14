import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkBatchDto } from './create-work-batch.dto';

export class UpdateWorkBatchDto extends PartialType(CreateWorkBatchDto) {}
