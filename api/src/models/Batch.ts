import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const BatchSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "InstagramAccount", required: true },
    name: { type: String },
    mode: { type: String, enum: ["daily", "selected_days"], required: true },
    days: { type: [Number] },
    times: { type: [String], required: true },
    startDate: { type: Date, required: true },
    status: { type: String, enum: ["draft", "scheduled", "completed", "cancelled"], required: true },
    totalItems: { type: Number, required: true },
  },
  { timestamps: true }
);

export type BatchDoc = HydratedDocument<InferSchemaType<typeof BatchSchema>>;
export const Batch = model("Batch", BatchSchema);
