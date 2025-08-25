import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true }) provider!: 'google' | 'local';

  // For OAuth users
  @Prop() providerId?: string; // e.g., Google "sub"

  // Common
  @Prop({ required: true, index: true, unique: true }) email!: string;
  @Prop() name?: string;
  @Prop() picture?: string;

  // For local users
  @Prop() passwordHash?: string; // bcrypt hash
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ provider: 1, providerId: 1 }, { unique: false });
