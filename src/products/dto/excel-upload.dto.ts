import { IsMongoId, IsNotEmpty } from 'class-validator';

export class ExcelUploadDto {
  @IsMongoId()
  @IsNotEmpty()
  brandId: string;

  @IsMongoId()
  @IsNotEmpty()
  categoryId: string;
}
