import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const DmMessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "DmConversation", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    direction: { type: String, enum: ["out", "in"], required: true },
    text: { type: String },
    textExpiresAt: { type: Date, required: true, index: true },
    stepId: { type: String },
    buttonPayload: { type: String },
    igMessageId: { type: String },
    status: { type: String, enum: ["sent", "failed", "received", "queued"], required: true },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type DmMessageDoc = HydratedDocument<InferSchemaType<typeof DmMessageSchema>>;
export const DmMessage = model("DmMessage", DmMessageSchema);
