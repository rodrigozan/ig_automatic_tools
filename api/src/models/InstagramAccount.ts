import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const EncryptedSchema = new Schema(
  {
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
  },
  { _id: false }
);

const InstagramAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    igUserId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    accountType: { type: String, enum: ["CREATOR", "BUSINESS"], required: true },
    profilePictureUrl: { type: String },
    accessTokenEnc: { type: EncryptedSchema },
    tokenExpiresAt: { type: Date, required: true },
    status: { type: String, enum: ["connected", "expired", "revoked"], default: "connected", required: true },
    connectedAt: { type: Date, default: Date.now },
    publishLimit: { type: Number },
    disconnectedAt: { type: Date },
  },
  { timestamps: true }
);

export type InstagramAccountDoc = HydratedDocument<InferSchemaType<typeof InstagramAccountSchema>>;
export const InstagramAccount = model("InstagramAccount", InstagramAccountSchema);
