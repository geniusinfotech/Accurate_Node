import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting, SettingDocument } from './schemas/setting.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<SettingDocument>,
  ) {}

  async getSetting(key: string, defaultValue: any = null) {
    const setting = await this.settingModel.findOne({ key });
    return setting ? setting.value : defaultValue;
  }

  async setSetting(key: string, value: any) {
    return this.settingModel.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true },
    );
  }
}
