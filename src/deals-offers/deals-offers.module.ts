import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DealsOffersController } from './deals-offers.controller';
import { DealsOffersService } from './deals-offers.service';
import { DealOffer, DealOfferSchema } from './schemas/deal-offer.schema';
import { ImageUtils } from '../common/utils/image.utils';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DealOffer.name, schema: DealOfferSchema },
    ]),
  ],
  controllers: [DealsOffersController],
  providers: [DealsOffersService, ImageUtils],
  exports: [DealsOffersService],
})
export class DealsOffersModule {}
