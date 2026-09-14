import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateTrackingDto {
  @IsOptional()
  @IsIn(['placed', 'processing', 'shipped', 'delivered', 'cancelled'])
  orderStatus?: 'placed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

  @IsOptional()
  @IsString()
  courierName?: string;

  @IsOptional()
  @IsString()
  trackingId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
