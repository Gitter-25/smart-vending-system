import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Package,
  PackageOpen,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

const initialInventory = [
  {
    id: 1,
    slot: "A1",
    product: "Bottled Water",
    quantity: 8,
    capacity: 10,
  },
  {
    id: 2,
    slot: "A2",
    product: "Iced Tea",
    quantity: 3,
    capacity: 10,
  },
  {
    id: 3,
    slot: "A3",
    product: "Chocolate Bar",
    quantity: 0,
    capacity: 10,
  },
  {
    id: 4,
    slot: "A4",
    product: "Potato Chips",
    quantity: 10,
    capacity: 10,
  },
  {
    id: 5,
    slot: "B1",
    product: "Biscuits",
    quantity: 5,
    capacity: 10,
  },
  {
    id: 6,
    slot: "B2",
    product: "Orange Juice",
    quantity: 2,
    capacity: 10,
  },
];

function getStockStatus(quantity, capacity) {
  if (quantity === 0) {
    return "Out of Stock";
  }

  if (quantity === capacity) {
    return "Full";
  }

  if (quantity <= Math.ceil(capacity * 0.3)) {
    return "Low Stock";
  }

  return "In Stock";
}

export default function Inventory() {
  const [inventory, setInventory] = useState(initialInventory);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [restockItem, setRestockItem] = useState(null);
  const [restockQuantity, setRestockQuantity] = useState("");
  const [restockError, setRestockError] = useState("");

  const inventoryWithStatus = useMemo(() => {
    return inventory.map((item) => ({
      ...item,
      status: getStockStatus(item.quantity, item.capacity),
    }));
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventoryWithStatus.filter((item) => {
      const searchValue = search.toLowerCase();

      const matchesSearch =
        item.product.toLowerCase().includes(searchValue) ||
        item.slot.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "All" ||
        item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [inventoryWithStatus, search, statusFilter]);

  const totalStock = inventory.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const totalCapacity = inventory.reduce(
    (total, item) => total + item.capacity,
    0
  );

  const lowStockCount = inventoryWithStatus.filter(
    (item) => item.status === "Low Stock"
  ).length;

  const emptySlotCount = inventoryWithStatus.filter(
    (item) => item.status === "Out of Stock"
  ).length;

  const openRestockModal = (item) => {
    setRestockItem(item);
    setRestockQuantity("");
    setRestockError("");
  };

  const closeRestockModal = () => {
    setRestockItem(null);
    setRestockQuantity("");
    setRestockError("");
  };

  const handleRestock = (event) => {
    event.preventDefault();

    if (!restockItem) {
      return;
    }

    setRestockError("");

    const amount = Number(restockQuantity);

    if (
      !restockQuantity ||
      Number.isNaN(amount) ||
      !Number.isInteger(amount) ||
      amount <= 0
    ) {
      setRestockError(
        "Enter a valid whole number of items to add."
      );
      return;
    }

    const availableSpace =
      restockItem.capacity - restockItem.quantity;

    if (amount > availableSpace) {
      setRestockError(
        `Only ${availableSpace} more item${
          availableSpace === 1 ? "" : "s"
        } can fit in this slot.`
      );
      return;
    }

    setInventory((current) =>
      current.map((item) =>
        item.id === restockItem.id
          ? {
              ...item,
              quantity: item.quantity + amount,
            }
          : item
      )
    );

    closeRestockModal();
  };

  return (
    <div>
      {/* Page Heading */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Inventory
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Monitor vending machine stock levels and product
          slots.
        </p>
      </div>

      {/* Statistics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InventoryStatCard
          title="Total Stock"
          value={totalStock}
          description={`${totalCapacity} total capacity`}
          icon={Boxes}
        />

        <InventoryStatCard
          title="Low Stock"
          value={lowStockCount}
          description="Slots that need attention"
          icon={AlertTriangle}
        />

        <InventoryStatCard
          title="Empty Slots"
          value={emptySlotCount}
          description="Currently out of stock"
          icon={PackageOpen}
        />

        <InventoryStatCard
          title="Capacity"
          value={`${totalStock}/${totalCapacity}`}
          description="Items currently loaded"
          icon={Package}
        />
      </div>

      {/* Inventory Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          {/* Search */}
          <div className="relative w-full md:max-w-sm">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search product or slot..."
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal
              size={18}
              className="text-slate-400"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="All">
                All statuses
              </option>

              <option value="Full">
                Full
              </option>

              <option value="In Stock">
                In Stock
              </option>

              <option value="Low Stock">
                Low Stock
              </option>

              <option value="Out of Stock">
                Out of Stock
              </option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">
                  Slot
                </th>

                <th className="px-6 py-3 font-medium">
                  Product
                </th>

                <th className="px-6 py-3 font-medium">
                  Stock
                </th>

                <th className="px-6 py-3 font-medium">
                  Capacity
                </th>

                <th className="px-6 py-3 font-medium">
                  Status
                </th>

                <th className="px-6 py-3 text-right font-medium">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredInventory.map((item) => (
                <tr
                  key={item.id}
                  className="transition hover:bg-slate-50"
                >
                  {/* Slot */}
                  <td className="px-6 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-600">
                      {item.slot}
                    </div>
                  </td>

                  {/* Product */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                        <Package size={18} />
                      </div>

                      <p className="text-sm font-semibold text-slate-800">
                        {item.product}
                      </p>
                    </div>
                  </td>

                  {/* Stock */}
                  <td className="px-6 py-4">
                    <div className="w-32">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-800">
                          {item.quantity}
                        </span>

                        <span className="text-xs text-slate-400">
                          / {item.capacity}
                        </span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{
                            width: `${
                              (item.quantity /
                                item.capacity) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Capacity */}
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {item.capacity} items
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <StockStatusBadge
                      status={item.status}
                    />
                  </td>

                  {/* Restock */}
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        openRestockModal(item)
                      }
                      disabled={
                        item.quantity >= item.capacity
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <RefreshCw size={15} />
                      Restock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Empty Results */}
          {filteredInventory.length === 0 && (
            <div className="px-6 py-14 text-center">
              <PackageOpen
                size={34}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 font-medium text-slate-700">
                No inventory found
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Try changing your search or stock filter.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">
            Showing {filteredInventory.length} of{" "}
            {inventory.length} vending slots
          </p>
        </div>
      </div>

      {/* Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Restock Slot {restockItem.slot}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Add stock for {restockItem.product}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRestockModal}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleRestock}>
              <div className="space-y-5 p-6">
                {/* Current Stock */}
                <div className="rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Current stock
                    </span>

                    <span className="font-semibold text-slate-900">
                      {restockItem.quantity} /{" "}
                      {restockItem.capacity}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      Available space
                    </span>

                    <span className="font-semibold text-slate-900">
                      {restockItem.capacity -
                        restockItem.quantity}
                    </span>
                  </div>
                </div>

                {/* Restock Amount */}
                <div>
                  <label
                    htmlFor="restock-quantity"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Quantity to add
                  </label>

                  <input
                    id="restock-quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={restockQuantity}
                    onChange={(event) =>
                      setRestockQuantity(
                        event.target.value
                      )
                    }
                    placeholder="Enter quantity"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    autoFocus
                  />
                </div>

                {restockError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {restockError}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeRestockModal}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryStatCard({
  title,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function StockStatusBadge({ status }) {
  const styles = {
    Full: "bg-blue-50 text-blue-700",
    "In Stock": "bg-green-50 text-green-700",
    "Low Stock": "bg-amber-50 text-amber-700",
    "Out of Stock": "bg-red-50 text-red-700",
  };

  const icons = {
    Full: CheckCircle2,
    "In Stock": CheckCircle2,
    "Low Stock": AlertTriangle,
    "Out of Stock": PackageOpen,
  };

  const Icon = icons[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      <Icon size={13} />
      {status}
    </span>
  );
}