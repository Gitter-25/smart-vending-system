import { supabase } from "../lib/supabase";

const MACHINE_CODE = "SVM-001";

/*
 * Retrieve the currently logged-in administrator's
 * Supabase access token.
 */
async function getAccessToken() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(
      "Unable to verify simulator session."
    );
  }

  if (!session?.access_token) {
    throw new Error(
      "Admin authentication is required to use the simulator."
    );
  }

  return session.access_token;
}

/*
 * Extract a useful error message from an Edge
 * Function response.
 */
function getFunctionError(
  data,
  error,
  fallbackMessage
) {
  return (
    data?.error ||
    error?.message ||
    fallbackMessage
  );
}

/*
 * --------------------------------------------------
 * STUDENT CARD PAYMENT
 * --------------------------------------------------
 */
export async function simulateCardPurchase({
  cardUid,
  slotCode,
}) {
  if (!cardUid?.trim()) {
    throw new Error("Card UID is required.");
  }

  if (!slotCode?.trim()) {
    throw new Error("Slot code is required.");
  }

  const accessToken = await getAccessToken();

  const { data, error } =
    await supabase.functions.invoke(
      "vending-simulator-card-purchase",
      {
        body: {
          card_uid: cardUid.trim(),
          machine_code: MACHINE_CODE,
          slot_code: slotCode.trim(),
          request_id: crypto.randomUUID(),
        },

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

  if (error) {
    throw new Error(
      getFunctionError(
        data,
        error,
        "Card purchase failed."
      )
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error || "Card purchase failed."
    );
  }

  return data;
}

/*
 * --------------------------------------------------
 * CREATE REAL MAYA SANDBOX QR PAYMENT
 * --------------------------------------------------
 *
 * Attempts to create an actual Maya Dynamic QR
 * through the existing vending-qr-create backend.
 *
 * The browser never receives VENDING_DEVICE_SECRET.
 */
export async function createSimulatorQrPayment({
  slotCode,
}) {
  if (!slotCode?.trim()) {
    throw new Error("Slot code is required.");
  }

  const accessToken = await getAccessToken();

  /*
   * UUID is exactly 36 characters, satisfying
   * Maya's requestReferenceNumber limit.
   */
  const requestId = crypto.randomUUID();

  const { data, error } =
    await supabase.functions.invoke(
      "vending-simulator-qr",
      {
        body: {
          action: "create",
          machine_code: MACHINE_CODE,
          slot_code: slotCode.trim(),
          request_id: requestId,
        },

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

  if (error) {
    throw new Error(
      getFunctionError(
        data,
        error,
        "Unable to create QR payment."
      )
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error ||
        "Unable to create QR payment."
    );
  }

  if (!data?.transaction_id) {
    throw new Error(
      "QR payment did not return a transaction ID."
    );
  }

  if (!data?.payment?.qr_code_body) {
    throw new Error(
      "QR payment did not return QR data."
    );
  }

  return data;
}

/*
 * --------------------------------------------------
 * CREATE SIMULATED SANDBOX QR
 * --------------------------------------------------
 *
 * Presentation/development fallback for situations
 * where the Maya sandbox QR service is unavailable.
 *
 * IMPORTANT:
 * This is NOT a Maya-created QR payment.
 *
 * The backend:
 * - creates the normal QR vending transaction
 * - reserves inventory
 * - creates a synthetic payment reference
 * - records SIMULATED_QR_CREATED
 *
 * The UI must clearly identify this as simulation.
 */
export async function createSimulatedQrPayment({
  slotCode,
}) {
  if (!slotCode?.trim()) {
    throw new Error("Slot code is required.");
  }

  const accessToken = await getAccessToken();

  const requestId = crypto.randomUUID();

  const { data, error } =
    await supabase.functions.invoke(
      "vending-simulator-qr",
      {
        body: {
          action: "create-simulated",
          machine_code: MACHINE_CODE,
          slot_code: slotCode.trim(),
          request_id: requestId,
        },

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

  if (error) {
    throw new Error(
      getFunctionError(
        data,
        error,
        "Unable to create simulated QR payment."
      )
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error ||
        "Unable to create simulated QR payment."
    );
  }

  if (!data?.transaction_id) {
    throw new Error(
      "Simulated QR payment did not return a transaction ID."
    );
  }

  if (!data?.payment?.qr_code_body) {
    throw new Error(
      "Simulated QR payment did not return QR data."
    );
  }

  return data;
}

/*
 * --------------------------------------------------
 * CHECK REAL MAYA QR PAYMENT STATUS
 * --------------------------------------------------
 *
 * The backend retrieves the authoritative payment
 * status directly from Maya.
 *
 * The browser never decides whether a real Maya
 * payment succeeded.
 */
export async function checkSimulatorQrStatus({
  transactionId,
}) {
  if (!transactionId) {
    throw new Error(
      "Transaction ID is required."
    );
  }

  const accessToken = await getAccessToken();

  const { data, error } =
    await supabase.functions.invoke(
      "vending-simulator-qr",
      {
        body: {
          action: "status",
          transaction_id: transactionId,
        },

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

  if (error) {
    throw new Error(
      getFunctionError(
        data,
        error,
        "Unable to check QR payment status."
      )
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error ||
        "Unable to check QR payment status."
    );
  }

  return data;
}

/*
 * --------------------------------------------------
 * SIMULATE QR PAYMENT SUCCESS
 * --------------------------------------------------
 *
 * SANDBOX ONLY.
 *
 * The backend calls vending-qr-simulate-payment,
 * which uses the same atomic payment confirmation
 * RPC as the real payment flow.
 *
 * The audit trail records:
 *
 * SIMULATED_PAYMENT_SUCCESS
 *
 * so the system never claims Maya confirmed the
 * simulated payment.
 */
export async function simulateQrPaymentSuccess({
  transactionId,
}) {
  if (!transactionId) {
    throw new Error(
      "Transaction ID is required."
    );
  }

  const accessToken = await getAccessToken();

  const { data, error } =
    await supabase.functions.invoke(
      "vending-simulator-qr",
      {
        body: {
          action: "simulate-payment",
          transaction_id: transactionId,
        },

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

  if (error) {
    throw new Error(
      getFunctionError(
        data,
        error,
        "Unable to simulate QR payment."
      )
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error ||
        "Unable to simulate QR payment."
    );
  }

  if (data?.simulated !== true) {
    throw new Error(
      "Backend did not identify this payment as simulated."
    );
  }

  return data;
}

/*
 * --------------------------------------------------
 * START DISPENSE
 * --------------------------------------------------
 */
export async function startSimulatorDispense({
  transactionId,
}) {
  if (!transactionId) {
    throw new Error(
      "Transaction ID is required."
    );
  }

  const accessToken = await getAccessToken();

  const { data, error } =
    await supabase.functions.invoke(
      "vending-simulator-dispense",
      {
        body: {
          action: "start",
          transaction_id: transactionId,
          machine_code: MACHINE_CODE,
        },

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

  if (error) {
    throw new Error(
      getFunctionError(
        data,
        error,
        "Unable to start dispensing."
      )
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error ||
        "Unable to start dispensing."
    );
  }

  return data;
}

/*
 * --------------------------------------------------
 * COMPLETE DISPENSE
 * --------------------------------------------------
 *
 * success = true
 * Product physically dispensed.
 *
 * success = false
 * Backend performs the appropriate recovery.
 */
export async function completeSimulatorDispense({
  transactionId,
  success,
  failureReason = null,
}) {
  if (!transactionId) {
    throw new Error(
      "Transaction ID is required."
    );
  }

  if (typeof success !== "boolean") {
    throw new Error(
      "Dispense result is required."
    );
  }

  if (
    success === false &&
    !failureReason?.trim()
  ) {
    throw new Error(
      "Failure reason is required."
    );
  }

  const accessToken = await getAccessToken();

  const { data, error } =
    await supabase.functions.invoke(
      "vending-simulator-dispense",
      {
        body: {
          action: "result",
          transaction_id: transactionId,
          machine_code: MACHINE_CODE,
          dispense_success: success,
          failure_reason:
            success
              ? null
              : failureReason.trim(),
        },

        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

  if (error) {
    throw new Error(
      getFunctionError(
        data,
        error,
        "Unable to complete dispensing."
      )
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error ||
        "Unable to complete dispensing."
    );
  }

  return data;
}

export async function simulateQrRefundSuccess({
  transactionId,
}) {
  if (!transactionId?.trim()) {
    throw new Error(
      "Transaction ID is required."
    );
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session?.access_token) {
    throw new Error(
      "Administrator session is required."
    );
  }

  const { data, error } =
    await supabase.functions.invoke(
      "vending-simulator-qr",
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },

        body: {
          action: "simulate-refund",
          transaction_id:
            transactionId.trim(),
        },
      }
    );

  if (error) {
    throw new Error(
      await getFunctionError(error)
    );
  }

  if (!data?.success) {
    throw new Error(
      data?.error ??
        "Unable to simulate QR refund."
    );
  }

  if (data?.simulated !== true) {
    throw new Error(
      "The refund service did not return a sandbox simulation result."
    );
  }

  return data;
}