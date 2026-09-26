import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (
  body: Record<string, unknown>,
  status: number,
) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  try {
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey
    ) {
      console.error(
        "Required Supabase environment variables are missing",
      );

      return jsonResponse(
        {
          success: false,
          error: "Server configuration error",
        },
        500,
      );
    }

    // Require an authenticated Supabase user.
    const authorization =
      req.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(
        {
          success: false,
          error: "Authentication required",
        },
        401,
      );
    }

    const authClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid or expired session",
        },
        401,
      );
    }

    // Server-side privileged client.
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // Verify active SmartVend administrator.
    const {
      data: adminProfile,
      error: adminError,
    } = await adminClient
      .from("admin_profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error(
        "Admin verification failed:",
        adminError.message,
      );

      return jsonResponse(
        {
          success: false,
          error: "Unable to verify administrator",
        },
        500,
      );
    }

    if (
      !adminProfile ||
      adminProfile.role !== "admin" ||
      adminProfile.status !== "active"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Active administrator access required",
        },
        403,
      );
    }

    const body = await req.json();

    const {
      card_uid,
      machine_code,
      slot_code,
      request_id,
    } = body;

    if (
      !card_uid ||
      !machine_code ||
      !slot_code ||
      !request_id
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "card_uid, machine_code, slot_code, and request_id are required",
        },
        400,
      );
    }

    // Simulator is restricted to the project's
    // single vending machine.
    if (
      String(machine_code).trim() !== "SVM-001"
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid simulator machine",
        },
        400,
      );
    }

    // Use the same atomic purchase RPC as the
    // real ESP32 vending-purchase endpoint.
    const { data, error } =
      await adminClient.rpc(
        "purchase_from_vending_machine",
        {
          p_card_uid:
            String(card_uid).trim(),
          p_machine_code:
            String(machine_code).trim(),
          p_slot_code:
            String(slot_code).trim(),
          p_request_id:
            String(request_id).trim(),
        },
      );

    if (error) {
      console.error(
        "Simulator card purchase failed:",
        error.message,
      );

      return jsonResponse(
        {
          success: false,
          error: error.message,
        },
        400,
      );
    }

    const purchase = data?.[0];

    if (!purchase) {
      return jsonResponse(
        {
          success: false,
          error:
            "Purchase did not return a result",
        },
        500,
      );
    }

    return jsonResponse(
      {
        success: true,
        simulator: true,
        machine_code: "SVM-001",
        transaction: purchase,
      },
      200,
    );
  } catch (error) {
    console.error(
      "Vending simulator purchase error:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error",
      },
      500,
    );
  }
});