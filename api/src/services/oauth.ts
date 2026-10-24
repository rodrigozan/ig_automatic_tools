import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config";

export type Provider = "google" | "facebook";

export type ProviderProfile = {
  provider: Provider;
  providerId: string;
  email?: string;
  emailVerified: boolean;
  name: string;
  avatarUrl?: string;
};

const FB_VERSION = "v21.0";

export function callbackUrl(provider: Provider) {
  return `${config.publicBaseUrl}/api/auth/${provider}/callback`;
}

function googleClient() {
  return new OAuth2Client(config.googleClientId, config.googleClientSecret, callbackUrl("google"));
}

export const oauth = {
  authUrl(provider: Provider, state: string) {
    if (provider === "google") {
      return googleClient().generateAuthUrl({
        scope: ["openid", "email", "profile"],
        state,
        prompt: "select_account",
      });
    }
    const p = new URLSearchParams({
      client_id: config.facebookAppId,
      redirect_uri: callbackUrl("facebook"),
      state,
      scope: "email,public_profile",
      response_type: "code",
    });
    return `https://www.facebook.com/${FB_VERSION}/dialog/oauth?${p}`;
  },

  async profile(provider: Provider, code: string): Promise<ProviderProfile> {
    if (provider === "google") {
      const client = googleClient();
      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) throw new Error("Google não devolveu id_token");
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.googleClientId });
      const p = ticket.getPayload();
      if (!p?.sub) throw new Error("id_token inválido");
      return {
        provider,
        providerId: p.sub,
        email: p.email?.toLowerCase(),
        emailVerified: p.email_verified === true,
        name: p.name ?? p.email ?? "Creator",
        avatarUrl: p.picture,
      };
    }
    const tokenRes = await axios.get(`https://graph.facebook.com/${FB_VERSION}/oauth/access_token`, {
      params: {
        client_id: config.facebookAppId,
        client_secret: config.facebookAppSecret,
        redirect_uri: callbackUrl("facebook"),
        code,
      },
    });
    const me = await axios.get(`https://graph.facebook.com/${FB_VERSION}/me`, {
      params: { fields: "id,name,email,picture.type(large)", access_token: tokenRes.data.access_token },
    });
    return {
      provider,
      providerId: String(me.data.id),
      email: me.data.email?.toLowerCase(),
      emailVerified: Boolean(me.data.email),
      name: me.data.name ?? "Creator",
      avatarUrl: me.data.picture?.data?.url,
    };
  },
};
