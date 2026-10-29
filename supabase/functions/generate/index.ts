// توليد الأسئلة من صور الدرس — مفاتيح Claude / ChatGPT / Gemini محفوظة على الخادم فقط
// GET            → { providers: [...] } المزودون المضبوطون
// POST models    → { action: "models", provider }
// POST generate  → { provider, model, body }  (body بصيغة المزود، يبنيه التطبيق)
import { cors, json, whoIs, admin } from "../_shared/auth.ts";

const KEYS: Record<string, string | undefined> = {
  anthropic: Deno.env.get("ANTHROPIC_API_KEY"),
  openai: Deno.env.get("OPENAI_API_KEY"),
  gemini: Deno.env.get("GEMINI_API_KEY"),
};
const MAX_BYTES = 40 * 1024 * 1024;
const configured = () => Object.keys(KEYS).filter((k) => !!KEYS[k]);

async function listModels(p: string) {
  const k = KEYS[p]!;
  if (p === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: { "x-api-key": k, "anthropic-version": "2023-06-01" } });
    const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || r.statusText);
    return (j.data || []).map((m: any) => ({ id: m.id, label: m.display_name || m.id }));
  }
  if (p === "openai") {
    const r = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: "Bearer " + k } });
    const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || r.statusText);
    return (j.data || []).filter((m: any) => /^(gpt-|o\d|chatgpt)/.test(m.id) && !/(audio|realtime|tts|transcribe|image|embedding|search|instruct|codex|moderation)/.test(m.id))
      .sort((a: any, b: any) => (b.created || 0) - (a.created || 0)).map((m: any) => ({ id: m.id, label: m.id }));
  }
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": k } });
  const j = await r.json(); if (!r.ok) throw new Error(j?.error?.message || r.statusText);
  return (j.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/.test(m.name) && !/(image|tts|embedding|audio|live|robotics|computer)/.test(m.name))
    .map((m: any) => ({ id: m.name.replace(/^models\//, ""), label: m.displayName || m.name })).reverse();
}

function usageOf(p: string, j: any) {
  if (p === "anthropic") return [j?.usage?.input_tokens || 0, j?.usage?.output_tokens || 0];
  if (p === "openai") return [j?.usage?.prompt_tokens || 0, j?.usage?.completion_tokens || 0];
  return [j?.usageMetadata?.promptTokenCount || 0, j?.usageMetadata?.candidatesTokenCount || 0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method === "GET") return json({ providers: configured() });
  if (req.method !== "POST") return json({ error: "POST فقط" }, 405);
  const who = await whoIs(req);
  if (!who) return json({ error: "سجّل الدخول بحساب معتمد" }, 401);

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json({ error: "حجم الصور كبير جداً — قلّل عدد الصفحات" }, 413);
  let b: any;
  try { b = JSON.parse(raw); } catch { return json({ error: "طلب غير صالح" }, 400); }
  const p = b.provider || "anthropic";
  if (!KEYS[p]) return json({ error: "لا يوجد مفتاح لهذا المزود على الخادم" }, 400);

  if (b.action === "models") {
    try { return json(await listModels(p)); } catch (e: any) { return json({ error: e.message }, 502); }
  }

  const model = String(b.model || "");
  if (!/^[a-zA-Z0-9.\-_:]{3,80}$/.test(model)) return json({ error: "اسم نموذج غير صالح" }, 400);
  const body = b.body || {};
  let r: Response;
  if (p === "anthropic") {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": KEYS[p]!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: Math.min(Number(body.max_tokens) || 8000, 16000), system: String(body.system || ""), messages: body.messages, output_config: body.output_config }),
    });
  } else if (p === "openai") {
    r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer " + KEYS[p] },
      body: JSON.stringify({ model, max_completion_tokens: Math.min(Number(body.max_completion_tokens) || 8000, 16000), messages: body.messages, response_format: body.response_format }),
    });
  } else {
    const gc = body.generationConfig || {};
    gc.maxOutputTokens = Math.min(Number(gc.maxOutputTokens) || 8000, 16000);
    r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": KEYS[p]! },
      body: JSON.stringify({ systemInstruction: body.systemInstruction, contents: body.contents, generationConfig: gc }),
    });
  }
  const j = await r.json().catch(() => ({}));
  if (r.ok) {
    const [i, o] = usageOf(p, j);
    await admin().from("ai_usage").insert({ user_id: who.user?.id ?? null, model: p + ":" + model, input_tokens: i, output_tokens: o });
  }
  return json(j, r.status);
});
