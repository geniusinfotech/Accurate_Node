import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContactStatus } from '../schemas/contact.schema';

export class UpdateContactStatusDto {
  @IsEnum(ContactStatus, { message: 'Invalid status value' })
  status: ContactStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
