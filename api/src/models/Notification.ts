import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["publish_failed", "token_expiring", "limit_near", "dm_failed"], required: true },
    message: { type: String, required: true },
    refId: { type: String },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type NotificationDoc = HydratedDocument<InferSchemaType<typeof NotificationSchema>>;
export const Notification = model("Notification", NotificationSchema);

export function publicNotification(n: NotificationDoc) {
  return { id: n.id as string, type: n.type, message: n.message, refId: n.refId, readAt: n.readAt, createdAt: n.createdAt };
}
