import { Schema, model } from "mongoose";

const WebhookEventSchema = new Schema({
  eventKey: { type: String, required: true, unique: true },
  receivedAt: { type: Date, default: Date.now, required: true, expires: 60 * 60 * 24 * 30 },
  status: { type: String, enum: ["received", "processed", "failed"], required: true },
  error: { type: String },
});

export const WebhookEvent = model("WebhookEvent", WebhookEventSchema);
