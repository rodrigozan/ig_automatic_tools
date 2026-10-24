import { config } from "../config";
import { Invite } from "../models/Invite";
import { User, UserDoc } from "../models/User";
import { ProviderProfile } from "./oauth";

export type LoginError = "not_invited" | "disabled" | "unverified";

export const loginMessages: Record<LoginError | "failed", string> = {
  not_invited: "Seu e-mail ainda não foi liberado.",
  disabled: "Sua conta está desativada.",
  unverified: "O provedor não confirmou seu e-mail.",
  failed: "Não foi possível entrar. Tente de novo.",
};

export async function resolveLogin(p: ProviderProfile): Promise<{ user: UserDoc } | { error: LoginError }> {
  const byProvider = await User.findOne({ providers: { $elemMatch: { provider: p.provider, providerId: p.providerId } } });
  if (byProvider) {
    if (!byProvider.active) return { error: "disabled" };
    return { user: byProvider };
  }

  if (!p.email || !p.emailVerified) return { error: "unverified" };
  const email = p.email.toLowerCase();

  const byEmail = await User.findOne({ email });
  if (byEmail) {
    if (!byEmail.active) return { error: "disabled" };
    byEmail.providers.push({ provider: p.provider, providerId: p.providerId });
    if (!byEmail.avatarUrl && p.avatarUrl) byEmail.avatarUrl = p.avatarUrl;
    await byEmail.save();
    return { user: byEmail };
  }

  const base = {
    name: p.name,
    email,
    avatarUrl: p.avatarUrl,
    providers: [{ provider: p.provider, providerId: p.providerId }],
  };

  if (config.adminEmail && email === config.adminEmail) {
    return { user: await User.create({ ...base, role: "admin" }) };
  }

  const invite = await Invite.findOne({ email });
  if (!invite) return { error: "not_invited" };
  const user = await User.create({ ...base, role: "creator" });
  if (!invite.usedAt) {
    invite.usedAt = new Date();
    await invite.save();
  }
  return { user };
}
