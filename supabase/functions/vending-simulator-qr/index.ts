import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
     * ------------------------------------------------
     * SERVER CONFIGURATION
     * ------------------------------------------------
     */

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    const deviceSecret =
      Deno.env.get(
        "VENDING_DEVICE_SECRET",
      );

    const mayaEnvironment =
      Deno.env.get("MAYA_ENVIRONMENT") ??
      "sandbox";

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey ||
      !deviceSecret
    ) {
      console.error(
        "Required server environment variables are missing",
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
     * HARD SAFETY BOUNDARY
     *
     * Simulator payment functionality must never
     * operate against the Maya production
     * environment.
     */

    if (mayaEnvironment !== "sandbox") {
      return jsonResponse(
        {
          success: false,
          error:
            "QR simulator is only available in sandbox mode",
        },
        403,
      );
    }

    /*
     * ------------------------------------------------
     * AUTHENTICATE ADMIN
     * ------------------------------------------------
     */

    const authorization =
      req.headers.get("Authorization");

    if (!authorization) {
      return jsonResponse(
        {
          success: false,
          error: "Authentication required",
        },
        401,
      );
    }

    const authClient = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid or expired session",
        },
        401,
      );
    }

    /*
     * Server-only privileged client.
     */

    const adminClient = createClient(
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
     * Verify active SmartVend administrator.
     */

    const {
      data: adminProfile,
      error: adminError,
    } = await adminClient
      .from("admin_profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error(
        "Admin verification failed:",
        adminError.message,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "Unable to verify administrator",
        },
        500,
      );
    }

    if (
      !adminProfile ||
      adminProfile.role !== "admin" ||
      adminProfile.status !== "active"
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "Active administrator access required",
        },
        403,
      );
    }

    /*
     * ------------------------------------------------
     * REQUEST
     * ------------------------------------------------
     */

    const body = await req.json();

    const {
      action,
      machine_code,
      slot_code,
      request_id,
      transaction_id,
    } = body;

    if (!action) {
      return jsonResponse(
        {
          success: false,
          error: "action is required",
        },
        400,
      );
    }

    /*
     * ==================================================
     * CREATE REAL MAYA SANDBOX QR
     * ==================================================
     */

    if (action === "create") {
      if (
        !machine_code ||
        !slot_code ||
        !request_id
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "machine_code, slot_code, and request_id are required",
          },
          400,
        );
      }

      if (
        String(machine_code).trim() !==
        "SVM-001"
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid simulator machine",
          },
          400,
        );
      }

      if (
        String(request_id).trim().length >
        36
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "request_id must not exceed 36 characters",
          },
          400,
        );
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/vending-qr-create`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-device-secret":
              deviceSecret,
          },

          body: JSON.stringify({
            machine_code: "SVM-001",

            slot_code:
              String(slot_code).trim(),

            request_id:
              String(request_id).trim(),
          }),
        },
      );

      let data: Record<string, unknown>;

      try {
        data = await response.json();
      } catch {
        data = {
          success: false,
          error:
            "Invalid response from QR creation service",
        };
      }

      return jsonResponse(
        {
          ...data,
          simulator: true,
        },
        response.status,
      );
    }

    /*
     * ==================================================
     * CREATE SIMULATED SANDBOX QR TRANSACTION
     * ==================================================
     *
     * Used only when the real Maya sandbox QR service
     * cannot provide a QR payment.
     *
     * IMPORTANT:
     * This does not claim that Maya created or
     * confirmed the payment.
     */

    if (action === "create-simulated") {
      if (
        !machine_code ||
        !slot_code ||
        !request_id
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "machine_code, slot_code, and request_id are required",
          },
          400,
        );
      }

      if (
        String(machine_code).trim() !==
        "SVM-001"
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Invalid simulator machine",
          },
          400,
        );
      }

      const normalizedRequestId =
        String(request_id).trim();

      if (
        !normalizedRequestId ||
        normalizedRequestId.length > 36
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "request_id must contain 1 to 36 characters",
          },
          400,
        );
      }

      /*
       * Use the same atomic QR purchase RPC as the
       * real Maya flow.
       *
       * This handles:
       * - machine validation
       * - slot validation
       * - product validation
       * - inventory reservation
       * - request idempotency
       * - transaction creation
       */

      const {
        data: reservationData,
        error: reservationError,
      } = await adminClient.rpc(
        "create_qr_vending_purchase",
        {
          p_machine_code: "SVM-001",

          p_slot_code:
            String(slot_code).trim(),

          p_request_id:
            normalizedRequestId,

          p_payment_provider: "maya",
        },
      );

      if (reservationError) {
        console.error(
          "Simulated QR reservation failed:",
          reservationError.message,
        );

        return jsonResponse(
          {
            success: false,
            error:
              reservationError.message,
          },
          400,
        );
      }

      const reservation =
        Array.isArray(reservationData)
          ? reservationData[0]
          : reservationData;

      if (!reservation?.transaction_id) {
        return jsonResponse(
          {
            success: false,
            error:
              "QR reservation did not return a transaction",
          },
          500,
        );
      }

      /*
       * Generate an unmistakably synthetic payment
       * reference.
       *
       * This is NOT a Maya payment ID.
       */

      const simulatedPaymentReference =
        `SIM-MAYA-${reservation.transaction_id}`;

      /*
       * Attach the synthetic reference required by
       * vending-qr-simulate-payment.
       *
       * We also label the event so the database
       * never implies that Maya created this
       * payment.
       */

      const {
        error: updateError,
      } = await adminClient
        .from("vending_transactions")
        .update({
          payment_reference:
            simulatedPaymentReference,

          payment_checkout_id:
            simulatedPaymentReference,

          payment_last_event:
            "SIMULATED_QR_CREATED",

          payment_last_event_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          reservation.transaction_id,
        )
        .eq("payment_status", "pending")
        .eq("status", "pending");

      if (updateError) {
        console.error(
          "Unable to prepare simulated QR transaction:",
          updateError.message,
        );

        /*
         * Undo the reservation rather than leaving
         * inventory locked if preparation fails.
         */

        const {
          error: cancelError,
        } = await adminClient.rpc(
          "cancel_qr_vending_purchase",
          {
            p_transaction_id:
              reservation.transaction_id,

            p_failure_reason:
              "Unable to prepare simulated sandbox QR",
          },
        );

        if (cancelError) {
          console.error(
            "Unable to cancel failed simulated QR reservation:",
            cancelError.message,
          );
        }

        return jsonResponse(
          {
            success: false,
            error:
              "Unable to prepare simulated QR transaction",
          },
          500,
        );
      }

      /*
       * This payload is deliberately NOT a real
       * QRPh payload.
       *
       * qrcode.react will render this development
       * marker as a QR code for presentation.
       */

      const simulatedQrData =
        JSON.stringify({
          type:
            "SMARTVEND_SANDBOX_SIMULATION",

          transaction_id:
            reservation.transaction_id,

          transaction_code:
            reservation.transaction_code,

          machine_code:
            reservation.machine_code,

          slot_code:
            reservation.slot_code,

          amount:
            Number(reservation.amount),

          payment_reference:
            simulatedPaymentReference,
        });

      console.warn(
        "SIMULATED SANDBOX QR CREATED:",
        {
          transactionId:
            reservation.transaction_id,

          transactionCode:
            reservation.transaction_code,

          paymentReference:
            simulatedPaymentReference,
        },
      );

      return jsonResponse(
        {
          success: true,

          simulator: true,

          simulated: true,

          payment_confirmation_source:
            "sandbox_simulation",

          warning:
            "This QR is a SmartVend sandbox simulation and was not created by Maya.",

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

          payment: {
            provider: "maya",

            payment_id:
              simulatedPaymentReference,

            payment_status: "pending",

            qr_code_body:
              simulatedQrData,

            simulated: true,

            expires_at:
              new Date(
                Date.now() +
                  60 * 60 * 1000,
              ).toISOString(),
          },
        },
        200,
      );
    }

    /*
     * ==================================================
     * REAL MAYA STATUS
     * ==================================================
     */

    if (action === "status") {
      if (!transaction_id) {
        return jsonResponse(
          {
            success: false,
            error:
              "transaction_id is required",
          },
          400,
        );
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/vending-qr-status`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-device-secret":
              deviceSecret,
          },

          body: JSON.stringify({
            transaction_id:
              String(
                transaction_id,
              ).trim(),
          }),
        },
      );

      let data: Record<string, unknown>;

      try {
        data = await response.json();
      } catch {
        data = {
          success: false,
          error:
            "Invalid response from QR status service",
        };
      }

      return jsonResponse(
        {
          ...data,
          simulator: true,
        },
        response.status,
      );
    }

    /*
     * ==================================================
     * SIMULATE PAYMENT SUCCESS
     * ==================================================
     */

    if (action === "simulate-payment") {
      if (!transaction_id) {
        return jsonResponse(
          {
            success: false,
            error:
              "transaction_id is required",
          },
          400,
        );
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/vending-qr-simulate-payment`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-device-secret":
              deviceSecret,
          },

          body: JSON.stringify({
            transaction_id:
              String(
                transaction_id,
              ).trim(),
          }),
        },
      );

      let data: Record<string, unknown>;

      try {
        data = await response.json();
      } catch {
        data = {
          success: false,
          error:
            "Invalid response from sandbox payment simulator",
        };
      }

      return jsonResponse(
        {
          ...data,

          simulator: true,

          payment_confirmation_source:
            "sandbox_simulation",
        },
        response.status,
      );
    }
    /*
 * ==================================================
 * SIMULATE QR REFUND SUCCESS
 * ==================================================
 *
 * Admin-only sandbox proxy.
 *
 * The browser never receives VENDING_DEVICE_SECRET.
 * This server-side function forwards the transaction
 * to the protected refund simulator.
 */

if (action === "simulate-refund") {
  if (!transaction_id) {
    return jsonResponse(
      {
        success: false,
        error: "transaction_id is required",
      },
      400,
    );
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/vending-qr-simulate-refund`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        "x-device-secret":
          deviceSecret,
      },

      body: JSON.stringify({
        transaction_id:
          String(
            transaction_id,
          ).trim(),
      }),
    },
  );

  let data: Record<string, unknown>;

  try {
    data = await response.json();
  } catch {
    data = {
      success: false,
      error:
        "Invalid response from sandbox refund simulator",
    };
  }

  return jsonResponse(
    {
      ...data,

      simulator: true,

      refund_confirmation_source:
        "sandbox_simulation",
    },
    response.status,
  );
}

    return jsonResponse(
      {
        success: false,
        error: "Invalid simulator action",
      },
      400,
    );
  } catch (error) {
    console.error(
      "Vending QR simulator error:",
      error,
    );

    return jsonResponse(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unexpected simulator error",
      },
      500,
    );
  }
});