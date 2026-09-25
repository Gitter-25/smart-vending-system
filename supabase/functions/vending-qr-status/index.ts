import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const VENDING_DEVICE_SECRET =
  Deno.env.get("VENDING_DEVICE_SECRET");

const MAYA_PUBLIC_API_KEY =
  Deno.env.get("MAYA_PUBLIC_API_KEY");

const MAYA_ENVIRONMENT =
  Deno.env.get("MAYA_ENVIRONMENT") ?? "sandbox";

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !VENDING_DEVICE_SECRET ||
  !MAYA_PUBLIC_API_KEY
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

const getMayaBaseUrl = () => {
  if (MAYA_ENVIRONMENT === "sandbox") {
    return "https://pg-sandbox.paymaya.com";
  }

  if (MAYA_ENVIRONMENT === "production") {
    return "https://pg.paymaya.com";
  }

  throw new Error(
    `Unsupported MAYA_ENVIRONMENT: ${MAYA_ENVIRONMENT}`,
  );
};

const createBasicAuth = (apiKey: string) =>
  `Basic ${btoa(`${apiKey}:`)}`;

const toNumber = (
  value: unknown,
): number | null => {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
};

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
  // Authenticate vending client
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
    // Load the SmartVend QR transaction
    // --------------------------------------------------------

    const {
      data: transaction,
      error: transactionError,
    } = await supabase
      .from("vending_transactions")
      .select(`
        id,
        transaction_code,
        request_id,
        amount,
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
          error:
            "Vending transaction not found",
        },
        404,
      );
    }

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
            "Maya payment reference is missing",
        },
        409,
      );
    }

    // --------------------------------------------------------
    // Already confirmed locally
    // --------------------------------------------------------

    if (transaction.payment_status === "paid") {
      return jsonResponse({
        success: true,
        verified: true,
        already_confirmed: true,

        transaction_id:
          transaction.id,

        transaction_code:
          transaction.transaction_code,

        payment_id:
          transaction.payment_reference,

        payment_status:
          transaction.payment_status,

        transaction_status:
          transaction.status,

        dispense_status:
          transaction.dispense_status,
      });
    }

    // --------------------------------------------------------
    // Retrieve authoritative payment from Maya
    // --------------------------------------------------------

    const mayaUrl =
  `${getMayaBaseUrl()}/payments/v1/payments/` +
  `${encodeURIComponent(transaction.payment_reference)}/status`;

    const mayaResponse = await fetch(
      mayaUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",

          Authorization:
           createBasicAuth(
            MAYA_PUBLIC_API_KEY,
            ),
        },
      },
    );

    let mayaBody: unknown;

    try {
      mayaBody = await mayaResponse.json();
    } catch {
      mayaBody = null;
    }

    if (!mayaResponse.ok) {
      console.error(
        "Maya payment lookup failed:",
        mayaResponse.status,
        mayaBody,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Unable to retrieve Maya payment",
          provider_status:
            mayaResponse.status,
        },
        502,
      );
    }

    const mayaPayment =
      Array.isArray(mayaBody)
        ? mayaBody[0]
        : mayaBody;

    if (
      !mayaPayment ||
      typeof mayaPayment !== "object"
    ) {
      console.error(
        "Unexpected Maya payment response:",
        mayaBody,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Unexpected Maya payment response",
        },
        502,
      );
    }

    const verified =
      mayaPayment as Record<string, unknown>;

    const providerPaymentId =
      typeof verified.id === "string"
        ? verified.id
        : "";

    /*
     * Maya response schemas can expose payment state using
     * paymentStatus/status depending on the payment API.
     */
    const providerStatus =
      typeof verified.paymentStatus === "string"
        ? verified.paymentStatus
        : typeof verified.status === "string"
          ? verified.status
          : "";

    const providerIsPaid =
  providerStatus === "PAYMENT_SUCCESS" ||
  providerStatus === "SUCCESS";

    const providerCurrency =
      typeof verified.currency === "string"
        ? verified.currency
        : "";

    const providerAmount =
      toNumber(verified.amount);

    const providerReference =
      typeof verified.requestReferenceNumber ===
        "string"
        ? verified.requestReferenceNumber
        : "";

    // --------------------------------------------------------
    // Verify provider identity/reference
    // --------------------------------------------------------

    if (
      providerPaymentId !==
      transaction.payment_reference
    ) {
      console.error(
        "Maya payment ID mismatch",
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Maya payment verification mismatch",
        },
        409,
      );
    }

    if (
      providerReference &&
      providerReference !==
        transaction.request_id
    ) {
      console.error(
        "Maya request reference mismatch",
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Maya request reference mismatch",
        },
        409,
      );
    }

    // --------------------------------------------------------
    // Verify amount/currency when Maya returns them
    // --------------------------------------------------------

    if (
      providerCurrency &&
      providerCurrency.toUpperCase() !== "PHP"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Maya payment currency mismatch",
        },
        409,
      );
    }

    const expectedAmount =
      Number(transaction.amount);

    if (
      providerAmount !== null &&
      (
        !Number.isFinite(expectedAmount) ||
        Math.round(providerAmount * 100) !==
          Math.round(expectedAmount * 100)
      )
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Maya payment amount mismatch",
        },
        409,
      );
    }

    // --------------------------------------------------------
    // Payment has not been confirmed by Maya yet
    // --------------------------------------------------------

    const isSuccessful =
      providerStatus === "PAYMENT_SUCCESS" ||
      providerStatus === "SUCCESS";

    if (!isSuccessful || !providerIsPaid) {
      return jsonResponse({
        success: true,
        verified: true,
        paid: false,

        transaction_id:
          transaction.id,

        transaction_code:
          transaction.transaction_code,

        payment_id:
          transaction.payment_reference,

        provider_status:
          providerStatus || "UNKNOWN",

        provider_is_paid:
          providerIsPaid,

        payment_status:
          transaction.payment_status,

        transaction_status:
          transaction.status,

        dispense_status:
          transaction.dispense_status,
      });
    }

    // --------------------------------------------------------
    // Maya says PAID.
    // Atomically confirm payment in SmartVend.
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
          providerStatus,
      },
    );

    if (confirmationError) {
      console.error(
        "QR confirmation RPC failed:",
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

    return jsonResponse({
      success: true,
      verified: true,
      paid: true,

      transaction_id:
        transaction.id,

      transaction_code:
        transaction.transaction_code,

      payment_id:
        transaction.payment_reference,

      provider_status:
        providerStatus,

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
    });
  } catch (error) {
    console.error(
      "Unexpected QR status error:",
      error,
    );

    return jsonResponse(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected QR status error",
      },
      500,
    );
  }
});