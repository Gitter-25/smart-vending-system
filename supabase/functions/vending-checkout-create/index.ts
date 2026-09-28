import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
  "SUPABASE_SERVICE_ROLE_KEY",
);

const VENDING_DEVICE_SECRET = Deno.env.get(
  "VENDING_DEVICE_SECRET",
);

const MAYA_PUBLIC_API_KEY = Deno.env.get(
  "MAYA_PUBLIC_API_KEY",
);

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
  // Authenticate vending machine / simulator
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
    machine_code?: string;
    slot_code?: string;
    request_id?: string;
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

  const machineCode = body.machine_code?.trim();
  const slotCode = body.slot_code?.trim();
  const requestId = body.request_id?.trim();

  if (!machineCode) {
    return jsonResponse(
      {
        success: false,
        error: "machine_code is required",
      },
      400,
    );
  }

  if (!slotCode) {
    return jsonResponse(
      {
        success: false,
        error: "slot_code is required",
      },
      400,
    );
  }

  if (!requestId) {
    return jsonResponse(
      {
        success: false,
        error: "request_id is required",
      },
      400,
    );
  }

  // Maya requestReferenceNumber is limited to 36 characters.
  if (requestId.length > 36) {
    return jsonResponse(
      {
        success: false,
        error:
          "request_id must not exceed 36 characters",
      },
      400,
    );
  }

  let transactionId: string | null = null;

  try {
    // --------------------------------------------------------
    // Reserve inventory and create local QR/payment transaction
    // --------------------------------------------------------

    const {
      data: reservationData,
      error: reservationError,
    } = await supabase.rpc(
      "create_qr_vending_purchase",
      {
        p_machine_code: machineCode,
        p_slot_code: slotCode,
        p_request_id: requestId,
        p_payment_provider: "maya",
      },
    );

    if (reservationError) {
      console.error(
        "Checkout reservation failed:",
        reservationError,
      );

      return jsonResponse(
        {
          success: false,
          error: reservationError.message,
        },
        400,
      );
    }

    const reservation = Array.isArray(
      reservationData,
    )
      ? reservationData[0]
      : reservationData;

    if (!reservation) {
      throw new Error(
        "Checkout reservation returned no transaction",
      );
    }

    transactionId = reservation.transaction_id;

    // --------------------------------------------------------
    // Return existing checkout if this request was already used
    // --------------------------------------------------------

    const {
      data: existingTransaction,
      error: existingError,
    } = await supabase
      .from("vending_transactions")
      .select(
        `
          id,
          payment_reference,
          payment_checkout_id,
          payment_status,
          payment_expires_at
        `,
      )
      .eq("id", transactionId)
      .single();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (
      existingTransaction.payment_reference &&
      existingTransaction.payment_checkout_id
    ) {
      return jsonResponse({
        success: true,
        reused: true,

        transaction_id:
          reservation.transaction_id,

        transaction_code:
          reservation.transaction_code,

        product_name:
          reservation.product_name,

        amount:
          Number(reservation.amount),

        machine_code:
          reservation.machine_code,

        slot_code:
          reservation.slot_code,

        request_id:
          reservation.request_id,

        payment: {
          provider: "maya",

          checkout_id:
            existingTransaction.payment_reference,

          redirect_url:
            existingTransaction.payment_checkout_id,

          status:
            existingTransaction.payment_status,

          expires_at:
            existingTransaction.payment_expires_at,
        },
      });
    }

    // --------------------------------------------------------
    // Create Maya Checkout
    // --------------------------------------------------------

    const mayaUrl =
      `${getMayaBaseUrl()}/checkout/v1/checkouts`;

    const amount = Number(reservation.amount);

    const mayaPayload = {
      totalAmount: {
        value: amount,
        currency: "PHP",
      },

      items: [
        {
          name: reservation.product_name,
          quantity: 1,

          code: reservation.slot_code,

          amount: {
            value: amount,
          },

          totalAmount: {
            value: amount,
          },
        },
      ],

      requestReferenceNumber:
        reservation.request_id,

      metadata: {
        transactionId:
          reservation.transaction_id,

        transactionCode:
          reservation.transaction_code,

        machineCode:
          reservation.machine_code,

        slotCode:
          reservation.slot_code,

        productName:
          reservation.product_name,

        source: "SmartVend",
      },
    };

    console.log(
      "Creating Maya Checkout:",
      reservation.request_id,
    );

    const mayaResponse = await fetch(
      mayaUrl,
      {
        method: "POST",

        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",

          Authorization:
            createBasicAuth(
              MAYA_PUBLIC_API_KEY,
            ),
        },

        body: JSON.stringify(mayaPayload),
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
        "Maya Checkout creation failed:",
        mayaResponse.status,
        mayaData,
      );

      // Maya explicitly rejected creation.
      // Release the inventory reservation.
      const { error: cancelError } =
        await supabase.rpc(
          "cancel_qr_vending_purchase",
          {
            p_transaction_id:
              transactionId,

            p_reason:
              `Maya Checkout creation failed (${mayaResponse.status})`,
          },
        );

      if (cancelError) {
        console.error(
          "Checkout reservation rollback failed:",
          cancelError,
        );
      }

      return jsonResponse(
        {
          success: false,
          error:
            "Unable to create Maya Checkout",
          provider_status:
            mayaResponse.status,
          provider_error:
            mayaData,
        },
        502,
      );
    }

    // --------------------------------------------------------
    // Read Maya response
    // --------------------------------------------------------

    const checkoutId =
      typeof mayaData.checkoutId === "string"
        ? mayaData.checkoutId
        : null;

    const redirectUrl =
      typeof mayaData.redirectUrl === "string"
        ? mayaData.redirectUrl
        : null;

    if (!checkoutId || !redirectUrl) {
      console.error(
        "Incomplete Maya Checkout response:",
        mayaData,
      );

      // Do NOT release stock here because Maya returned success.
      // A provider transaction may already exist.
      return jsonResponse(
        {
          success: false,
          error:
            "Maya returned an incomplete Checkout response",
          transaction_id:
            transactionId,
          reconciliation_required: true,
        },
        502,
      );
    }

    // --------------------------------------------------------
    // Save Maya checkout information
    // --------------------------------------------------------

    const {
      data: updatedTransaction,
      error: updateError,
    } = await supabase
      .from("vending_transactions")
      .update({
        payment_reference:
          checkoutId,

        payment_checkout_id:
          redirectUrl,

        payment_last_event:
          "checkout_created",

        payment_last_event_at:
          new Date().toISOString(),
      })
      .eq("id", transactionId)
      .eq("payment_method", "qr")
      .select(
        `
          payment_reference,
          payment_checkout_id,
          payment_status,
          payment_expires_at
        `,
      )
      .single();

    if (updateError) {
      console.error(
        "Failed to save Maya Checkout:",
        updateError,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Checkout was created but local payment data could not be saved",
          transaction_id:
            transactionId,
          reconciliation_required: true,
        },
        500,
      );
    }

    console.log(
      "Maya Checkout created:",
      checkoutId,
    );

    // --------------------------------------------------------
    // Return checkout to SmartVend
    // --------------------------------------------------------

    return jsonResponse({
      success: true,
      reused: false,

      transaction_id:
        reservation.transaction_id,

      transaction_code:
        reservation.transaction_code,

      product_name:
        reservation.product_name,

      amount:
        Number(reservation.amount),

      machine_code:
        reservation.machine_code,

      slot_code:
        reservation.slot_code,

      request_id:
        reservation.request_id,

      payment: {
        provider: "maya",

        checkout_id:
          updatedTransaction.payment_reference,

        redirect_url:
          updatedTransaction.payment_checkout_id,

        status:
          updatedTransaction.payment_status,

        expires_at:
          updatedTransaction.payment_expires_at,
      },
    });
  } catch (error) {
    console.error(
      "Unexpected Maya Checkout error:",
      error,
    );

    // Do not automatically release the reservation here.
    // If a network interruption happened after Maya accepted
    // the checkout, reconciliation is safer than cancellation.

    return jsonResponse(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected Checkout payment error",

        transaction_id:
          transactionId,

        reconciliation_required:
          transactionId !== null,
      },
      500,
    );
  }
});