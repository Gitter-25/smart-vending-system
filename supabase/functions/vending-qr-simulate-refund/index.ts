import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-device-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
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
    /*
     * --------------------------------------------------------
     * 1. Environment
     * --------------------------------------------------------
     */
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const configuredDeviceSecret =
      Deno.env.get("VENDING_DEVICE_SECRET");

    const mayaEnvironment =
      Deno.env.get("MAYA_ENVIRONMENT");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        "Supabase server environment is not configured",
      );
    }

    if (!configuredDeviceSecret) {
      throw new Error(
        "VENDING_DEVICE_SECRET is not configured",
      );
    }

    /*
     * --------------------------------------------------------
     * 2. Sandbox protection
     *
     * This endpoint must NEVER simulate refunds in production.
     * --------------------------------------------------------
     */
    if (
      mayaEnvironment?.trim().toLowerCase() !==
      "sandbox"
    ) {
      return jsonResponse(
        {
          success: false,
          simulated: false,
          error:
            "Refund simulation is only available in the Maya sandbox environment.",
        },
        403,
      );
    }

    /*
     * --------------------------------------------------------
     * 3. Device authentication
     * --------------------------------------------------------
     */
    const providedDeviceSecret =
      req.headers.get("x-device-secret");

    if (
      !providedDeviceSecret ||
      providedDeviceSecret !==
        configuredDeviceSecret
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Unauthorized device",
        },
        401,
      );
    }

    /*
     * --------------------------------------------------------
     * 4. Request body
     * --------------------------------------------------------
     */
    let body: {
      transaction_id?: string;
    };

    try {
      body = await req.json();
    } catch {
      return jsonResponse(
        {
          success: false,
          error: "Invalid JSON body",
        },
        400,
      );
    }

    const transactionId =
      body.transaction_id?.trim();

    if (!transactionId) {
      return jsonResponse(
        {
          success: false,
          error: "transaction_id is required",
        },
        400,
      );
    }

    /*
     * --------------------------------------------------------
     * 5. Trusted server-side Supabase client
     * --------------------------------------------------------
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
     * --------------------------------------------------------
     * 6. Load transaction
     * --------------------------------------------------------
     */
    const {
      data: transaction,
      error: transactionError,
    } = await supabase
      .from("vending_transactions")
      .select(`
        id,
        transaction_code,
        student_id,
        status,
        payment_method,
        payment_provider,
        payment_reference,
        payment_status,
        dispense_status,
        refund_status,
        refund_reference
      `)
      .eq("id", transactionId)
      .maybeSingle();

    if (transactionError) {
      throw new Error(transactionError.message);
    }

    if (!transaction) {
      return jsonResponse(
        {
          success: false,
          error: "Transaction not found",
        },
        404,
      );
    }

    /*
     * --------------------------------------------------------
     * 7. Verify this is an external Maya QR transaction
     * --------------------------------------------------------
     */
    if (transaction.student_id !== null) {
      return jsonResponse(
        {
          success: false,
          error:
            "Student wallet transactions cannot use the external refund simulator.",
        },
        400,
      );
    }

    if (
      transaction.payment_provider
        ?.trim()
        .toLowerCase() !== "maya"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Transaction is not a Maya payment.",
        },
        400,
      );
    }

    /*
     * --------------------------------------------------------
     * 8. Idempotent completed-refund handling
     * --------------------------------------------------------
     */
    if (
      transaction.status === "refunded" &&
      transaction.payment_status ===
        "refunded" &&
      transaction.refund_status ===
        "completed"
    ) {
      return jsonResponse({
        success: true,
        simulated: true,
        already_confirmed: true,

        warning:
          "Sandbox refund success was simulated and was not confirmed by Maya.",

        transaction_id:
          transaction.id,

        transaction_code:
          transaction.transaction_code,

        payment_status:
          transaction.payment_status,

        transaction_status:
          transaction.status,

        dispense_status:
          transaction.dispense_status,

        refund_status:
          transaction.refund_status,

        refund_reference:
          transaction.refund_reference,

        event:
          "SIMULATED_REFUND_SUCCESS",
      });
    }

    /*
     * --------------------------------------------------------
     * 9. Validate refund eligibility
     * --------------------------------------------------------
     */
    if (transaction.status !== "pending") {
      return jsonResponse(
        {
          success: false,
          error:
            "Transaction is not awaiting refund.",
        },
        400,
      );
    }

    if (
      transaction.payment_status !== "paid"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Transaction payment is not in paid state.",
        },
        400,
      );
    }

    if (
      transaction.dispense_status !==
      "failed"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Dispense failure has not been recorded.",
        },
        400,
      );
    }

    if (
      ![
        "required",
        "processing",
        "failed",
      ].includes(transaction.refund_status)
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Transaction is not awaiting an external refund.",
        },
        400,
      );
    }

    /*
     * --------------------------------------------------------
     * 10. Create an explicit sandbox-only refund reference
     *
     * This is NOT a Maya refund ID.
     * --------------------------------------------------------
     */
    const simulatedRefundReference =
      `SIM-REFUND-${transaction.id}`;

    /*
     * --------------------------------------------------------
     * 11. Finalize using the protected database RPC
     * --------------------------------------------------------
     */
    const {
      data: refundResult,
      error: refundError,
    } = await supabase.rpc(
      "confirm_external_vending_refund",
      {
        p_transaction_id:
          transaction.id,

        p_refund_reference:
          simulatedRefundReference,

        p_provider_event:
          "SIMULATED_REFUND_SUCCESS",
      },
    );

    if (refundError) {
      return jsonResponse(
        {
          success: false,
          error: refundError.message,
        },
        400,
      );
    }

    const finalized =
      Array.isArray(refundResult)
        ? refundResult[0]
        : refundResult;

    if (!finalized) {
      throw new Error(
        "Refund confirmation returned no result",
      );
    }

    /*
     * --------------------------------------------------------
     * 12. Response
     * --------------------------------------------------------
     */
    return jsonResponse({
      success: true,

      simulated: true,

      warning:
        "Sandbox refund success was simulated and was not confirmed by Maya.",

      transaction_id:
        finalized.transaction_id,

      transaction_code:
        finalized.transaction_code,

      payment_status:
        finalized.payment_status,

      transaction_status:
        finalized.transaction_status,

      dispense_status:
        finalized.dispense_status,

      refund_status:
        finalized.refund_status,

      refund_reference:
        finalized.refund_reference,

      already_confirmed: false,

      event:
        "SIMULATED_REFUND_SUCCESS",
    });
  } catch (error) {
    console.error(
      "vending-qr-simulate-refund error:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal server error",
      },
      500,
    );
  }
});