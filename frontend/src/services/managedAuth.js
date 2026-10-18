import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const managedAuthEnabled = import.meta.env.VITE_VERA_MANAGED_AUTH_ENABLED === "true" && Boolean(url && key);
export const googleAuthEnabled = managedAuthEnabled && import.meta.env.VITE_VERA_GOOGLE_AUTH_ENABLED === "true";
export const microsoftAuthEnabled = managedAuthEnabled && import.meta.env.VITE_VERA_AZURE_AUTH_ENABLED === "true";

export const managedAuth = managedAuthEnabled
  ? createClient(url, key, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true } })
  : null;

export const startSocialSignIn = async (provider) => {
  if (!managedAuth || (provider === "google" && !googleAuthEnabled) ||
      (provider === "azure" && !microsoftAuthEnabled)) {
    throw new Error("Este proveedor aún no está disponible.");
  }
  const { error } = await managedAuth.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/`,
      ...(provider === "azure" ? { scopes: "email" } : {})
    }
  });
  if (error) throw error;
};
