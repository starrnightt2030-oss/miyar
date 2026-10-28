// الإشعارات اللحظية (Web Push)
// GET  → المفتاح العام VAPID للتطبيق
// POST → { title, body, url?, tag?, kind?, toUsers?: uuid[], toRoles?: string[], all?: bool }
import webpush from "npm:web-push@3.6.7";
import { cors, json, whoIs, admin } from "../_shared/auth.ts";

const PUB = Deno.env.get("VAPID_PUBLIC") || "";
const PRIV = Deno.env.get("VAPID_PRIVATE") || "";
if (PUB && PRIV) webpush.setVapidDetails("mailto:" + (Deno.env.get("VAPID_CONTACT") || "admin@example.com"), PUB, PRIV);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ publicKey: PUB });
  const who = await whoIs(req, true);
  if (!who) return json({ error: "غير مصرح" }, 401);
  if (!PUB || !PRIV) return json({ error: "مفاتيح VAPID غير مضبوطة" }, 500);
  const b = await req.json().catch(() => ({}));
  // الحساب غير المعتمد يرسل فقط طلب الموافقة لمدير النظام
  if (!who.profile.approved) {
    if (b.kind !== "signup") return json({ error: "الحساب بانتظار الموافقة" }, 403);
    b.toRoles = ["admin"]; b.toUsers = []; b.all = false;
  }
  if (!b.title) return json({ error: "العنوان مطلوب" }, 400);
  // إرسال للجميع: لمدير النظام أو GitHub Actions فقط
  if (b.all && !(who.service || who.profile.role === "admin")) return json({ error: "الإرسال للجميع لمدير النظام فقط" }, 403);

  const db = admin();
  let userIds: string[] | null = null;
  if (!b.all) {
    const ids = new Set<string>((b.toUsers || []).filter(Boolean));
    if (b.toRoles?.length) {
      const { data } = await db.from("profiles").select("id").in("role", b.toRoles).eq("approved", true);
      (data || []).forEach((p: any) => ids.add(p.id));
    }
    if (who.user) ids.delete(who.user.id); // لا نرسل للمرسل نفسه
    userIds = [...ids];
    if (!userIds.length) return json({ sent: 0 });
  }
  let q = db.from("push_subs").select("endpoint,sub,user_id");
  if (userIds) q = q.in("user_id", userIds);
  const { data: subs } = await q;
  const payload = JSON.stringify({ title: b.title, body: b.body || "", url: b.url || "./index.html", tag: b.tag || b.kind || "miyar", kind: b.kind || "event", from: who.profile.name });
  let sent = 0, removed = 0;
  await Promise.all((subs || []).map(async (s: any) => {
    try { await webpush.sendNotification(s.sub, payload, { TTL: 60 * 60 * 24, urgency: "high" }); sent++; }
    catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) { await db.from("push_subs").delete().eq("endpoint", s.endpoint); removed++; }
    }
  }));
  return json({ sent, removed, total: (subs || []).length });
});
