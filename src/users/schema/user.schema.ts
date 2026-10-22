import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role } from '../../auth/roles.enum';

export type UserDocument = User &
  Document & {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
  };

export interface UserResponse {
  _id: string;
  firstname: string;
  lastname: string;
  username?: string;
  email: string;
  roles: Role[];
  phone?: string;
  avatar?: string;
  addresses?: Address[];
  lastLoginAt?: Date;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Schema()
export class Address {
  @Prop()
  label?: string;

  @Prop()
  line1?: string;

  @Prop()
  line2?: string;

  @Prop()
  street?: string;

  @Prop()
  city?: string;

  @Prop()
  state?: string;

  @Prop()
  pincode?: string;

  @Prop()
  zip?: string;

  @Prop()
  phone?: string;

  @Prop()
  country?: string;

  @Prop({ default: false })
  isDefault?: boolean;
}

export const AddressSchema = SchemaFactory.createForClass(Address);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: false })
  username: string;

  @Prop({ required: true })
  firstname: string;

  @Prop({ required: true })
  lastname: string;

  @Prop({ required: false })
  password: string;

  @Prop({ unique: true, sparse: true })
  email: string;

  @Prop({ type: [String], enum: Role, default: [Role.USER] })
  roles: Role[];

  @Prop()
  googleId?: string;

  @Prop()
  githubId?: string;

  @Prop()
  resetPasswordToken?: string;

  @Prop()
  resetPasswordExpires?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [AddressSchema], default: [] })
  addresses?: Address[];

  @Prop()
  phone?: string;

  @Prop()
  avatar?: string;

  @Prop()
  lastLoginAt?: Date;

  @Prop()
  lastActivityAt?: Date;

  @Prop()
  refreshTokenHash?: string;

  @Prop({ default: 0 })
  totalAmountSpent: number;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Secrets never leave the server in any API response, whichever endpoint returns the document.
UserSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    delete ret.password;
    delete ret.refreshTokenHash;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;
    return ret;
  },
});
