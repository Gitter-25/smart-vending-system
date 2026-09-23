import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-secret",
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
  // Handle browser preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  // Verify vending machine/device secret
  const deviceSecret = Deno.env.get(
    "VENDING_DEVICE_SECRET",
  );

  const providedSecret = req.headers.get(
    "x-device-secret",
  );

  if (!deviceSecret) {
    console.error(
      "VENDING_DEVICE_SECRET is not configured",
    );

    return jsonResponse(
      {
        success: false,
        error: "Server configuration error",
      },
      500,
    );
  }

  if (
    !providedSecret ||
    providedSecret !== deviceSecret
  ) {
    return jsonResponse(
      {
        success: false,
        error: "Unauthorized device",
      },
      401,
    );
  }

  try {
    const body = await req.json();

    const {
  card_uid,
  machine_code,
  slot_code,
  request_id,
} = body;

    // Validate required request fields
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

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "Supabase server environment variables are missing",
      );

      return jsonResponse(
        {
          success: false,
          error: "Server configuration error",
        },
        500,
      );
    }

    // Server-side Supabase client
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // Execute the atomic PostgreSQL purchase function
    const { data, error } = await supabase.rpc(
      "purchase_from_vending_machine",
      {
        p_card_uid: String(card_uid).trim(),
  p_machine_code: String(machine_code).trim(),
  p_slot_code: String(slot_code).trim(),
  p_request_id: String(request_id).trim(),
      },
    );

    if (error) {
      console.error(
        "Purchase failed:",
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
      console.error(
        "Purchase RPC returned no result",
      );

      return jsonResponse(
        {
          success: false,
          error: "Purchase did not return a result",
        },
        500,
      );
    }

    return jsonResponse(
      {
        success: true,
        transaction: purchase,
      },
      200,
    );
  } catch (error) {
    console.error(
      "Vending purchase error:",
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