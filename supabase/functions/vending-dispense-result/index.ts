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
   * Only POST requests are allowed.
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
   * Verify vending-device credential.
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
     * Parse request body.
     */
    const body = await req.json();

    const {
      transaction_id,
      machine_code,
      dispense_success,
      failure_reason,
    } = body;

    /*
     * Validate required fields.
     */
    if (
      !transaction_id ||
      !machine_code ||
      typeof dispense_success !== "boolean"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "transaction_id, machine_code, and dispense_success are required",
        },
        400,
      );
    }

    /*
     * Validate failure reason when dispensing
     * failed.
     */
    if (
      dispense_success === false &&
      (
        !failure_reason ||
        String(failure_reason).trim() === ""
      )
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "failure_reason is required when dispensing fails",
        },
        400,
      );
    }

    /*
     * Server-side Supabase configuration.
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

    /*
     * Privileged server-side Supabase client.
     */
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
     * Finalize dispensing.
     *
     * Database function handles:
     * - successful dispense
     * - failed dispense
     * - wallet refund
     * - stock restoration
     * - duplicate result protection
     */
    const { data, error } =
      await supabase.rpc(
        "complete_vending_dispense",
        {
          p_transaction_id:
            String(transaction_id).trim(),

          p_machine_code:
            String(machine_code).trim(),

          p_dispense_success:
            dispense_success,

          p_failure_reason:
            failure_reason
              ? String(failure_reason).trim()
              : null,
        },
      );

    if (error) {
      console.error(
        "Complete dispense failed:",
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

    const result = data?.[0];

    if (!result) {
      return jsonResponse(
        {
          success: false,
          error:
            "Dispense result was not returned",
        },
        500,
      );
    }

    return jsonResponse(
      {
        success: true,
        transaction: result,
      },
      200,
    );
  } catch (error) {
    console.error(
      "Vending dispense-result error:",
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