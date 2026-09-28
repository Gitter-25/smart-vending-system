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
   * This uses the same prototype device secret as the
   * existing vending dispense endpoints.
   *
   * Later, when the ESP32-S3 hardware is connected,
   * this can be upgraded to per-machine credentials.
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
      failure_reason,
    } = body;

    /*
     * Validate required input.
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

    const transactionId =
      String(transaction_id).trim();

    const machineCode =
      String(machine_code).trim();

    const failureReason =
      failure_reason == null
        ? null
        : String(failure_reason).trim();

    if (
      transactionId === "" ||
      machineCode === ""
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

    /*
     * Privileged server-side Supabase client.
     *
     * The browser and ESP32 never receive the
     * service-role key.
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
     * Recover a transaction where:
     *
     * - payment was already confirmed
     * - transaction is still pending
     * - dispensing never started
     *
     * The PostgreSQL function performs the recovery
     * atomically and provides duplicate protection.
     */
    const { data, error } =
      await supabase.rpc(
        "recover_paid_vending_transaction",
        {
          p_transaction_id:
            transactionId,

          p_machine_code:
            machineCode,

          p_failure_reason:
            failureReason ||
            "Paid transaction recovered before dispensing started",
        },
      );

    if (error) {
      console.error(
        "Paid transaction recovery failed:",
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

    const recovery = data?.[0];

    if (!recovery) {
      return jsonResponse(
        {
          success: false,
          error:
            "Recovery result was not returned",
        },
        500,
      );
    }

    /*
     * Important:
     *
     * For Student ID payments, the database can refund
     * the internal wallet immediately.
     *
     * For Maya/external payments, refund_status may be
     * "required". That does NOT mean Maya has refunded
     * the customer yet. A separate provider refund
     * process must complete that operation.
     */
    const externalRefundRequired =
      recovery.refund_status === "required";

    return jsonResponse(
      {
        success: true,

        recovery,

        external_refund_required:
          externalRefundRequired,

        message: externalRefundRequired
          ? "Transaction recovered. External payment refund is required."
          : recovery.already_recovered
            ? "Transaction was already recovered."
            : "Transaction recovered successfully.",
      },
      200,
    );
  } catch (error) {
    console.error(
      "Vending dispense-recover error:",
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