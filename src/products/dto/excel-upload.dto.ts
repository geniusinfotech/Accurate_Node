import { IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class ExcelUploadDto {
  @IsOptional()
  @IsMongoId()
  brandId?: string;

  @IsMongoId()
  @IsNotEmpty()
  categoryId: string;
}
