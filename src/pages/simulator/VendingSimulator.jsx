import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Package,
  Play,
  QrCode,
  RefreshCw,
  RotateCcw,
  Wifi,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import {
  checkSimulatorQrStatus,
  completeSimulatorDispense,
  createSimulatedQrPayment,
  createSimulatorQrPayment,
  simulateCardPurchase,
  simulateQrPaymentSuccess,
   simulateQrRefundSuccess,
  startSimulatorDispense,
} from "../../services/vendingSimulator";

export default function VendingSimulator() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] =
    useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedProduct, setSelectedProduct] =
    useState(null);

  /*
   * Student card states
   */
  const [cardUid, setCardUid] = useState("");
  const [showCardInput, setShowCardInput] =
    useState(false);

  const [processingPayment, setProcessingPayment] =
    useState(false);

  const [paymentError, setPaymentError] =
    useState("");

  /*
   * QR payment states
   */
  const [creatingQr, setCreatingQr] =
    useState(false);

  const [creatingSimulatedQr, setCreatingSimulatedQr] =
    useState(false);

  const [qrPayment, setQrPayment] =
    useState(null);

  const [checkingQr, setCheckingQr] =
    useState(false);

  const [simulatingQrPayment, setSimulatingQrPayment] =
    useState(false);

  const [qrError, setQrError] =
    useState("");

  const [qrStatusMessage, setQrStatusMessage] =
    useState("");

  /*
   * Common successful payment.
   *
   * Student-card and QR payments both eventually
   * populate this state so they can use the same
   * dispense lifecycle.
   */
  const [purchaseResult, setPurchaseResult] =
    useState(null);

  const [paymentMethod, setPaymentMethod] =
    useState(null);

  /*
   * Dispense states
   */
  const [startingDispense, setStartingDispense] =
    useState(false);

  const [
    dispenseInstruction,
    setDispenseInstruction,
  ] = useState(null);

  const [
    completingDispense,
    setCompletingDispense,
  ] = useState(false);

  const [dispenseResult, setDispenseResult] =
    useState(null);

  const [dispenseError, setDispenseError] =
    useState("");
    const [processingQrRefund, setProcessingQrRefund] =
  useState(false);

const [qrRefundResult, setQrRefundResult] =
  useState(null);

