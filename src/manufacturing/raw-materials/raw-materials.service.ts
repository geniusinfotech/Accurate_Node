import {
  Injectable,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';
import {
  RawMaterial,
  RawMaterialDocument,
} from './schemas/raw-material.schema';
import { DealersService } from '../../dealers/dealers.service';

@Injectable()
export class RawMaterialsService implements OnModuleInit {
  constructor(
    @InjectModel(RawMaterial.name)
    private rawMaterialModel: Model<RawMaterialDocument>,
    private readonly dealersService: DealersService,
  ) {}

  private getDiwaliYear(year: number, now: Date): number {
    const diwaliReference = new Date(year, 10, 1);
    return now < diwaliReference ? year - 1 : year;
  }

  async onModuleInit() {
    this.syncDealerLedgers().catch((err) =>
      console.error('Dealer ledger sync error:', err),
    );
  }

  async syncDealerLedgers() {
    const rawMaterials = await this.rawMaterialModel.find().exec();
    const dealers = await this.dealersService.findAllDealers();

    for (const rm of rawMaterials) {
      if (rm.totalAmount > 0) {
        let dealerId = rm.dealerId?.toString();

        if (!dealerId && rm.dealerName && rm.dealerName.trim()) {
          let dealer = dealers.find(
            (d) => d.name.toLowerCase() === rm.dealerName.trim().toLowerCase(),
          );
          if (!dealer) {
            dealer = await this.dealersService.createDealer({
              name: rm.dealerName.trim(),
            });
            dealers.push(dealer);
          }
          dealerId = dealer._id.toString();
          rm.dealerId = dealer._id;
          await rm.save();
        }

        if (dealerId) {
          const ledger = await this.dealersService.getLedger(dealerId);
          const exists = ledger.ledger?.some(
            (e: any) =>
              e.refPurchaseId?.toString() === rm._id.toString() ||
              e.refPurchaseId?._id?.toString() === rm._id.toString(),
          );
          if (!exists) {
            await this.dealersService.addLedgerEntry({
              dealerId,
              type: 'purchase',
              amount: rm.totalAmount,
              refPurchaseId: rm._id.toString(),
              notes: `Auto purchase entry for raw material: ${rm.materialName}`,
            });
          }
        }
      }
    }
  }

  async decrementQuantityAtomic(
    id: string,
    amount: number,
  ): Promise<RawMaterialDocument> {
    const updated = await this.rawMaterialModel.findOneAndUpdate(
      { _id: id, quantity: { $gte: amount } },
      { $inc: { quantity: -amount } },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException(
        'Insufficient raw material stock — it may have just been assigned elsewhere',
      );
    }
    return updated;
  }

  async incrementQuantity(
    id: string,
    amount: number,
  ): Promise<RawMaterialDocument | null> {
    return this.rawMaterialModel.findByIdAndUpdate(
      id,
      { $inc: { quantity: amount } },
      { new: true },
    );
  }

  // Rolls and kg-per-roll are two views of the same lot: whichever one the
  // entry screen collected, fill in the other so stock screens can show
  // "≈ N rolls left" from the remaining quantity.
  private normaliseRollFields(data: any) {
    if (data.unit !== 'roll') {
      if (data.unit === 'kg') {
        data.rolls = 0;
        data.kgPerRoll = 0;
      }
      return;
    }
    const qty = Number(data.quantity) || 0;
    const rolls = Number(data.rolls) || 0;
    const kgPerRoll = Number(data.kgPerRoll) || 0;
    if (rolls > 0 && kgPerRoll <= 0 && qty > 0) {
      data.kgPerRoll = qty / rolls;
    } else if (kgPerRoll > 0 && rolls <= 0 && qty > 0) {
      data.rolls = qty / kgPerRoll;
    }
  }

  async create(
    createRawMaterialDto: CreateRawMaterialDto,
  ): Promise<RawMaterialDocument> {
    const data: any = { ...createRawMaterialDto };
    this.normaliseRollFields(data);
    if (data.totalAmount == null) {
      data.totalAmount = data.quantity * data.pricePerKg;
    }
    if (!data.lotId) {
      const year = this.getDiwaliYear(new Date().getFullYear(), new Date());
      const count = await this.rawMaterialModel.countDocuments();
      data.lotId = `LOT-${year}-${String(count + 1).padStart(4, '0')}`;
    }

    // Auto-link dealerId if only dealerName was provided
    if (!data.dealerId && data.dealerName && data.dealerName.trim()) {
      const dealers = await this.dealersService.findAllDealers();
      const existingDealer = dealers.find(
        (d) => d.name.toLowerCase() === data.dealerName.trim().toLowerCase(),
      );
      if (existingDealer) {
        data.dealerId = existingDealer._id;
      } else {
        const newDealer = await this.dealersService.createDealer({
          name: data.dealerName.trim(),
        });
        data.dealerId = newDealer._id;
      }
    }

    const created = new this.rawMaterialModel(data);
    const saved = await created.save();

    if (saved.dealerId && saved.totalAmount > 0) {
      await this.dealersService.addLedgerEntry({
        dealerId: saved.dealerId.toString(),
        type: 'purchase',
        amount: saved.totalAmount,
        refPurchaseId: saved._id.toString(),
        notes: `Auto purchase entry for raw material: ${saved.materialName}`,
      });
    }

    return saved;
  }

  async findAll(): Promise<RawMaterialDocument[]> {
    return this.rawMaterialModel.find().populate('dealerId').exec();
  }

  async findOne(id: string): Promise<RawMaterialDocument> {
    const rawMaterial = await this.rawMaterialModel
      .findById(id)
      .populate('dealerId')
      .exec();
    if (!rawMaterial) {
      throw new NotFoundException(`Raw Material with ID ${id} not found`);
    }
    return rawMaterial;
  }

  async update(
    id: string,
    updateRawMaterialDto: UpdateRawMaterialDto,
  ): Promise<RawMaterialDocument> {
    const data = { ...updateRawMaterialDto };
    this.normaliseRollFields(data);
    if (
      data.totalAmount == null &&
      data.quantity != null &&
      data.pricePerKg != null
    ) {
      data.totalAmount = data.quantity * data.pricePerKg;
    }

    // Auto-link dealerId if dealerName is provided
    if (!data.dealerId && data.dealerName && data.dealerName.trim()) {
      const dealers = await this.dealersService.findAllDealers();
      const existingDealer = dealers.find(
        (d) => d.name.toLowerCase() === data.dealerName!.trim().toLowerCase(),
      );
      if (existingDealer) {
        data.dealerId = existingDealer._id as any;
      }
    }

    const updated = await this.rawMaterialModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Raw Material with ID ${id} not found`);
    }

    if (updated.dealerId && updated.totalAmount > 0) {
      const ledger = await this.dealersService.getLedger(
        updated.dealerId.toString(),
      );
      const exists = ledger.ledger?.some(
        (e: any) =>
          e.refPurchaseId?.toString() === updated._id.toString() ||
          e.refPurchaseId?._id?.toString() === updated._id.toString(),
      );
      if (!exists) {
        await this.dealersService.addLedgerEntry({
          dealerId: updated.dealerId.toString(),
          type: 'purchase',
          amount: updated.totalAmount,
          refPurchaseId: updated._id.toString(),
          notes: `Auto purchase entry for raw material: ${updated.materialName}`,
        });
      }
    }

    return updated;
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.rawMaterialModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Raw Material with ID ${id} not found`);
    }
    return { success: true, message: 'Raw material deleted successfully' };
  }
}
