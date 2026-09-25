import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const VENDING_DEVICE_SECRET =
  Deno.env.get("VENDING_DEVICE_SECRET");

const MAYA_ENVIRONMENT =
  Deno.env.get("MAYA_ENVIRONMENT") ?? "sandbox";

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !VENDING_DEVICE_SECRET
) {
  throw new Error(
    "Missing required server environment variables",
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  // ----------------------------------------------------------
  // HARD SAFETY BOUNDARY
  // ----------------------------------------------------------

  if (MAYA_ENVIRONMENT !== "sandbox") {
    console.error(
      "Blocked simulated payment outside sandbox",
    );

    return jsonResponse(
      {
        success: false,
        error:
          "Payment simulation is disabled outside sandbox",
      },
      403,
    );
  }

  // ----------------------------------------------------------
  // Authenticate vending simulator
  // ----------------------------------------------------------

  const deviceSecret =
    req.headers.get("x-device-secret");

  if (
    !deviceSecret ||
    deviceSecret !== VENDING_DEVICE_SECRET
  ) {
    return jsonResponse(
      {
        success: false,
        error: "Unauthorized vending device",
      },
      401,
    );
  }

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

  try {
    // --------------------------------------------------------
    // Load transaction
    // --------------------------------------------------------

    const {
      data: transaction,
      error: transactionError,
    } = await supabase
      .from("vending_transactions")
      .select(`
        id,
        transaction_code,
        payment_reference,
        payment_method,
        payment_provider,
        payment_status,
        status,
        dispense_status
      `)
      .eq("id", transactionId)
      .maybeSingle();

    if (transactionError) {
      throw new Error(
        transactionError.message,
      );
    }

    if (!transaction) {
      return jsonResponse(
        {
          success: false,
          error: "Vending transaction not found",
        },
        404,
      );
    }

    // --------------------------------------------------------
    // Only Maya QR transactions may use this simulator
    // --------------------------------------------------------

    if (
      transaction.payment_method !== "qr" ||
      transaction.payment_provider !== "maya"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Transaction is not a Maya QR payment",
        },
        400,
      );
    }

    if (!transaction.payment_reference) {
      return jsonResponse(
        {
          success: false,
          error:
            "Transaction has no Maya payment reference",
        },
        409,
      );
    }

    // --------------------------------------------------------
    // Do not resurrect failed/refunded transactions
    // --------------------------------------------------------

    if (transaction.status !== "pending") {
      return jsonResponse(
        {
          success: false,
          error:
            `Transaction is already ${transaction.status}`,
        },
        409,
      );
    }

    if (
      transaction.dispense_status !==
      "not_started"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Dispense has already started",
        },
        409,
      );
    }

    // --------------------------------------------------------
    // Use the SAME atomic confirmation RPC as the real flow.
    //
    // We deliberately label the event SIMULATED_* so the
    // database/audit trail never claims Maya confirmed it.
    // --------------------------------------------------------

    const {
      data: confirmationData,
      error: confirmationError,
    } = await supabase.rpc(
      "confirm_qr_vending_payment",
      {
        p_transaction_id:
          transaction.id,

        p_payment_reference:
          transaction.payment_reference,

        p_provider_event:
          "SIMULATED_PAYMENT_SUCCESS",
      },
    );

    if (confirmationError) {
      console.error(
        "Sandbox payment simulation failed:",
        confirmationError,
      );

      return jsonResponse(
        {
          success: false,
          error:
            confirmationError.message,
        },
        500,
      );
    }

    const confirmation =
      Array.isArray(confirmationData)
        ? confirmationData[0]
        : confirmationData;

    console.warn(
      "SANDBOX PAYMENT SIMULATED:",
      {
        transactionId:
          transaction.id,

        transactionCode:
          transaction.transaction_code,

        paymentReference:
          transaction.payment_reference,
      },
    );

    return jsonResponse({
      success: true,

      simulated: true,

      warning:
        "Sandbox payment success was simulated and was not confirmed by Maya.",

      transaction_id:
        transaction.id,

      transaction_code:
        transaction.transaction_code,

      payment_id:
        transaction.payment_reference,

      payment_status:
        confirmation?.payment_status ??
        "paid",

      transaction_status:
        confirmation?.status ??
        "pending",

      dispense_status:
        confirmation?.dispense_status ??
        "not_started",

      already_confirmed:
        confirmation?.already_confirmed ??
        false,

      event:
        "SIMULATED_PAYMENT_SUCCESS",
    });
  } catch (error) {
    console.error(
      "Unexpected payment simulation error:",
      error,
    );

    return jsonResponse(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected payment simulation error",
      },
      500,
    );
  }
});