import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

function getSecretKey() {
  return (
    Deno.env.get("SUPABASE_SECRET_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    (() => {
      try {
        const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
        if (!raw) return "";
        const parsed = JSON.parse(raw);
        return parsed.default || Object.values(parsed)[0] || "";
      } catch {
        return "";
      }
    })()
  );
}

async function getCaller(url: string, req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Missing Authorization header");

  let publishable =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") ||
    "";

  if (!publishable) {
    try {
      const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
      if (raw) {
        const parsed = JSON.parse(raw);
        publishable = parsed.default || Object.values(parsed)[0] || "";
      }
    } catch {
      publishable = "";
    }
  }

  const client = createClient(url, publishable, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authentication session");
  return data.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const secret = getSecretKey();
  if (!url || !secret) return json({ error: "Edge Function secret is not configured." }, 500);

  try {
    const caller = await getCaller(url, req);
    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("id,role,active")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileError) return json({ error: profileError.message }, 500);
    if (!callerProfile || callerProfile.role !== "admin" || callerProfile.active === false) {
      return json({ error: "Administrator permission required." }, 403);
    }

    const body = await req.json();
    const action = body?.action;
    const user = body?.user || {};

    if (action === "create") {
      if (!user.name || !user.username || !user.email || !user.password) {
        return json({ error: "name, username, email and password are required." }, 400);
      }
      if (String(user.password).length < 6) {
        return json({ error: "Password must be at least 6 characters." }, 400);
      }

      const { data, error } = await admin.auth.admin.createUser({
        email: String(user.email).toLowerCase(),
        password: String(user.password),
        email_confirm: true,
        user_metadata: {
          name: user.name,
          username: user.username,
          role: user.role || "photographer",
        },
      });
      if (error || !data.user) return json({ error: error?.message || "Unable to create Auth user." }, 400);

      const { error: profileInsertError } = await admin.from("profiles").upsert({
        id: data.user.id,
        username: user.username,
        name: user.name,
        role: user.role || "photographer",
        active: user.active !== false,
        email: String(user.email).toLowerCase(),
      }, { onConflict: "id" });

      if (profileInsertError) {
        await admin.auth.admin.deleteUser(data.user.id);
        return json({ error: profileInsertError.message }, 400);
      }

      return json({ user: {
        id: data.user.id,
        username: user.username,
        name: user.name,
        role: user.role || "photographer",
        active: user.active !== false,
        email: String(user.email).toLowerCase(),
      }});
    }

    if (action === "update") {
      const id = String(user.id || "");
      if (!id) return json({ error: "User id is required." }, 400);
      if (id === caller.id && user.role !== "admin") {
        return json({ error: "You cannot remove your own Administrator role." }, 400);
      }

      const authPatch: Record<string, unknown> = {
        email: String(user.email || "").toLowerCase(),
        user_metadata: {
          name: user.name,
          username: user.username,
          role: user.role || "photographer",
        },
      };
      if (user.password) authPatch.password = user.password;

      const { data, error } = await admin.auth.admin.updateUserById(id, authPatch);
      if (error || !data.user) return json({ error: error?.message || "Unable to update Auth user." }, 400);

      const { error: profileUpdateError } = await admin.from("profiles").upsert({
        id,
        username: user.username,
        name: user.name,
        role: user.role || "photographer",
        active: user.active !== false,
        email: String(user.email || "").toLowerCase(),
      }, { onConflict: "id" });

      if (profileUpdateError) return json({ error: profileUpdateError.message }, 400);

      return json({ user: {
        id,
        username: user.username,
        name: user.name,
        role: user.role || "photographer",
        active: user.active !== false,
        email: String(user.email || "").toLowerCase(),
      }});
    }

    if (action === "delete") {
      const id = String(body?.userId || "");
      if (!id) return json({ error: "User id is required." }, 400);
      if (id === caller.id) return json({ error: "You cannot delete the currently logged-in user." }, 400);
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, userId: id });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected server error." }, 500);
  }
});
