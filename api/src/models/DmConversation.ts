import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";
import { StepSchema } from "./DmAutomation";

const DmConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "InstagramAccount", required: true },
    automationId: { type: Schema.Types.ObjectId, ref: "DmAutomation", required: true },
    igScopedUserId: { type: String, required: true },
    followerUsername: { type: String },
    commentId: { type: String },
    currentStepId: { type: String, required: true },
    status: { type: String, enum: ["active", "completed", "expired", "failed"], default: "active", required: true },
    windowExpiresAt: { type: Date, required: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    flow: {
      startStepId: { type: String, required: true },
      steps: { type: [StepSchema], required: true },
    },
    buttonsPending: { type: Boolean, default: false },
    privateReplySentAt: { type: Date },
    queued: { type: Boolean, default: false },
  },
  { timestamps: true }
);

DmConversationSchema.index({ automationId: 1, igScopedUserId: 1 }, { unique: true });
DmConversationSchema.index({ windowExpiresAt: 1 });
DmConversationSchema.index({ accountId: 1, privateReplySentAt: 1 });
DmConversationSchema.index({ accountId: 1, igScopedUserId: 1, status: 1 });

export type DmConversationDoc = HydratedDocument<InferSchemaType<typeof DmConversationSchema>>;
export const DmConversation = model("DmConversation", DmConversationSchema);
