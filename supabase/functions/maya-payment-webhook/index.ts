import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL");

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const MAYA_SECRET_API_KEY =
  Deno.env.get("MAYA_SECRET_API_KEY");

const MAYA_ENVIRONMENT =
  Deno.env.get("MAYA_ENVIRONMENT") ?? "sandbox";

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !MAYA_SECRET_API_KEY
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

    if (Number.isFinite(parsed)) {
      return parsed;
    }
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

  /*
   * Do not trust the webhook payload as proof of payment.
   *
   * We only use it to identify the Maya payment. The payment
   * is then retrieved directly from Maya using our Secret API
   * Key before SmartVend changes its local payment state.
   */

  let webhook: Record<string, unknown>;

  try {
    webhook = await req.json();
  } catch {
    return jsonResponse(
      {
        success: false,
        error: "Invalid JSON body",
      },
      400,
    );
  }

  const paymentId =
    typeof webhook.id === "string"
      ? webhook.id.trim()
      : "";

  if (!paymentId) {
    return jsonResponse(
      {
        success: false,
        error: "Maya payment id is required",
      },
      400,
    );
  }

  try {
    /*
     * Retrieve the authoritative payment directly from Maya.
     */
    const mayaResponse = await fetch(
      `${getMayaBaseUrl()}/payments/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization:
            createBasicAuth(
              MAYA_SECRET_API_KEY,
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
        "Maya payment verification failed:",
        mayaResponse.status,
        mayaBody,
      );

      /*
       * Return non-2xx so Maya can retry delivery.
       */
      return jsonResponse(
        {
          success: false,
          error:
            "Unable to verify payment with Maya",
        },
        502,
      );
    }

    /*
     * Maya documents Retrieve Payment via ID as returning
     * payment information. Handle either an object or an array
     * defensively.
     */
    const mayaPayment =
      Array.isArray(mayaBody)
        ? mayaBody[0]
        : mayaBody;

    if (
      !mayaPayment ||
      typeof mayaPayment !== "object"
    ) {
      console.error(
        "Unexpected Maya verification response:",
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

    const verifiedPaymentId =
      typeof verified.id === "string"
        ? verified.id
        : "";

    const verifiedStatus =
      typeof verified.status === "string"
        ? verified.status
        : "";

    const verifiedIsPaid =
      verified.isPaid === true;

    const verifiedCurrency =
      typeof verified.currency === "string"
        ? verified.currency
        : "";

    const verifiedAmount =
      toNumber(verified.amount);

    const verifiedRequestReference =
      typeof verified.requestReferenceNumber ===
        "string"
        ? verified.requestReferenceNumber
        : "";

    /*
     * The payment retrieved using the Secret API Key must
     * identify the exact same Maya payment.
     */
    if (verifiedPaymentId !== paymentId) {
      console.error(
        "Maya payment ID verification mismatch",
      );

      return jsonResponse(
        {
          success: false,
          error: "Payment verification mismatch",
        },
        409,
      );
    }

    /*
     * Ignore non-success events after verification.
     *
     * They will get their own failure/expiration handling
     * flow later. Most importantly, they cannot authorize
     * dispensing.
     */
    if (
      verifiedStatus !== "PAYMENT_SUCCESS" ||
      !verifiedIsPaid
    ) {
      return jsonResponse({
        success: true,
        processed: false,
        payment_id: paymentId,
        payment_status: verifiedStatus,
      });
    }

    if (
      verifiedCurrency.toUpperCase() !== "PHP"
    ) {
      console.error(
        "Unexpected Maya payment currency:",
        verifiedCurrency,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Payment currency verification failed",
        },
        409,
      );
    }

    if (
      verifiedAmount === null ||
      !verifiedRequestReference
    ) {
      console.error(
        "Incomplete verified Maya payment:",
        verified,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Incomplete Maya payment information",
        },
        409,
      );
    }

    /*
     * Locate SmartVend's transaction using BOTH:
     *
     * 1. Maya payment ID
     * 2. SmartVend requestReferenceNumber
     *
     * This prevents an unrelated Maya payment from being
     * attached to a vending transaction.
     */
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
      .eq(
        "payment_reference",
        verifiedPaymentId,
      )
      .eq(
        "request_id",
        verifiedRequestReference,
      )
      .eq("payment_method", "qr")
      .eq("payment_provider", "maya")
      .maybeSingle();

    if (transactionError) {
      console.error(
        "Transaction lookup failed:",
        transactionError,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Unable to locate vending transaction",
        },
        500,
      );
    }

    if (!transaction) {
      console.error(
        "No matching SmartVend transaction:",
        {
          paymentId: verifiedPaymentId,
          requestReferenceNumber:
            verifiedRequestReference,
        },
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Matching vending transaction not found",
        },
        404,
      );
    }

    /*
     * Verify the amount exactly to two decimal places.
     */
    const expectedAmount =
      Number(transaction.amount);

    if (
      !Number.isFinite(expectedAmount) ||
      Math.round(expectedAmount * 100) !==
        Math.round(verifiedAmount * 100)
    ) {
      console.error(
        "Maya payment amount mismatch:",
        {
          expected: expectedAmount,
          received: verifiedAmount,
        },
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Payment amount verification failed",
        },
        409,
      );
    }

    /*
     * All provider-side verification has passed.
     *
     * PostgreSQL performs the actual state transition
     * atomically and idempotently.
     */
    const {
      data: confirmationData,
      error: confirmationError,
    } = await supabase.rpc(
      "confirm_qr_vending_payment",
      {
        p_transaction_id: transaction.id,
        p_payment_reference:
          verifiedPaymentId,
        p_provider_event:
          verifiedStatus,
      },
    );

    if (confirmationError) {
      console.error(
        "QR payment confirmation failed:",
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

    console.log(
      "Maya QR payment verified:",
      {
        transactionId: transaction.id,
        paymentId: verifiedPaymentId,
        requestReferenceNumber:
          verifiedRequestReference,
      },
    );

    return jsonResponse({
      success: true,
      processed: true,
      transaction_id:
        transaction.id,
      transaction_code:
        transaction.transaction_code,
      payment_id:
        verifiedPaymentId,
      payment_status:
        confirmation?.payment_status ??
        "paid",
      dispense_status:
        confirmation?.dispense_status ??
        "not_started",
      already_confirmed:
        confirmation?.already_confirmed ??
        false,
    });
  } catch (error) {
    console.error(
      "Unexpected Maya webhook error:",
      error,
    );

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected webhook error",
      },
      500,
    );
  }
});