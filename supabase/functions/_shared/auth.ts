// التحقق من المستخدم وصلاحيته من رمز الدخول
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/** يرجع { user, profile } أو null. يقبل أيضاً مفتاح الخدمة (لـ GitHub Actions) */
export async function whoIs(req: Request, allowUnapproved = false) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (svc && token === svc) return { service: true, user: null, profile: { role: "admin", approved: true, name: "النظام" } };
  const db = admin();
  const { data: u, error } = await db.auth.getUser(token);
  if (error || !u?.user) return null;
  const { data: p } = await db.from("profiles").select("id,name,role,approved").eq("id", u.user.id).single();
  if (!p) return null;
  if (!p.approved && !allowUnapproved) return null;
  return { service: false, user: u.user, profile: p };
}