const [qrRefundError, setQrRefundError] =
  useState("");


  const loadProducts = async () => {
    setLoadingProducts(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("vending_slots")
      .select(`
        id,
        slot_code,
        motor_number,
        quantity,
        capacity,
        status,
        product_id,
        products (
          id,
          name,
          price,
          status
        )
      `)
      .order("motor_number", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Unable to load vending machine:",
        error
      );

      setLoadError(
        "Unable to load vending machine inventory."
      );

      setProducts([]);
      setLoadingProducts(false);
      return;
    }

    const formattedProducts = (data ?? []).map(
      (slot) => ({
        id: slot.id,
        productId: slot.product_id,
        slot: slot.slot_code,
        motorNumber: slot.motor_number,
        name:
          slot.products?.name ?? "Empty Slot",
        price: Number(
          slot.products?.price ?? 0
        ),
        stock: slot.quantity,
        capacity: slot.capacity,
        slotStatus: slot.status,
        productStatus:
          slot.products?.status ?? null,
      })
    );

    setProducts(formattedProducts);
    setLoadingProducts(false);
  };
  useEffect(() => {
  let cancelled = false;

  const loadInitialProducts = async () => {
    const { data, error } = await supabase
      .from("vending_slots")
      .select(`
        id,
        slot_code,
        motor_number,
        quantity,
        capacity,
        status,
        product_id,
        products (
          id,
          name,
          price,
          status
        )
      `)
      .order("motor_number", {
        ascending: true,
      });

    if (cancelled) {
      return;
    }

    if (error) {
      console.error(
        "Unable to load vending machine:",
        error
      );

      setLoadError(
        "Unable to load vending machine inventory."
      );
      setProducts([]);
      setLoadingProducts(false);
      return;
    }

    const formattedProducts = (data ?? []).map(
      (slot) => ({
        id: slot.id,
        productId: slot.product_id,
        slot: slot.slot_code,
        motorNumber: slot.motor_number,
        name:
          slot.products?.name ?? "Empty Slot",
        price: Number(
          slot.products?.price ?? 0
        ),
        stock: slot.quantity,
        capacity: slot.capacity,
        slotStatus: slot.status,
        productStatus:
          slot.products?.status ?? null,
      })
    );

    setProducts(formattedProducts);
    setLoadingProducts(false);
  };

  loadInitialProducts();

  return () => {
    cancelled = true;
  };
}, []);

  const clearPaymentState = () => {
    setCardUid("");
    setShowCardInput(false);
    setProcessingPayment(false);
    setPaymentError("");

    setCreatingQr(false);
    setCreatingSimulatedQr(false);
    setQrPayment(null);
    setCheckingQr(false);
    setSimulatingQrPayment(false);
    setQrError("");
    setQrStatusMessage("");

    setPurchaseResult(null);
    setPaymentMethod(null);

    setStartingDispense(false);
    setDispenseInstruction(null);
    setCompletingDispense(false);
    setDispenseResult(null);
    setDispenseError("");
    setProcessingQrRefund(false);
    setQrRefundResult(null);
    setQrRefundError("");
  };

  const selectProduct = (product) => {
    if (
      processingPayment ||
      creatingQr ||
      creatingSimulatedQr ||
      checkingQr ||
      simulatingQrPayment ||
      startingDispense ||
      completingDispense ||
      purchaseResult ||
      qrPayment
    ) {
      return;
    }

    setSelectedProduct(product);
    clearPaymentState();
  };

  /*
   * ------------------------------------------------
   * STUDENT CARD
   * ------------------------------------------------
   */
  const handleCardPurchase = async () => {
    if (!selectedProduct || !cardUid.trim()) {
      return;
    }

    setProcessingPayment(true);
    setPaymentError("");
    setQrError("");
    setPurchaseResult(null);

    try {
      const result = await simulateCardPurchase({
        cardUid,
        slotCode: selectedProduct.slot,
      });

      setPurchaseResult(result.transaction);
      setPaymentMethod("card");

      setShowCardInput(false);
      setCardUid("");

      /*
       * Student wallet purchase reserves one item.
       */
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === selectedProduct.id
            ? {
                ...product,
                stock: Math.max(
                  product.stock - 1,
                  0
                ),
              }
            : product
        )
      );
    } catch (error) {
      console.error(
        "Student card purchase failed:",
        error
      );

      setPaymentError(
        error instanceof Error
          ? error.message
          : "Student card purchase failed."
      );
    } finally {
      setProcessingPayment(false);
    }
  };

  /*
   * ------------------------------------------------
   * REAL MAYA QR
   * ------------------------------------------------
   */
  const handleCreateQr = async () => {
    if (!selectedProduct) {
      return;
    }

    setCreatingQr(true);
    setQrError("");
    setQrStatusMessage("");
    setPaymentError("");

    try {
      const result =
        await createSimulatorQrPayment({
          slotCode: selectedProduct.slot,
        });

      setQrPayment(result);
      setPaymentMethod("qr");

      /*
       * Successful QR creation means the backend
       * reservation remains active.
       */
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === selectedProduct.id
            ? {
                ...product,
                stock: Math.max(
                  product.stock - 1,
                  0
                ),
              }
            : product
        )
      );

      setQrStatusMessage(
        "Waiting for Maya payment confirmation."
      );
    } catch (error) {
      console.error(
        "Unable to create QR payment:",
        error
      );

      setQrError(
        error instanceof Error
          ? error.message
          : "Unable to create QR payment."
      );

      /*
       * Real Maya creation failure may cause the
       * backend to cancel the local reservation.
       * Reload authoritative inventory.
       */
      await loadProducts();
    } finally {
      setCreatingQr(false);
    }
  };

  /*
   * ------------------------------------------------
   * SIMULATED SANDBOX QR
   * ------------------------------------------------
   *
   * Used only as a development/presentation
   * fallback when the Maya sandbox QR service
   * cannot create a real QR.
   */
  const handleCreateSimulatedQr = async () => {
    if (!selectedProduct) {
      return;
    }

    setCreatingSimulatedQr(true);
    setQrError("");
    setQrStatusMessage("");
    setPaymentError("");

    try {
      const result =
        await createSimulatedQrPayment({
          slotCode: selectedProduct.slot,
        });

      setQrPayment(result);
      setPaymentMethod("qr");

      /*
       * The backend reserved one item using the
       * normal QR reservation RPC.
       */
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === selectedProduct.id
            ? {
                ...product,
                stock: Math.max(
                  product.stock - 1,
                  0
                ),
              }
            : product
        )
      );

      setQrStatusMessage(
        "Sandbox QR created. Payment has not been confirmed."
      );
    } catch (error) {
      console.error(
        "Unable to create simulated QR:",
        error
      );

      setQrError(
        error instanceof Error
          ? error.message
          : "Unable to create simulated QR payment."
      );

      await loadProducts();
    } finally {
      setCreatingSimulatedQr(false);
    }
  };

  /*
   * ------------------------------------------------
   * CHECK REAL MAYA PAYMENT
   * ------------------------------------------------
   */
  const handleCheckQrStatus = async () => {
    const transactionId =
      qrPayment?.transaction_id;

    if (!transactionId) {
      setQrError(
        "QR transaction ID is missing."
      );
      return;
    }

    if (qrPayment?.simulated === true) {
      setQrError(
        "Maya status checks are not used for simulated sandbox QR payments."
      );
      return;
    }

    setCheckingQr(true);
    setQrError("");
    setQrStatusMessage("");

    try {
      const result =
        await checkSimulatorQrStatus({
          transactionId,
        });

      const paid =
        result.paid === true ||
        result.payment_status === "paid";

      if (paid) {
        /*
         * Convert the QR result into the common
         * payment state used by dispensing.
         */
        setPurchaseResult({
          id: result.transaction_id,
          transaction_id:
            result.transaction_id,
          transaction_code:
            result.transaction_code,
          payment_status:
            result.payment_status,
          dispense_status:
            result.dispense_status,
          simulated: false,
        });

        setQrStatusMessage(
          "Maya payment verified. Ready to dispense."
        );

        return;
      }

      setQrStatusMessage(
        `Payment not completed yet. Maya status: ${
          result.provider_status ??
          result.payment_status ??
          "pending"
        }`
      );
    } catch (error) {
      console.error(
        "Unable to check QR status:",
        error
      );

      setQrError(
        error instanceof Error
          ? error.message
          : "Unable to check QR payment status."
      );
    } finally {
      setCheckingQr(false);
    }
  };

  /*
   * ------------------------------------------------
   * SIMULATE QR PAYMENT SUCCESS
   * ------------------------------------------------
   */
  const handleSimulateQrPayment = async () => {
    const transactionId =
      qrPayment?.transaction_id;

    if (!transactionId) {
      setQrError(
        "QR transaction ID is missing."
      );
      return;
    }

    if (qrPayment?.simulated !== true) {
      setQrError(
        "Payment simulation is only available for a simulated sandbox QR."
      );
      return;
    }

    setSimulatingQrPayment(true);
    setQrError("");
    setQrStatusMessage("");

    try {
      const result =
        await simulateQrPaymentSuccess({
          transactionId,
        });

      setPurchaseResult({
        id: result.transaction_id,
        transaction_id:
          result.transaction_id,
        transaction_code:
          result.transaction_code,
        payment_status:
          result.payment_status,
        dispense_status:
          result.dispense_status,
        simulated: true,
      });

      setQrStatusMessage(
        "Sandbox payment success simulated. Ready to dispense."
      );
    } catch (error) {
      console.error(
        "Unable to simulate QR payment:",
        error
      );

      setQrError(
        error instanceof Error
          ? error.message
          : "Unable to simulate QR payment."
      );
    } finally {
      setSimulatingQrPayment(false);
    }
  };

  /*
   * ------------------------------------------------
   * DISPENSE
   * ------------------------------------------------
   */
  const handleStartDispense = async () => {
    const transactionId =
      purchaseResult?.transaction_id ??
      purchaseResult?.id;

    if (!transactionId) {
      setDispenseError(
        "The payment did not return a transaction ID."
      );
      return;
    }

    setStartingDispense(true);
    setDispenseError("");

    try {
      const result =
        await startSimulatorDispense({
          transactionId,
        });

      setDispenseInstruction(
        result.dispense
      );
    } catch (error) {
      console.error(
        "Unable to start dispensing:",
        error
      );

      setDispenseError(
        error instanceof Error
          ? error.message
          : "Unable to start dispensing."
      );
    } finally {
      setStartingDispense(false);
    }
  };

  const handleDispenseResult = async (
    dispenseSuccess
  ) => {
    const transactionId =
      purchaseResult?.transaction_id ??
      purchaseResult?.id;

    if (!transactionId) {
      setDispenseError(
        "The payment did not return a transaction ID."
      );
      return;
    }

    setCompletingDispense(true);
    setDispenseError("");

    try {
      const result =
        await completeSimulatorDispense({
          transactionId,
          success: dispenseSuccess,
          failureReason: dispenseSuccess
            ? null
            : "Simulated motor dispense failure",
        });

      setDispenseResult({
        success: dispenseSuccess,
        transaction: result.transaction,
      });

      /*
       * Reload inventory after failure because
       * recovery behavior depends on payment type.
       *
       * Student wallet:
       * refund + stock restoration.
       *
       * QR:
       * stock restoration + external refund flow.
       */
      if (!dispenseSuccess) {
        await loadProducts();
      }
    } catch (error) {
      console.error(
        "Unable to complete dispensing:",
        error
      );

      setDispenseError(
        error instanceof Error
          ? error.message
          : "Unable to complete dispensing."
      );
    } finally {
      setCompletingDispense(false);
    }
  };
  const handleSimulateQrRefund = async () => {
  const transactionId =
    purchaseResult?.transaction_id ??
    purchaseResult?.id;

  if (!transactionId) {
    setQrRefundError(
      "Transaction ID is missing."
    );
    return;
  }

  if (
    paymentMethod !== "qr" ||
    purchaseResult?.simulated !== true
  ) {
    setQrRefundError(
      "Sandbox refund simulation is only available for a simulated QR transaction."
    );
    return;
  }

  if (
    !dispenseResult ||
    dispenseResult.success
  ) {
    setQrRefundError(
      "A failed dispense is required before refund recovery."
    );
    return;
  }

  setProcessingQrRefund(true);
  setQrRefundError("");

  try {
    const result =
      await simulateQrRefundSuccess({
        transactionId,
      });

    setQrRefundResult(result);

    await loadProducts();
  } catch (error) {
    console.error(
      "Unable to simulate QR refund:",
      error
    );

    setQrRefundError(
      error instanceof Error
        ? error.message
        : "Unable to simulate QR refund."
    );
  } finally {
    setProcessingQrRefund(false);
  }
};

  const resetSimulator = async () => {
    if (
      processingPayment ||
      creatingQr ||
      creatingSimulatedQr ||
      checkingQr ||
      simulatingQrPayment ||
      startingDispense ||
      completingDispense
    ) {
      return;
    }

    setSelectedProduct(null);
    clearPaymentState();

    await loadProducts();
  };

  const transactionBusy =
  processingPayment ||
  creatingQr ||
  creatingSimulatedQr ||
  checkingQr ||
  simulatingQrPayment ||
  startingDispense ||
  completingDispense ||
  processingQrRefund;

  const paymentCompleted =
    Boolean(purchaseResult);

  const dispenseStarted =
    Boolean(dispenseInstruction);

  const transactionCompleted =
    Boolean(dispenseResult);

  const qrCodeBody =
    qrPayment?.payment?.qr_code_body ?? "";

  const qrExpiresAt =
    qrPayment?.payment?.expires_at;

  const simulatedQr =
    qrPayment?.simulated === true;

  const machineTransactionStatus = (() => {
    if (completingDispense) {
      return "Processing Result";
    }

    if (dispenseResult?.success) {
      return "Dispensed";
    }

    if (
      dispenseResult &&
      !dispenseResult.success
    ) {
      return "Recovery Required";
    }

    if (startingDispense) {
      return "Starting Motor";
    }

    if (dispenseInstruction) {
      return "Dispensing";
    }

    if (purchaseResult) {
      return "Payment Authorized";
    }

    if (simulatingQrPayment) {
      return "Simulating QR Payment";
    }

    if (checkingQr) {
      return "Checking QR";
    }

    if (qrPayment) {
      return simulatedQr
        ? "Awaiting Simulated Payment"
        : "Awaiting QR Payment";
    }

    if (creatingSimulatedQr) {
      return "Creating Sandbox QR";
    }

    if (creatingQr) {
      return "Creating QR";
    }

    if (processingPayment) {
      return "Processing Payment";
    }

    if (selectedProduct) {
      return "Product Selected";
    }

    return "Idle";
  })();

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-slate-900 p-6 text-white md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-1 text-sm text-slate-400">
              SmartVend Machine Simulator
            </p>

            <h1 className="text-3xl font-bold">
              SVM-001
            </h1>

            <p className="mt-2 text-sm text-slate-300">
              ESP32-S3 vending machine software
              simulation
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-4 py-3 text-emerald-300">
            <Wifi size={20} />

            <span className="font-medium">
              Machine Online
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Product Selection */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-slate-900">
                Select Product
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Choose a vending machine slot.
              </p>
            </div>

            {loadingProducts && (
              <div className="mb-5 flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                <RefreshCw
                  size={16}
                  className="animate-spin"
                />

                Loading SVM-001 inventory...
              </div>
            )}

            {loadError && (
              <ErrorMessage
                title="Inventory Error"
                message={loadError}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => {
                const unavailable =
                  !product.productId ||
                  product.stock <= 0 ||
                  product.slotStatus !== "ready" ||
                  product.productStatus !==
                    "active";

                const selected =
                  selectedProduct?.id ===
                  product.id;

                return (
                  <button
                    key={product.slot}
                    type="button"
                    disabled={
                      unavailable ||
                      paymentCompleted ||
                      Boolean(qrPayment) ||
                      transactionBusy
                    }
                    onClick={() =>
                      selectProduct(product)
                    }
                    className={`rounded-2xl border p-5 text-left transition ${
                      unavailable
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
                        : selected
                          ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                          : "border-slate-200 bg-white hover:-translate-y-1 hover:border-blue-500 hover:shadow-md"
                    } disabled:cursor-not-allowed`}
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                        <Package size={24} />
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        Slot {product.slot}
                      </span>
                    </div>

                    <h3 className="font-semibold text-slate-900">
                      {product.name}
                    </h3>

                    <p className="mt-2 text-2xl font-bold text-blue-600">
                      ₱
                      {product.price.toFixed(
                        2
                      )}
                    </p>

                    <p className="mt-3 text-sm text-slate-500">
                      {product.stock > 0
                        ? `${product.stock} item${
                            product.stock === 1
                              ? ""
                              : "s"
                          } available`
                        : "Out of stock"}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Right Panel */}
          <aside className="space-y-6">
            {/* Machine Status */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-bold text-slate-900">
                Machine Status
              </h2>

              <div className="mt-5 space-y-4 text-sm">
                <StatusRow
                  label="Machine"
                  value="SVM-001"
                />

                <StatusRow
                  label="Controller"
                  value="ESP32-S3"
                />

                <StatusRow
                  label="Connection"
                  value="Online"
                />

                <StatusRow
                  label="Transaction"
                  value={
                    machineTransactionStatus
                  }
                />
              </div>
            </div>

            {/* Payment */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="font-bold text-slate-900">
                Payment Method
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {selectedProduct
                  ? `${selectedProduct.name} • ₱${selectedProduct.price.toFixed(
                      2
                    )}`
                  : "Select a product first."}
              </p>

              <div className="mt-5 space-y-3">
                {/* Student Card */}
                <button
                  type="button"
                  disabled={
                    !selectedProduct ||
                    transactionBusy ||
                    paymentCompleted ||
                    Boolean(qrPayment)
                  }
                  onClick={() => {
                    setShowCardInput(true);
                    setPaymentError("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left text-slate-700 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <CreditCard size={22} />

                  <div>
                    <p className="font-semibold">
                      Student ID Card
                    </p>

                    <p className="text-xs">
                      RFID/NFC wallet payment
                    </p>
                  </div>
                </button>

                {showCardInput &&
                  selectedProduct &&
                  !purchaseResult && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            Simulated Card Reader
                          </p>

                          <p className="mt-1 text-xs text-slate-600">
                            Enter the UID that
                            would normally be read
                            by the physical
                            RFID/NFC reader.
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={
                            processingPayment
                          }
                          onClick={() => {
                            setShowCardInput(
                              false
                            );

                            setCardUid("");
                            setPaymentError("");
                          }}
                          className="rounded-lg p-1 text-slate-500 hover:bg-blue-100 disabled:opacity-50"
                          aria-label="Close card reader"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Card UID
                      </label>

                      <input
                        type="text"
                        value={cardUid}
                        disabled={
                          processingPayment
                        }
                        onChange={(event) =>
                          setCardUid(
                            event.target.value
                          )
                        }
                        placeholder="04:A3:7B:91"
                        autoComplete="off"
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />

                      <button
                        type="button"
                        onClick={
                          handleCardPurchase
                        }
                        disabled={
                          !cardUid.trim() ||
                          processingPayment
                        }
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                      >
                        {processingPayment && (
                          <Loader2
                            size={17}
                            className="animate-spin"
                          />
                        )}

                        {processingPayment
                          ? "Processing Card..."
                          : "Simulate Card Tap"}
                      </button>
                    </div>
                  )}

                {paymentError && (
                  <ErrorMessage
                    title="Payment Failed"
                    message={paymentError}
                  />
                )}

                {/* Student Payment Success */}
                {purchaseResult &&
                  paymentMethod === "card" && (
                    <SuccessMessage
                      title="Student Wallet Payment Successful"
                      message="Payment is authorized. The transaction can now proceed to the dispense stage."
                    />
                  )}

                {/* Direct QR */}
                <button
                  type="button"
                  disabled={
                    !selectedProduct ||
                    transactionBusy ||
                    paymentCompleted ||
                    Boolean(qrPayment)
                  }
                  onClick={handleCreateQr}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-4 text-left text-slate-700 transition hover:border-blue-500 hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {creatingQr ? (
                    <Loader2
                      size={22}
                      className="animate-spin"
                    />
                  ) : (
                    <QrCode size={22} />
                  )}

                  <div>
                    <p className="font-semibold">
                      {creatingQr
                        ? "Creating QR..."
                        : "Direct QR Payment"}
                    </p>

                    <p className="text-xs">
                      Maya QRPh sandbox
                    </p>
                  </div>
                </button>

                {qrError && !qrPayment && (
                  <div className="space-y-3">
                    <ErrorMessage
                      title="Maya Sandbox QR Unavailable"
                      message={qrError}
                    />

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle
                          size={20}
                          className="mt-0.5 shrink-0 text-amber-600"
                        />

                        <div>
                          <p className="text-sm font-semibold text-amber-900">
                            Presentation Sandbox Fallback
                          </p>

                          <p className="mt-1 text-xs text-amber-700">
                            Maya sandbox QR
                            creation is currently
                            unavailable. You can
                            continue using a
                            clearly labeled
                            SmartVend simulated
                            QR. This does not
                            represent a real Maya
                            payment.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={
                          handleCreateSimulatedQr
                        }
                        disabled={
                          creatingSimulatedQr ||
                          transactionBusy
                        }
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                      >
                        {creatingSimulatedQr ? (
                          <Loader2
                            size={17}
                            className="animate-spin"
                          />
                        ) : (
                          <QrCode size={17} />
                        )}

                        {creatingSimulatedQr
                          ? "Creating Sandbox QR..."
                          : "Use Simulated Sandbox QR"}
                      </button>
                    </div>
                  </div>
                )}

                {qrError && qrPayment && (
                  <ErrorMessage
                    title="QR Payment Error"
                    message={qrError}
                  />
                )}

                {/* QR Display */}
                {qrPayment &&
                  !purchaseResult && (
                    <div
                      className={`rounded-2xl border p-5 ${
                        simulatedQr
                          ? "border-amber-200 bg-amber-50"
                          : "border-violet-200 bg-violet-50"
                      }`}
                    >
                      <div className="text-center">
                        <p
                          className={`font-semibold ${
                            simulatedQr
                              ? "text-amber-950"
                              : "text-violet-950"
                          }`}
                        >
                          {simulatedQr
                            ? "SmartVend Sandbox QR"
                            : "Maya QRPh"}
                        </p>

                        <p
                          className={`mt-1 text-xs ${
                            simulatedQr
                              ? "text-amber-700"
                              : "text-violet-700"
                          }`}
                        >
                          {simulatedQr
                            ? "SIMULATED — not created by Maya"
                            : "Real Maya sandbox payment QR"}
                        </p>
                      </div>

                      {simulatedQr && (
                        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-white/70 p-3">
                          <AlertTriangle
                            size={17}
                            className="mt-0.5 shrink-0 text-amber-600"
                          />

                          <p className="text-xs text-amber-800">
                            Development and
                            presentation simulation
                            only. Scanning this QR
                            will not perform a real
                            Maya payment.
                          </p>
                        </div>
                      )}

                      <div className="mx-auto mt-4 flex w-fit rounded-2xl bg-white p-4 shadow-sm">
                        <QRCodeSVG
                          value={qrCodeBody}
                          size={190}
                          level="M"
                        />
                      </div>

                      <div className="mt-4 text-center">
                        <p className="text-sm font-semibold text-slate-900">
                          {
                            selectedProduct?.name
                          }
                        </p>

                        <p
                          className={`mt-1 text-2xl font-bold ${
                            simulatedQr
                              ? "text-amber-700"
                              : "text-violet-700"
                          }`}
                        >
                          ₱
                          {selectedProduct?.price.toFixed(
                            2
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Slot{" "}
                          {
                            selectedProduct?.slot
                          }
                        </p>
                      </div>

                      {qrExpiresAt && (
                        <p className="mt-3 text-center text-xs text-slate-500">
                          Expires:{" "}
                          {new Date(
                            qrExpiresAt
                          ).toLocaleString()}
                        </p>
                      )}

                      {qrStatusMessage && (
                        <div
                          className={`mt-4 rounded-xl bg-white/80 p-3 text-center text-xs ${
                            simulatedQr
                              ? "text-amber-800"
                              : "text-violet-800"
                          }`}
                        >
                          {qrStatusMessage}
                        </div>
                      )}

                      {simulatedQr ? (
                        <button
                          type="button"
                          disabled={
                            simulatingQrPayment
                          }
                          onClick={
                            handleSimulateQrPayment
                          }
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                        >
                          {simulatingQrPayment ? (
                            <Loader2
                              size={17}
                              className="animate-spin"
                            />
                          ) : (
                            <CheckCircle2
                              size={17}
                            />
                          )}

                          {simulatingQrPayment
                            ? "Simulating Payment..."
                            : "Simulate Payment Success"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={checkingQr}
                          onClick={
                            handleCheckQrStatus
                          }
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-violet-300"
                        >
                          {checkingQr ? (
                            <Loader2
                              size={17}
                              className="animate-spin"
                            />
                          ) : (
                            <RefreshCw
                              size={17}
                            />
                          )}

                          {checkingQr
                            ? "Checking Maya..."
                            : "Check Payment Status"}
                        </button>
                      )}
                    </div>
                  )}

                {/* QR Payment Success */}
                {purchaseResult &&
                  paymentMethod === "qr" && (
                    <SuccessMessage
                      title={
                        purchaseResult.simulated
                          ? "Sandbox Payment Simulated"
                          : "Maya QR Payment Verified"
                      }
                      message={
                        purchaseResult.simulated
                          ? "Payment success was simulated in the SmartVend sandbox. Maya did not confirm this payment. The transaction can now demonstrate the dispense lifecycle."
                          : "Maya confirmed the payment. The transaction is authorized for dispensing."
                      }
                    />
                  )}
              </div>
            </div>
          </aside>
        </div>

        {/* Transaction Simulator */}
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Transaction Simulator
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {dispenseResult?.success
                  ? `${selectedProduct?.name} was successfully dispensed.`
                  : dispenseResult
                    ? "Dispense failed. Recovery was processed by the backend."
                    : dispenseInstruction
                      ? `Motor ${selectedProduct?.motorNumber} is in the simulated dispense stage.`
                      : purchaseResult
                        ? `Payment authorized for ${selectedProduct?.name}. Ready to simulate Motor ${selectedProduct?.motorNumber}.`
                        : qrPayment
                          ? simulatedQr
                            ? "Waiting for simulated sandbox payment confirmation."
                            : "Waiting for Maya payment confirmation."
                          : selectedProduct
                            ? `Selected slot ${selectedProduct.slot} — ${selectedProduct.name}, Motor ${selectedProduct.motorNumber}.`
                            : "Waiting for a product selection."}
              </p>
            </div>

            <button
              type="button"
              disabled={transactionBusy}
              onClick={resetSimulator}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={16} />
              Reset Simulator
            </button>
          </div>

          {/* Process */}
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <ProcessStep
              number="1"
              title="Product"
              description={
                selectedProduct
                  ? `Slot ${selectedProduct.slot}`
                  : "Select slot"
              }
              completed={Boolean(
                selectedProduct
              )}
            />

            <ProcessStep
              number="2"
              title="Payment"
              description={
                purchaseResult
                  ? paymentMethod === "qr"
                    ? purchaseResult.simulated
                      ? "Sandbox payment simulated"
                      : "Maya QR paid"
                    : "Student wallet paid"
                  : qrPayment
                    ? simulatedQr
                      ? "Awaiting simulation"
                      : "Awaiting Maya"
                    : processingPayment ||
                        creatingQr ||
                        creatingSimulatedQr ||
                        checkingQr ||
                        simulatingQrPayment
                      ? "Processing"
                      : "Card or QR"
              }
              active={
                Boolean(qrPayment) &&
                !purchaseResult
              }
              completed={paymentCompleted}
            />

            <ProcessStep
              number="3"
              title="Dispense"
              description={
                dispenseResult?.success
                  ? "Product dispensed"
                  : dispenseResult
                    ? "Motor failed"
                    : dispenseInstruction
                      ? `Motor ${selectedProduct?.motorNumber} active`
                      : purchaseResult
                        ? "Ready for motor command"
                        : "Motor command"
              }
              active={
                dispenseStarted &&
                !transactionCompleted
              }
              completed={Boolean(
                dispenseResult?.success
              )}
              failed={Boolean(
                dispenseResult &&
                  !dispenseResult.success
              )}
            />

            <ProcessStep
              number="4"
              title="Result"
              description={
                dispenseResult?.success
                  ? "Transaction complete"
                  : dispenseResult
                    ? paymentMethod === "qr"
                      ? "Refund recovery required"
                      : "Recovery complete"
                    : "Success or recovery"
              }
              completed={Boolean(
                dispenseResult?.success
              )}
              failed={Boolean(
                dispenseResult &&
                  !dispenseResult.success
              )}
            />
          </div>

          {/* Ready to Dispense */}
          {purchaseResult &&
            !dispenseInstruction &&
            !dispenseResult && (
              <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-blue-950">
                      Ready to Dispense
                    </p>

                    <p className="mt-1 text-sm text-blue-700">
                      Start the simulated command
                      for Motor{" "}
                      {
                        selectedProduct?.motorNumber
                      }{" "}
                      on Slot{" "}
                      {selectedProduct?.slot}.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      handleStartDispense
                    }
                    disabled={startingDispense}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {startingDispense ? (
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                    ) : (
                      <Play size={18} />
                    )}

                    {startingDispense
                      ? "Starting Motor..."
                      : `Start Motor ${selectedProduct?.motorNumber}`}
                  </button>
                </div>
              </div>
            )}

          {/* Motor */}
          {dispenseInstruction &&
            !dispenseResult && (
              <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-violet-100 p-3 text-violet-700">
                    <RotateCcw
                      size={24}
                      className={
                        completingDispense
                          ? "animate-spin"
                          : ""
                      }
                    />
                  </div>

                  <div>
                    <p className="font-semibold text-violet-950">
                      Simulated Motor{" "}
                      {
                        selectedProduct?.motorNumber
                      }
                    </p>

                    <p className="mt-1 text-sm text-violet-700">
                      The backend authorized the
                      dispense command. Choose the
                      physical result that the
                      ESP32-S3 would normally
                      report.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={
                      completingDispense
                    }
                    onClick={() =>
                      handleDispenseResult(true)
                    }
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300"
                  >
                    <CheckCircle2
                      size={18}
                    />
                    Dispense Success
                  </button>

                  <button
                    type="button"
                    disabled={
                      completingDispense
                    }
                    onClick={() =>
                      handleDispenseResult(false)
                    }
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-red-300"
                  >
                    <XCircle size={18} />
                    Dispense Failure
                  </button>
                </div>

                {completingDispense && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-violet-700">
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />

                    Reporting motor result...
                  </div>
                )}
              </div>
            )}

          {dispenseError && (
            <div className="mt-6">
              <ErrorMessage
                title="Dispense Error"
                message={dispenseError}
              />
            </div>
          )}

          {/* Successful Dispense */}
          {dispenseResult?.success && (
            <div className="mt-6">
              <SuccessMessage
                title="Dispense Successful"
                message={`${selectedProduct?.name} was successfully dispensed from Slot ${selectedProduct?.slot}. The SmartVend transaction is complete.`}
              />
            </div>
          )}

          {/* Failed Dispense */}
          {dispenseResult &&
            !dispenseResult.success && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    size={24}
                    className="mt-0.5 shrink-0 text-amber-600"
                  />

                  <div>
                    <p className="font-semibold text-amber-950">
                      Dispense Failed
                    </p>
                    {paymentMethod === "qr" &&
  purchaseResult?.simulated === true &&
  !qrRefundResult && (
    <div className="mt-5">
      {qrRefundError && (
        <div className="mb-4">
          <ErrorMessage
            title="Refund Recovery Failed"
            message={qrRefundError}
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleSimulateQrRefund}
        disabled={processingQrRefund}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
      >
        {processingQrRefund ? (
          <Loader2
            size={18}
            className="animate-spin"
          />
        ) : (
          <RotateCcw size={18} />
        )}

        {processingQrRefund
          ? "Processing Sandbox Refund..."
          : "Simulate QR Refund"}
      </button>

      <p className="mt-2 text-center text-xs text-amber-700">
        Sandbox simulation only — no real
        Maya refund will be performed.
      </p>
    </div>
  )}

{qrRefundResult && (
  <div className="mt-5">
    <SuccessMessage
      title="Sandbox Refund Completed"
      message="The simulated external QR refund was completed. This refund was not confirmed or processed by Maya."
    />

    {qrRefundResult.refund_reference && (
      <p className="mt-3 break-all text-xs text-emerald-700">
        Refund reference:{" "}
        {qrRefundResult.refund_reference}
      </p>
    )}
  </div>
)}

                    <p className="mt-1 text-sm text-amber-700">
                      {paymentMethod === "card"
                        ? "The backend refunded the student wallet and restored the reserved stock."
                        : purchaseResult?.simulated
                          ? "The reserved stock was restored. This simulated external QR transaction now follows the sandbox refund recovery process."
                          : "The reserved stock was restored. Because this is an external Maya QR payment, the transaction now requires the QR refund recovery process."}
                    </p>
                  </div>
                </div>
              </div>
            )}
        </section>

        {/* Simulator Warning */}
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Development Simulator
          </p>

          <p className="mt-1 text-sm text-amber-700">
            This interface represents SVM-001.
            Student card taps and physical motor
            operation are simulated until the
            ESP32-S3 hardware is connected. Real
            Maya QR generation and payment-status
            verification use the Maya sandbox
            integration. When the Maya sandbox QR
            service is unavailable, a separately
            labeled SmartVend payment simulation
            may be used for development and
            presentation testing.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-slate-500">
        {label}
      </span>

      <span className="flex items-center gap-1.5 text-right font-medium text-slate-800">
        {value === "Online" && (
          <CheckCircle2
            size={15}
            className="shrink-0 text-emerald-500"
          />
        )}

        {value}
      </span>
    </div>
  );
}

function ProcessStep({
  number,
  title,
  description,
  completed = false,
  active = false,
  failed = false,
}) {
  let containerClass =
    "border-slate-200 bg-white";

  let circleClass =
    "bg-slate-900 text-white";

  if (active) {
    containerClass =
      "border-violet-300 bg-violet-50";

    circleClass =
      "bg-violet-600 text-white";
  }

  if (completed) {
    containerClass =
      "border-emerald-200 bg-emerald-50";

    circleClass =
      "bg-emerald-600 text-white";
  }

  if (failed) {
    containerClass =
      "border-amber-200 bg-amber-50";

    circleClass =
      "bg-amber-600 text-white";
  }

  return (
    <div
      className={`rounded-xl border p-4 ${containerClass}`}
    >
      <div
        className={`mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${circleClass}`}
      >
        {completed && !failed ? (
          <CheckCircle2 size={17} />
        ) : failed ? (
          <AlertTriangle size={17} />
        ) : active ? (
          <RotateCcw size={16} />
        ) : (
          number
        )}
      </div>

      <p className="font-semibold text-slate-900">
        {title}
      </p>

      <p className="mt-1 text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function ErrorMessage({ title, message }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
    >
      <div className="flex items-start gap-2">
        <XCircle
          size={18}
          className="mt-0.5 shrink-0"
        />

        <div>
          <p className="text-sm font-semibold">
            {title}
          </p>

          <p className="mt-1 text-sm">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

function SuccessMessage({
  title,
  message,
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2
          size={20}
          className="mt-0.5 shrink-0 text-emerald-600"
        />

        <div>
          <p className="font-semibold text-emerald-900">
            {title}
          </p>

          <p className="mt-1 text-sm text-emerald-700">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}