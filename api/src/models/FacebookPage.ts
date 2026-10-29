import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

// Página do Facebook a que o usuário deu acesso pelo login do Facebook. O token de Página não expira.
const FacebookPageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pageId: { type: String, required: true },
    name: { type: String, required: true },
    tokenEnc: {
      type: new Schema({ data: String, iv: String, tag: String }, { _id: false }),
      required: true,
    },
    // Instagram ligado à Página, quando a Meta devolve um. Serve de ponto de partida para consultar outros perfis.
    igUserId: { type: String },
    igUsername: { type: String },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
FacebookPageSchema.index({ userId: 1, pageId: 1 }, { unique: true });

export type FacebookPageDoc = HydratedDocument<InferSchemaType<typeof FacebookPageSchema>>;
export const FacebookPage = model("FacebookPage", FacebookPageSchema);
