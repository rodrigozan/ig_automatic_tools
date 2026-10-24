import { Schema, model } from "mongoose";

const InviteSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Invite = model("Invite", InviteSchema);
