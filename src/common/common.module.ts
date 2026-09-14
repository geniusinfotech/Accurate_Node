import { Module } from '@nestjs/common';
import { ImageUtils } from './utils/image.utils';

@Module({
  providers: [ImageUtils],
  exports: [ImageUtils],
})
export class CommonModule {}
