import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const ScheduledPostSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "InstagramAccount" },
    destination: { type: String, enum: ["instagram", "facebook", "both"], default: "instagram", required: true },
    facebookPageId: { type: String },
    fbPostId: { type: String },
    fbPermalink: { type: String },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    type: { type: String, enum: ["post", "reel", "carousel"], required: true },
    mediaIds: { type: [{ type: Schema.Types.ObjectId, ref: "Media" }], required: true },
    caption: { type: String, maxlength: 2200 },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "scheduled", "publishing", "published", "failed", "cancelled"],
      default: "scheduled",
      required: true,
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date },
    lastError: { type: String },
    igContainerId: { type: String },
    igMediaId: { type: String },
    permalink: { type: String },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

ScheduledPostSchema.index({ status: 1, scheduledAt: 1 });
ScheduledPostSchema.index({ userId: 1, scheduledAt: 1 });
ScheduledPostSchema.index({ accountId: 1, publishedAt: 1 });

export type ScheduledPostDoc = HydratedDocument<InferSchemaType<typeof ScheduledPostSchema>>;
export const ScheduledPost = model("ScheduledPost", ScheduledPostSchema);

export const EDITABLE_STATUSES = ["draft", "scheduled", "failed"] as const;
export const PENDING_STATUSES = ["draft", "scheduled"] as const;

export function publicPost(p: ScheduledPostDoc) {
  return {
    id: p.id as string,
    accountId: p.accountId ? String(p.accountId) : undefined,
    destination: p.destination ?? "instagram",
    facebookPageId: p.facebookPageId,
    fbPostId: p.fbPostId,
    fbPermalink: p.fbPermalink,
    batchId: p.batchId ? String(p.batchId) : undefined,
    type: p.type,
    mediaIds: p.mediaIds.map(String),
    caption: p.caption ?? "",
    scheduledAt: p.scheduledAt,
    status: p.status,
    attempts: p.attempts,
    nextAttemptAt: p.nextAttemptAt,
    lastError: p.lastError,
    igMediaId: p.igMediaId,
    permalink: p.permalink,
    publishedAt: p.publishedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}
