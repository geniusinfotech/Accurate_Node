import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BotQa, BotQaDocument } from './schemas/bot-qa.schema';
import { CreateBotQaDto, UpdateBotQaDto } from './dto/bot-qa.dto';

@Injectable()
export class BotService {
  constructor(
    @InjectModel(BotQa.name) private botQaModel: Model<BotQaDocument>,
  ) {}

  async getResponse(message: string): Promise<string> {
    const lowerMsg = message.toLowerCase();

    // 1. Try exact keyword matching
    const qas = await this.botQaModel.find({ isActive: true });

    for (const qa of qas) {
      if (
        qa.keywords &&
        qa.keywords.some((kw) => lowerMsg.includes(kw.toLowerCase()))
      ) {
        return qa.answer;
      }
    }

    // 2. Try text search or simple inclusion in question
    for (const qa of qas) {
      if (
        lowerMsg.includes(qa.question.toLowerCase()) ||
        qa.question.toLowerCase().includes(lowerMsg)
      ) {
        return qa.answer;
      }
    }

    // 3. Fallback to hardcoded defaults for common queries if not in DB
    if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
      return 'Hello! I am the Accurate Liquid assistant. How can I help you today? You can ask about store hours, return policy, or product compatibility.';
    }

    if (lowerMsg.includes('hours') || lowerMsg.includes('open')) {
      return 'We are open Monday to Saturday, 9 AM to 8 PM.';
    }

    return "I'm sorry, I didn't quite catch that. Can you try asking about our hours, returns, or product compatibility? Our admin team is working on training me with more answers!";
  }

  // Admin CRUD
  async createQa(createDto: CreateBotQaDto): Promise<BotQa> {
    const newQa = new this.botQaModel(createDto);
    return newQa.save();
  }

  async findAllQa(): Promise<BotQa[]> {
    return this.botQaModel.find().sort({ createdAt: -1 });
  }

  async findOneQa(id: string): Promise<BotQa> {
    const qa = await this.botQaModel.findById(id);
    if (!qa) throw new NotFoundException(`Q&A with ID ${id} not found`);
    return qa;
  }

  async updateQa(id: string, updateDto: UpdateBotQaDto): Promise<BotQa> {
    const updated = await this.botQaModel.findByIdAndUpdate(id, updateDto, {
      new: true,
    });
    if (!updated) throw new NotFoundException(`Q&A with ID ${id} not found`);
    return updated;
  }

  async removeQa(id: string): Promise<any> {
    const result = await this.botQaModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException(`Q&A with ID ${id} not found`);
    return { message: 'Deleted successfully' };
  }
}
