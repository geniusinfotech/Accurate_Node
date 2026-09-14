import { IsMongoId, IsNotEmpty } from 'class-validator';

export class ExcelUploadDto {
  @IsMongoId()
  @IsNotEmpty()
  shopBrandId: string;

  @IsMongoId()
  @IsNotEmpty()
  shopCategoryId: string;
}
