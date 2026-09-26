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
    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY");

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Server configuration error",
        },
        500,
      );
    }

    /*
     * Verify the logged-in administrator.
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
          error: "Unable to verify administrator",
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
     * Request body.
     *
     * action:
     * - start
     * - result
     */
    const body = await req.json();

    const {
      action,
      transaction_id,
      machine_code,
      dispense_success,
      failure_reason,
    } = body;

    if (
      !action ||
      !transaction_id ||
      !machine_code
    ) {
      return jsonResponse(
        {
          success: false,
          error:
            "action, transaction_id, and machine_code are required",
        },
        400,
      );
    }

    /*
     * Simulator is restricted to SVM-001.
     */
    if (
      String(machine_code).trim() !== "SVM-001"
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Invalid simulator machine",
        },
        400,
      );
    }

    /*
     * START DISPENSE
     *
     * Uses the exact same RPC as
     * vending-dispense-start.
     */
    if (action === "start") {
      const { data, error } =
        await adminClient.rpc(
          "start_vending_dispense",
          {
            p_transaction_id:
              String(transaction_id).trim(),

            p_machine_code: "SVM-001",
          },
        );

      if (error) {
        console.error(
          "Simulator start dispense failed:",
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

      const dispense = data?.[0];

      if (!dispense) {
        return jsonResponse(
          {
            success: false,
            error:
              "Dispense instruction was not returned",
          },
          500,
        );
      }

      return jsonResponse(
        {
          success: true,
          simulator: true,
          action: "start",
          dispense,
        },
        200,
      );
    }

    /*
     * DISPENSE RESULT
     *
     * Uses the exact same RPC as
     * vending-dispense-result.
     */
    if (action === "result") {
      if (
        typeof dispense_success !== "boolean"
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "dispense_success is required for result",
          },
          400,
        );
      }

      if (
        dispense_success === false &&
        (
          !failure_reason ||
          String(failure_reason).trim() === ""
        )
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "failure_reason is required when dispensing fails",
          },
          400,
        );
      }

      const { data, error } =
        await adminClient.rpc(
          "complete_vending_dispense",
          {
            p_transaction_id:
              String(transaction_id).trim(),

            p_machine_code: "SVM-001",

            p_dispense_success:
              dispense_success,

            p_failure_reason:
              failure_reason
                ? String(failure_reason).trim()
                : null,
          },
        );

      if (error) {
        console.error(
          "Simulator dispense result failed:",
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

      const result = data?.[0];

      if (!result) {
        return jsonResponse(
          {
            success: false,
            error:
              "Dispense result was not returned",
          },
          500,
        );
      }

      return jsonResponse(
        {
          success: true,
          simulator: true,
          action: "result",
          transaction: result,
        },
        200,
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
      "Vending simulator dispense error:",
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