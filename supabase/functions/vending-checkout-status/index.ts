import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
);

const VENDING_DEVICE_SECRET = Deno.env.get(
  "VENDING_DEVICE_SECRET",
);

const MAYA_SECRET_API_KEY = Deno.env.get(
  "MAYA_SECRET_API_KEY",
);

const MAYA_ENVIRONMENT =
  Deno.env.get("MAYA_ENVIRONMENT") ?? "sandbox";

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !VENDING_DEVICE_SECRET ||
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
  // Authenticate SmartVend device / simulator
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
    // Get SmartVend transaction
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
        machine_id,
        slot_id,
        amount,
        status,
        payment_method,
        payment_provider,
        payment_reference,
        payment_checkout_id,
        payment_status,
        payment_last_event,
        dispense_status
      `)
      .eq("id", transactionId)
      .single();

    if (transactionError || !transaction) {
      return jsonResponse(
        {
          success: false,
          error: "Transaction not found",
        },
        404,
      );
    }

    if (transaction.payment_method !== "qr") {
      return jsonResponse(
        {
          success: false,
          error:
            "Transaction is not an external payment transaction",
        },
        400,
      );
    }

    if (transaction.payment_provider !== "maya") {
      return jsonResponse(
        {
          success: false,
          error:
            "Transaction payment provider is not Maya",
        },
        400,
      );
    }

    const paymentId =
      transaction.payment_reference;

    if (!paymentId) {
      return jsonResponse(
        {
          success: false,
          error:
            "Transaction does not have a Maya payment ID",
        },
        400,
      );
    }

    // --------------------------------------------------------
    // Ask MAYA directly for the transaction
    // --------------------------------------------------------

    const mayaUrl =
      `${getMayaBaseUrl()}/payments/v1/payments/${encodeURIComponent(
        paymentId,
      )}`;

    const mayaResponse = await fetch(
      mayaUrl,
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

    let mayaData: Record<string, unknown>;

    try {
      mayaData = await mayaResponse.json();
    } catch {
      mayaData = {};
    }

    if (!mayaResponse.ok) {
      console.error(
        "Maya payment retrieval failed:",
        mayaResponse.status,
        mayaData,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Unable to verify payment with Maya",
          provider_status:
            mayaResponse.status,
        },
        502,
      );
    }

    console.log(
      "Maya payment retrieved:",
      paymentId,
      mayaData.status,
    );

    // --------------------------------------------------------
    // Validate provider response
    // --------------------------------------------------------

    const mayaPaymentId =
      typeof mayaData.id === "string"
        ? mayaData.id
        : typeof mayaData.paymentId === "string"
          ? mayaData.paymentId
          : null;

    const mayaStatus =
      typeof mayaData.status === "string"
        ? mayaData.status.toUpperCase()
        : null;

    const mayaRequestReference =
      typeof mayaData.requestReferenceNumber === "string"
        ? mayaData.requestReferenceNumber
        : null;

    const totalAmount =
      mayaData.totalAmount &&
      typeof mayaData.totalAmount === "object"
        ? mayaData.totalAmount as Record<
            string,
            unknown
          >
        : null;

    const mayaAmount =
      totalAmount &&
      typeof totalAmount.value === "number"
        ? totalAmount.value
        : null;

    // Provider ID must match the ID we asked Maya for.
    if (
      mayaPaymentId &&
      mayaPaymentId !== paymentId
    ) {
      console.error(
        "Maya payment ID mismatch",
        paymentId,
        mayaPaymentId,
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

    // If Maya returns the merchant reference,
    // it must match SmartVend's request.
    if (
      mayaRequestReference &&
      transaction.request_id &&
      mayaRequestReference !== transaction.request_id
    ) {
      console.error(
        "Maya request reference mismatch",
        transaction.request_id,
        mayaRequestReference,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Maya payment reference does not match SmartVend transaction",
        },
        409,
      );
    }

    // If Maya returns the amount, verify it too.
    if (
      mayaAmount !== null &&
      Number(transaction.amount) !==
        Number(mayaAmount)
    ) {
      console.error(
        "Maya payment amount mismatch",
        transaction.amount,
        mayaAmount,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Maya payment amount does not match SmartVend transaction",
        },
        409,
      );
    }

    // --------------------------------------------------------
    // Maya has confirmed successful payment
    // --------------------------------------------------------

    if (
      mayaStatus === "PAYMENT_SUCCESS" ||
      mayaStatus === "COMPLETED" ||
      mayaStatus === "PAID"
    ) {
      /*
       * Use our existing backend confirmation RPC.
       *
       * This is important because the Edge Function does not
       * directly invent the PAID state. Maya is the source of
       * payment truth, then our database RPC performs the local
       * state transition.
       */

      const {
      data: confirmationData,
      error: confirmationError,
    } = await supabase.rpc(
      "confirm_qr_vending_payment",
      {
        p_payment_reference: paymentId,
        p_provider_event:
          "checkout_payment_verified",
        p_transaction_id:
          transaction.id,
      },
    );

      if (confirmationError) {
        console.error(
          "SmartVend payment confirmation failed:",
          confirmationError,
        );

        return jsonResponse(
          {
            success: false,
            error:
              confirmationError.message,
            maya_status: mayaStatus,
            provider_verified: true,
          },
          500,
        );
      }

      return jsonResponse({
        success: true,

        provider_verified: true,

        paid: true,

        maya_status: mayaStatus,

        payment_id: paymentId,

        transaction_id:
          transaction.id,

        transaction_code:
          transaction.transaction_code,

        amount:
          Number(transaction.amount),

        confirmation:
          confirmationData,
      });
    }

    // --------------------------------------------------------
    // Maya responded, but payment is not successful yet
    // --------------------------------------------------------

    return jsonResponse({
      success: true,

      provider_verified: true,

      paid: false,

      maya_status:
        mayaStatus ?? "UNKNOWN",

      payment_id:
        paymentId,

      transaction_id:
        transaction.id,

      transaction_code:
        transaction.transaction_code,

      amount:
        Number(transaction.amount),
    });
  } catch (error) {
    console.error(
      "Unexpected Checkout status error:",
      error,
    );

    return jsonResponse(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected payment verification error",
      },
      500,
    );
  }
});