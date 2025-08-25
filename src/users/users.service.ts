import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  private readonly rounds: number;

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cfg: ConfigService,
  ) {
    this.rounds = Number(this.cfg.get('BCRYPT_SALT_ROUNDS') ?? 10);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email }).lean<User | null>();
  }

  async createLocalUser(email: string, password: string, name?: string) {
    const existing = await this.findByEmail(email);
    if (existing) throw new BadRequestException('Email already registered');

    const passwordHash = await bcrypt.hash(password, this.rounds);

    const doc = await this.userModel.create({
      provider: 'local',
      email,
      name,
      passwordHash,
    });

    return doc.toObject();
  }

  async validateLocalUser(email: string, password: string) {
    const user = await this.userModel.findOne({ email }).lean<User | null>();
    if (!user || user.provider !== 'local' || !user.passwordHash) return null;

    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }
}
