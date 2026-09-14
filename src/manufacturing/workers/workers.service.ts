import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { Worker, WorkerDocument } from './schemas/worker.schema';

@Injectable()
export class WorkersService {
  constructor(
    @InjectModel(Worker.name) private workerModel: Model<WorkerDocument>,
  ) {}

  async create(createWorkerDto: CreateWorkerDto): Promise<WorkerDocument> {
    const created = new this.workerModel(createWorkerDto);
    return created.save();
  }

  async findAll(): Promise<WorkerDocument[]> {
    return this.workerModel.find().exec();
  }

  async findOne(id: string): Promise<WorkerDocument> {
    const worker = await this.workerModel.findById(id).exec();
    if (!worker) {
      throw new NotFoundException(`Worker with ID ${id} not found`);
    }
    return worker;
  }

  async update(
    id: string,
    updateWorkerDto: UpdateWorkerDto,
  ): Promise<WorkerDocument> {
    const updated = await this.workerModel
      .findByIdAndUpdate(id, updateWorkerDto, { new: true })
      .exec();
    if (!updated) {
      throw new NotFoundException(`Worker with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const result = await this.workerModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Worker with ID ${id} not found`);
    }
    return { success: true, message: 'Worker deleted successfully' };
  }
}
