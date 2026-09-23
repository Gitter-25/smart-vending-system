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
  /*
   * Browser preflight.
   */
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  /*
   * Only POST is allowed.
   */
  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  /*
   * Verify vending-machine/device credential.
   *
   * We currently use the same prototype secret
   * as vending-purchase.
   *
   * Later this will become per-machine
   * authentication.
   */
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
    /*
     * Parse request.
     */
    const body = await req.json();

    const {
      transaction_id,
      machine_code,
    } = body;

    /*
     * Validate input.
     */
    if (
      !transaction_id ||
      !machine_code
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "transaction_id and machine_code are required",
        },
        400,
      );
    }

    /*
     * Server-only Supabase credentials.
     */
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
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

    /*
     * Start dispensing through the controlled
     * PostgreSQL function.
     */
    const { data, error } =
      await supabase.rpc(
        "start_vending_dispense",
        {
          p_transaction_id:
            String(transaction_id).trim(),

          p_machine_code:
            String(machine_code).trim(),
        },
      );

    if (error) {
      console.error(
        "Start dispense failed:",
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

    const dispense = data?.[0];

    if (!dispense) {
      return jsonResponse(
        {
          success: false,
          error:
            "Dispense instruction was not returned",
        },
        500,
      );
    }

    /*
     * Future ESP32-S3 receives this instruction.
     */
    return jsonResponse(
      {
        success: true,
        dispense,
      },
      200,
    );
  } catch (error) {
    console.error(
      "Vending dispense-start error:",
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