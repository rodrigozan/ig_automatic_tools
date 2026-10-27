import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

// Um perfil analisado. "own" é a conta conectada do usuário, "competitor" entra no comparativo da tela
// e "lookup" é só cache de uma consulta avulsa (a prospecção do Harvey), sem aparecer no comparativo.
const ProfileAnalysisSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    username: { type: String, required: true, lowercase: true },
    kind: { type: String, enum: ["own", "competitor", "lookup"], required: true },
    profile: {
      name: String,
      biography: String,
      website: String,
      profilePictureUrl: String,
    },
    metrics: { type: Schema.Types.Mixed },
    error: { type: String },
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
ProfileAnalysisSchema.index({ userId: 1, username: 1 }, { unique: true });

export type ProfileAnalysisDoc = HydratedDocument<InferSchemaType<typeof ProfileAnalysisSchema>>;
export const ProfileAnalysis = model("ProfileAnalysis", ProfileAnalysisSchema);

export function publicAnalysis(a: ProfileAnalysisDoc) {
  return {
    id: a.id as string,
    username: a.username,
    kind: a.kind,
    profile: a.profile,
    metrics: a.metrics ?? null,
    error: a.error ?? null,
    fetchedAt: a.fetchedAt,
  };
}
