import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const WeekdayTimesSchema = new Schema(
  {
    weekday: { type: Number, min: 0, max: 6, required: true },
    times: { type: [String], required: true },
  },
  { _id: false }
);

const ProviderSchema = new Schema(
  {
    provider: { type: String, enum: ["google", "facebook"], required: true },
    providerId: { type: String, required: true },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    avatarUrl: { type: String },
    providers: { type: [ProviderSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    role: { type: String, enum: ["admin", "creator"], default: "creator", required: true },
    timezone: { type: String, default: "America/Sao_Paulo", required: true },
    defaultSchedule: { type: [WeekdayTimesSchema], default: [] },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

UserSchema.index({ "providers.provider": 1, "providers.providerId": 1 }, { unique: true });

export type UserAttrs = InferSchemaType<typeof UserSchema>;
export type UserDoc = HydratedDocument<UserAttrs>;
export const User = model("User", UserSchema);

export function publicUser(u: UserDoc) {
  return {
    id: u.id as string,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    role: u.role,
    timezone: u.timezone,
    defaultSchedule: u.defaultSchedule.map((d) => ({ weekday: d.weekday, times: d.times })),
    active: u.active,
    providers: u.providers.map((p) => p.provider),
    createdAt: u.createdAt,
  };
}
