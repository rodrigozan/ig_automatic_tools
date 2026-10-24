import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const MediaSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["video", "image"], required: true },
    originalName: { type: String, required: true },
    storagePath: { type: String, required: true },
    publicToken: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    durationSec: { type: Number },
    width: { type: Number },
    height: { type: Number },
    conversionStatus: {
      type: String,
      enum: ["pending", "converting", "done", "not_needed", "failed"],
      default: "pending",
      required: true,
    },
    conversionError: { type: String },
    deletedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type MediaDoc = HydratedDocument<InferSchemaType<typeof MediaSchema>>;
export const Media = model("Media", MediaSchema);

export const READY_STATUSES = ["done", "not_needed"] as const;

export function publicMedia(m: MediaDoc) {
  return {
    id: m.id as string,
    kind: m.kind,
    originalName: m.originalName,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    durationSec: m.durationSec,
    width: m.width,
    height: m.height,
    conversionStatus: m.conversionStatus,
    conversionError: m.conversionError,
    deleted: Boolean(m.deletedAt),
    url: m.deletedAt ? null : `/ig/public/media/${m.publicToken}`,
    createdAt: m.createdAt,
  };
}
