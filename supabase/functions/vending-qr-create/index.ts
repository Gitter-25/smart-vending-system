import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const VENDING_DEVICE_SECRET =
  Deno.env.get("VENDING_DEVICE_SECRET");

const MAYA_PUBLIC_API_KEY =
  Deno.env.get("MAYA_PUBLIC_API_KEY");

const MAYA_ENVIRONMENT =
  Deno.env.get("MAYA_ENVIRONMENT") ?? "sandbox";
  const MAYA_PF_SUB_MERCHANT_ID =
  Deno.env.get("MAYA_PF_SUB_MERCHANT_ID");

const MAYA_PF_SUB_MERCHANT_NAME =
  Deno.env.get("MAYA_PF_SUB_MERCHANT_NAME");

const MAYA_PF_CITY =
  Deno.env.get("MAYA_PF_CITY");

const MAYA_PF_CURRENCY_CODE =
  Deno.env.get("MAYA_PF_CURRENCY_CODE") ?? "608";

const MAYA_PF_COUNTRY_CODE =
  Deno.env.get("MAYA_PF_COUNTRY_CODE") ?? "PHL";

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !VENDING_DEVICE_SECRET ||
  !MAYA_PUBLIC_API_KEY ||
  !MAYA_PF_SUB_MERCHANT_ID ||
  !MAYA_PF_SUB_MERCHANT_NAME ||
  !MAYA_PF_CITY
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

const createBasicAuth = (apiKey: string) => {
  return `Basic ${btoa(`${apiKey}:`)}`;
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
  // Authenticate vending device
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

  const machineCode =
    body.machine_code?.trim();

  const slotCode =
    body.slot_code?.trim();

  const requestId =
    body.request_id?.trim();

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

  // Maya requestReferenceNumber max length = 36.
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
    // Reserve vending inventory and create local transaction.
    // This RPC is idempotent by request_id.
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
        "QR reservation failed:",
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

    const reservation =
      Array.isArray(reservationData)
        ? reservationData[0]
        : reservationData;

    if (!reservation) {
      throw new Error(
        "QR reservation returned no transaction",
      );
    }

    transactionId = reservation.transaction_id;

    // --------------------------------------------------------
    // Check whether Maya information already exists.
    //
    // This allows a normal client retry to return the
    // previously generated QR instead of creating another one.
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
          payment_qr_data,
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
      existingTransaction.payment_qr_data
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

          payment_id:
            existingTransaction.payment_reference,

          redirect_url:
            existingTransaction.payment_checkout_id,

          qr_code_body:
            existingTransaction.payment_qr_data,

          status:
            existingTransaction.payment_status,

          expires_at:
            existingTransaction.payment_expires_at,
        },
      });
    }

    // --------------------------------------------------------
    // Create Maya Dynamic QR
    // --------------------------------------------------------

    const mayaUrl =
      `${getMayaBaseUrl()}/payments/v1/qr/payments`;

    const mayaPayload = {
      totalAmount: {
        value: Number(reservation.amount),
        currency: "PHP",
      },

      requestReferenceNumber:
        reservation.request_id,

      metadata: {
  subMerchantRequestReferenceNumber:
    reservation.request_id,

  pf: {
    smi: MAYA_PF_SUB_MERCHANT_ID,
    smn: MAYA_PF_SUB_MERCHANT_NAME,
    mci: MAYA_PF_CITY,
    mpc: MAYA_PF_CURRENCY_CODE,
    mco: MAYA_PF_COUNTRY_CODE,
  },

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
},
    };

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
        "Maya Dynamic QR creation failed:",
        mayaResponse.status,
        mayaData,
      );

      // ------------------------------------------------------
      // Maya explicitly rejected the request.
      //
      // Since no usable QR was created, release our reserved
      // inventory.
      // ------------------------------------------------------

      const { error: cancelError } =
        await supabase.rpc(
          "cancel_qr_vending_purchase",
          {
            p_transaction_id:
              transactionId,

            p_reason:
              `Maya QR creation failed (${mayaResponse.status})`,
          },
        );

      if (cancelError) {
        console.error(
          "QR reservation rollback failed:",
          cancelError,
        );
      }

      return jsonResponse(
        {
          success: false,
          error:
            "Unable to create Maya QR payment",
          provider_status:
            mayaResponse.status,
        },
        502,
      );
    }

    const paymentId =
      typeof mayaData.paymentId === "string"
        ? mayaData.paymentId
        : null;

    const redirectUrl =
      typeof mayaData.redirectUrl === "string"
        ? mayaData.redirectUrl
        : null;

    const qrCodeBody =
      typeof mayaData.qrCodeBody === "string"
        ? mayaData.qrCodeBody
        : null;

    if (!paymentId || !qrCodeBody) {
      console.error(
        "Incomplete Maya QR response:",
        mayaData,
      );

      // Do not automatically release stock here.
      //
      // Maya returned HTTP success, so a provider-side
      // transaction may already exist. We preserve the local
      // transaction for reconciliation instead of risking
      // duplicate/incorrect payment state.
      return jsonResponse(
        {
          success: false,
          error:
            "Maya returned an incomplete QR response",
          transaction_id:
            transactionId,
          reconciliation_required: true,
        },
        502,
      );
    }

    // --------------------------------------------------------
    // Save Maya transaction information
    // --------------------------------------------------------

    const {
      data: updatedTransaction,
      error: updateError,
    } = await supabase
      .from("vending_transactions")
      .update({
        payment_reference:
          paymentId,

        payment_checkout_id:
          redirectUrl,

        payment_qr_data:
          qrCodeBody,

        payment_last_event:
          "qr_created",

        payment_last_event_at:
          new Date().toISOString(),
      })
      .eq("id", transactionId)
      .eq("payment_method", "qr")
      .select(
        `
          payment_reference,
          payment_checkout_id,
          payment_qr_data,
          payment_status,
          payment_expires_at
        `,
      )
      .single();

    if (updateError) {
      console.error(
        "Failed to save Maya QR information:",
        updateError,
      );

      // Maya QR already exists at this point.
      // Do NOT release inventory.
      return jsonResponse(
        {
          success: false,
          error:
            "QR was created but local payment data could not be saved",
          transaction_id:
            transactionId,
          reconciliation_required: true,
        },
        500,
      );
    }

    // --------------------------------------------------------
    // Return QR data to vending client
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

        payment_id:
          updatedTransaction.payment_reference,

        redirect_url:
          updatedTransaction.payment_checkout_id,

        qr_code_body:
          updatedTransaction.payment_qr_data,

        status:
          updatedTransaction.payment_status,

        expires_at:
          updatedTransaction.payment_expires_at,
      },
    });
  } catch (error) {
    console.error(
      "Unexpected vending QR error:",
      error,
    );

    /*
     * IMPORTANT:
     *
     * We intentionally do NOT automatically call
     * cancel_qr_vending_purchase() here.
     *
     * If the network failed after Maya accepted the request,
     * cancelling our local reservation could create an
     * inconsistent state.
     *
     * Later, the reconciliation endpoint will retrieve the
     * Maya transaction using requestReferenceNumber before
     * deciding whether inventory can safely be released.
     */

    return jsonResponse(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected QR payment error",

        transaction_id:
          transactionId,

        reconciliation_required:
          transactionId !== null,
      },
      500,
    );
  }
});