// توليد الأسئلة من صور الدرس — مفتاح Claude محفوظ على الخادم فقط
import { cors, json, whoIs, admin } from "../_shared/auth.ts";

const MODELS = ["claude-sonnet-5-5", "claude-opus-5-5"];
const MAX_BYTES = 40 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST فقط" }, 405);
  const who = await whoIs(req);
  if (!who) return json({ error: "سجّل الدخول بحساب معتمد" }, 401);
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "مفتاح ANTHROPIC_API_KEY غير مضبوط على الخادم" }, 500);

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: "حجم الصور كبير جداً — قلّل عدد الصفحات" }, 413);
  let b: any;
  try { b = JSON.parse(raw); } catch { return json({ error: "طلب غير صالح" }, 400); }
  if (!MODELS.includes(b.model)) return json({ error: "نموذج غير مسموح" }, 400);

  // نمرر فقط الحقول المسموحة
  const body = {
    model: b.model,
    max_tokens: Math.min(Number(b.max_tokens) || 8000, 16000),
    system: String(b.system || ""),
    messages: b.messages,
    output_config: b.output_config,
  };
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (r.ok && j.usage) {
    await admin().from("ai_usage").insert({ user_id: who.user?.id ?? null, model: b.model, input_tokens: j.usage.input_tokens, output_tokens: j.usage.output_tokens });
  }
  return json(j, r.status);
});
