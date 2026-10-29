import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

// Uma Página do Facebook analisada. "own" é uma Página do usuário, "competitor" entra no comparativo da tela.
const PageAnalysisSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pageId: { type: String, required: true },
    kind: { type: String, enum: ["own", "competitor"], required: true },
    username: { type: String },
    profile: {
      name: String,
      biography: String,
      website: String,
      profilePictureUrl: String,
    },
    metrics: { type: Schema.Types.Mixed },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
PageAnalysisSchema.index({ userId: 1, pageId: 1 }, { unique: true });

export type PageAnalysisDoc = HydratedDocument<InferSchemaType<typeof PageAnalysisSchema>>;
export const PageAnalysis = model("PageAnalysis", PageAnalysisSchema);

export function publicPageAnalysis(a: PageAnalysisDoc) {
  return {
    id: a.id as string,
    // A tela é a mesma do Instagram: "username" é o que aparece como @ do perfil.
    username: a.username || a.pageId,
    pageId: a.pageId,
    kind: a.kind,
    profile: a.profile,
    metrics: a.metrics ?? null,
    error: null,
    fetchedAt: a.fetchedAt,
  };
}
