import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async validateGoogleProfile(profile: {
    provider: 'google';
    providerId: string;
    email?: string;
    name?: string;
    picture?: string;
  }) {
    if (!profile.email) {
      throw new Error('Google profile missing email');
    }

    // find or create by provider+providerId (or by email)
    let user = await this.userModel.findOne({ provider: 'google', providerId: profile.providerId });
    if (!user) {
      user = await this.userModel.findOne({ email: profile.email });
    }
    if (!user) {
      user = await this.userModel.create({
        provider: 'google',
        providerId: profile.providerId,
        email: profile.email,
        name: profile.name,
        picture: profile.picture,
      });
    } else {
      // keep user fresh
      const toUpdate: Partial<User> = {};
      if (profile.name && profile.name !== user.name) toUpdate.name = profile.name;
      if (profile.picture && profile.picture !== user.picture) toUpdate.picture = profile.picture;
      if (Object.keys(toUpdate).length) {
        await this.userModel.updateOne({ _id: user._id }, toUpdate);
      }
    }

    return user.toObject();
  }

  signToken(user: User) {
    const payload = { sub: (user as any)._id.toString(), email: user.email };
    return {
      access_token: this.jwt.sign(payload),
    };
  }

  /* --------- Local signup/login --------- */
  async signupLocal(email: string, password: string, name?: string) {
    const user = await this.users.createLocalUser(email, password, name);
    return this.signToken(user as any);
  }

  async loginLocal(email: string, password: string) {
    const user = await this.users.validateLocalUser(email, password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.signToken(user as any);
  }
}
