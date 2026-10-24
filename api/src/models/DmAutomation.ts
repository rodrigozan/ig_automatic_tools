import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const ButtonSchema = new Schema(
  {
    label: { type: String, required: true },
    type: { type: String, enum: ["postback", "url"], required: true },
    payload: { type: String },
    url: { type: String },
    nextStepId: { type: String },
  },
  { _id: false }
);

export const StepSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    buttons: { type: [ButtonSchema], default: [] },
  },
  { _id: false }
);

const DmAutomationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "InstagramAccount", required: true, index: true },
    name: { type: String, required: true },
    target: { type: String, enum: ["specific_post", "any_post"], required: true },
    igMediaId: { type: String },
    keywords: { type: [String], required: true, validate: (v: string[]) => v.length > 0 },
    matchMode: { type: String, enum: ["contains", "exact"], default: "contains", required: true },
    startStepId: { type: String, required: true },
    steps: { type: [StepSchema], required: true },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

export type DmAutomationDoc = HydratedDocument<InferSchemaType<typeof DmAutomationSchema>>;
export const DmAutomation = model("DmAutomation", DmAutomationSchema);

export type Step = { id: string; text: string; buttons: { label: string; type: "postback" | "url"; url?: string; nextStepId?: string; payload?: string }[] };

export function publicAutomation(a: DmAutomationDoc) {
  return {
    id: a.id as string,
    accountId: String(a.accountId),
    name: a.name,
    target: a.target,
    igMediaId: a.igMediaId,
    keywords: a.keywords,
    matchMode: a.matchMode,
    startStepId: a.startStepId,
    steps: (a.steps as unknown as Step[]).map((s) => ({
      id: s.id,
      text: s.text,
      buttons: s.buttons.map((b) => ({ label: b.label, type: b.type, url: b.url, nextStepId: b.nextStepId })),
    })),
    active: a.active,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
