import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mayaSecretKey = Deno.env.get("MAYA_SECRET_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !mayaSecretKey) {
      console.error("Missing required server environment variables.");

      return jsonResponse(
        {
          success: false,
          error: "Server configuration error",
        },
        500,
      );
    }

    const payload = await req.json();

    /*
     * Maya Checkout webhook payloads contain the Maya payment ID.
     * Do not trust the incoming webhook alone to authorize dispensing.
     *
     * We use the payment ID from the callback, then retrieve the
     * transaction directly from Maya using our Secret API Key.
     */
    const paymentId =
      typeof payload?.id === "string"
        ? payload.id
        : typeof payload?.paymentId === "string"
          ? payload.paymentId
          : null;

    if (!paymentId) {
      console.error("Maya webhook missing payment ID.", payload);

      return jsonResponse(
        {
          success: false,
          error: "Missing Maya payment ID",
        },
        400,
      );
    }

    /*
     * Verify the payment directly with Maya.
     *
     * Basic authentication format:
     * base64(MAYA_SECRET_API_KEY + ":")
     */
    const basicAuth = btoa(`${mayaSecretKey}:`);

    const mayaResponse = await fetch(
      `https://pg-sandbox.paymaya.com/payments/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          Accept: "application/json",
        },
      },
    );

    const mayaPayment = await mayaResponse.json();

    if (!mayaResponse.ok) {
      console.error(
        "Unable to verify Maya payment.",
        mayaResponse.status,
        mayaPayment,
      );

      /*
       * Return non-2xx so Maya can retry delivery.
       */
      return jsonResponse(
        {
          success: false,
          error: "Unable to verify payment with Maya",
        },
        502,
      );
    }

    /*
     * We currently only process successful payments.
     *
     * Other Maya events can be added later without allowing them
     * to authorize a vending dispense.
     */
    if (mayaPayment.status !== "PAYMENT_SUCCESS") {
      console.log(
        `Ignoring Maya payment status ${mayaPayment.status} for ${paymentId}.`,
      );

      return jsonResponse({
        success: true,
        processed: false,
        maya_payment_id: paymentId,
        maya_status: mayaPayment.status ?? null,
        message: "Webhook acknowledged; no successful payment to process.",
      });
    }

    /*
     * SmartVend transaction ID was placed in Maya metadata when
     * vending-checkout-create created the Checkout.
     */
    const transactionId = mayaPayment?.metadata?.transactionId;

    if (
      typeof transactionId !== "string" ||
      transactionId.trim().length === 0
    ) {
      console.error(
        "Verified Maya payment is missing SmartVend transaction metadata.",
        paymentId,
      );

      return jsonResponse(
        {
          success: false,
          error: "Missing SmartVend transaction metadata",
        },
        422,
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
     * Load our local transaction before confirming anything.
     */
    const {
    data: transaction,
    error: transactionError,
  } = await supabase
    .from("vending_transactions")
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();

    if (transactionError) {
      console.error(
        "Unable to load SmartVend transaction.",
        transactionError,
      );

      return jsonResponse(
        {
          success: false,
          error: "Unable to load SmartVend transaction",
          database_error: transactionError.message,
          database_code: transactionError.code,
        },
        500,
      );
    }

    if (!transaction) {
      console.error(
        "SmartVend transaction does not exist.",
        transactionId,
      );

      return jsonResponse(
        {
          success: false,
          error: "SmartVend transaction not found",
        },
        404,
      );
    }

    /*
     * Validate that the provider payment belongs to this transaction.
     */
    /*
 * If SmartVend already has a Maya payment reference,
 * it must match the provider-verified Maya payment ID.
 *
 * payment_checkout_id is intentionally NOT checked here because
 * the current Checkout integration stores the Maya hosted checkout
 * URL in that field rather than the final Maya payment ID.
 *
 * For a newly-created transaction payment_reference may still be
 * null. In that case the confirmation RPC will store the verified
 * Maya payment ID.
 */
if (
  transaction.payment_reference &&
  transaction.payment_reference !== paymentId
) {
  console.error(
    "Maya payment ID does not match SmartVend payment reference.",
    {
      transactionId,
      expected: transaction.payment_reference,
      received: paymentId,
    },
  );

  return jsonResponse(
    {
      success: false,
      error: "Payment reference mismatch",
    },
    409,
  );
}

    /*
     * Validate amount and currency using Maya's verified response.
     */
    const localAmount = Number(transaction.amount);
    const mayaAmount = Number(mayaPayment.amount);

    if (
      !Number.isFinite(localAmount) ||
      !Number.isFinite(mayaAmount) ||
      Math.abs(localAmount - mayaAmount) > 0.001
    ) {
      console.error("Maya payment amount mismatch.", {
        transactionId,
        localAmount,
        mayaAmount,
      });

      return jsonResponse(
        {
          success: false,
          error: "Payment amount mismatch",
        },
        409,
      );
    }

    if (mayaPayment.currency !== "PHP") {
      console.error(
        "Unexpected Maya payment currency.",
        mayaPayment.currency,
      );

      return jsonResponse(
        {
          success: false,
          error: "Unexpected payment currency",
        },
        409,
      );
    }

    /*
     * Existing RPC is responsible for the atomic/local transition
     * from pending payment to paid payment.
     *
     * It has already been used by vending-checkout-status.
     * Reusing it means webhook and manual reconciliation follow the
     * same database rules.
     *
     * Repeated webhook deliveries are therefore handled through the
     * same idempotent payment-confirmation path.
     */
    const {
      data: confirmation,
      error: confirmationError,
    } = await supabase.rpc(
      "confirm_qr_vending_payment",
      {
        p_payment_reference: paymentId,
        p_provider_event: "maya_checkout_webhook_payment_success",
        p_transaction_id: transaction.id,
      },
    );

    if (confirmationError) {
      console.error(
        "Unable to confirm SmartVend payment.",
        confirmationError,
      );

      return jsonResponse(
        {
          success: false,
          error: "Unable to confirm SmartVend payment",
        },
        500,
      );
    }

    console.log(
      `Maya PAYMENT_SUCCESS processed for SmartVend transaction ${transaction.id}.`,
    );

    return jsonResponse({
      success: true,
      processed: true,
      maya_payment_id: paymentId,
      maya_status: mayaPayment.status,
      transaction_id: transaction.id,
      transaction_code: transaction.transaction_code,
      payment_confirmation: confirmation,
      message: "Maya payment verified and processed.",
    });
  } catch (error) {
    console.error("Maya Checkout webhook error.", error);

    return jsonResponse(
      {
        success: false,
        error: "Unexpected webhook error",
      },
      500,
    );
  }
});