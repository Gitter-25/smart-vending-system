import {
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";



const initialFormData = {
  name: "",
  category: "",
  price: "",
  status: "active",
};

export default function Products() {
  const [products, setProducts] = useState([]);
const [loading, setLoading] = useState(true);
const [pageError, setPageError] = useState("");
const [saving, setSaving] = useState(false);
const [deleting, setDeleting] = useState(false);

useEffect(() => {
  const loadProducts = async () => {
    setLoading(true);
    setPageError("");

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, category, price, status, created_at"
      )
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Unable to load products:",
        error.message
      );

      setPageError(
        "Unable to load products. Please try again."
      );
      setLoading(false);
      return;
    }

    const formattedProducts = (data ?? []).map(
      (product) => ({
        ...product,
        price: Number(product.price),
      })
    );

    setProducts(formattedProducts);
    setLoading(false);
  };

  loadProducts();
}, []);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [formData, setFormData] = useState(initialFormData);
  const [formError, setFormError] = useState("");

  const [openMenuId, setOpenMenuId] = useState(null);

  const [productToDelete, setProductToDelete] = useState(null);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesCategory =
        category === "All" || product.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(initialFormData);
    setFormError("");
    setShowProductModal(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);

    setFormData({
  name: product.name,
  category: product.category,
  price: String(product.price),
  status: product.status,
});

    setFormError("");
    setOpenMenuId(null);
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setEditingProduct(null);
    setFormData(initialFormData);
    setFormError("");
  };

  const handleSubmitProduct = async (event) => {
  event.preventDefault();
  setFormError("");

  const name = formData.name.trim();
  const price = Number(formData.price);

  if (
    !name ||
    !formData.category ||
    !formData.price
  ) {
    setFormError(
      "Please complete all required fields."
    );
    return;
  }

  if (
    Number.isNaN(price) ||
    price <= 0
  ) {
    setFormError(
      "Please enter a valid product price."
    );
    return;
  }

  const normalizedStatus =
    String(formData.status || "").toLowerCase();

  const productData = {
    name,
    category: formData.category,
    price,
    status: normalizedStatus,
  };

  try {
    setSaving(true);

    if (editingProduct) {
      const { data, error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id)
        .select(
          "id, name, category, price, status, created_at"
        )
        .single();

      if (error) {
        throw error;
      }

      const updatedProduct = {
        ...data,
        price: Number(data.price),
      };

      setProducts((current) =>
        current.map((product) =>
          product.id === editingProduct.id
            ? updatedProduct
            : product
        )
      );
    } else {
      const { data, error } = await supabase
        .from("products")
        .insert({
          name,
          category: formData.category,
          price,
          status: normalizedStatus,
        })
        .select(
          "id, name, category, price, status, created_at"
        )
        .single();

      if (error) {
        throw error;
      }

      const newProduct = {
        ...data,
        price: Number(data.price),
      };

      setProducts((current) => [
        ...current,
        newProduct,
      ]);
    }

    closeProductModal();
  } catch (error) {
    console.error(
      "Unable to save product:",
      error
    );

    setFormError(
      editingProduct
        ? "Unable to update product. Please try again."
        : "Unable to add product. Please try again."
    );
  } finally {
    setSaving(false);
  }
};

  const openDeleteConfirmation = (product) => {
    setProductToDelete(product);
    setOpenMenuId(null);
  };

  const closeDeleteConfirmation = () => {
    setProductToDelete(null);
  };

  const handleDeleteProduct = async () => {
  if (!productToDelete) {
    return;
  }

  try {
    setDeleting(true);

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productToDelete.id);

    if (error) {
      throw error;
    }

    setProducts((current) =>
      current.filter(
        (product) =>
          product.id !== productToDelete.id
      )
    );

    setProductToDelete(null);
  } catch (error) {
    console.error(
      "Unable to delete product:",
      error
    );

    setPageError(
      "Unable to delete the product. It may currently be assigned to a vending slot."
    );

    setProductToDelete(null);
  } finally {
    setDeleting(false);
  }
};
if (loading) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <Loader2
          size={32}
          className="mx-auto animate-spin text-blue-600"
        />

        <p className="mt-3 text-sm text-slate-500">
          Loading products...
        </p>
      </div>
    </div>
  );
}

  return (
    
    
    <div>
      {/* Page Heading */}
      {pageError && (
  <div
    role="alert"
    className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
  >
    {pageError}
  </div>
)}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Products
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage products available in your vending machine.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Product
        </button>
      </div>

      {/* Statistics */}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Products"
          value={products.length}
        />

        <StatCard
          title="Active Products"
          value={
            products.filter(
              (product) =>
                String(product.status ?? "")
                  .toLowerCase() === "active"
            ).length
          }
        />

        <StatCard
          title="Categories"
          value={
            new Set(
              products.map((product) => product.category)
            ).size
          }
        />
      </div>

      {/* Products Container */}
      <div className="mt-6 overflow-visible rounded-2xl border border-slate-200 bg-white">
        {/* Toolbar */}
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal
              size={18}
              className="text-slate-400"
            />

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
              <option value="All">All categories</option>
              <option value="Beverages">Beverages</option>
              <option value="Snacks">Snacks</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3 font-medium">
                  Product
                </th>

                <th className="px-6 py-3 font-medium">
                  Category
                </th>

                <th className="px-6 py-3 font-medium">
                  Price
                </th>

                <th className="px-6 py-3 font-medium">
                  Status
                </th>

                <th className="px-6 py-3 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((product) => {
                const productStatus =
                  String(product.status ?? "").toLowerCase();

                return (
                  <tr
                    key={product.id}
                    className="transition hover:bg-slate-50"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                          <Package size={19} />
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {product.name}
                          </p>

                          <p className="text-xs text-slate-400">
                          Product #{product.id.slice(0, 8).toUpperCase()}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-slate-600">
                      {product.category}
                    </td>

                    <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                      ₱{product.price.toFixed(2)}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          productStatus === "active"
                            ? "bg-green-50 text-green-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {productStatus === "active"
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                  {/* Action Menu */}
                  <td className="relative px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenMenuId((current) =>
                          current === product.id
                            ? null
                            : product.id
                        )
                      }
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Actions for ${product.name}`}
                    >
                      <MoreHorizontal size={19} />
                    </button>

                    {openMenuId === product.id && (
                      <div className="absolute right-6 top-12 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg">
                        <button
                          type="button"
                          onClick={() =>
                            openEditModal(product)
                          }
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openDeleteConfirmation(product)
                          }
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>

          {filteredProducts.length === 0 && (
            <div className="px-6 py-14 text-center">
              <Package
                size={32}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 font-medium text-slate-700">
                No products found
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Try changing your search or category filter.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">
            Showing {filteredProducts.length} of{" "}
            {products.length} products
          </p>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingProduct
                    ? "Edit Product"
                    : "Add Product"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {editingProduct
                    ? "Update the selected product information."
                    : "Add a new product to the vending system."}
                </p>
              </div>

              <button
  type="button"
  onClick={closeProductModal}
  disabled={saving}
  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
>
  Cancel
</button>
            </div>

            <form onSubmit={handleSubmitProduct}>
              <div className="space-y-5 p-6">
                {/* Product Name */}
                <div>
                  <label
                    htmlFor="product-name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Product name
                  </label>

                  <input
                    id="product-name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Bottled Water"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                {/* Category */}
                <div>
                  <label
                    htmlFor="product-category"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Category
                  </label>

                  <select
                    id="product-category"
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">
                      Select category
                    </option>

                    <option value="Beverages">
                      Beverages
                    </option>

                    <option value="Snacks">
                      Snacks
                    </option>
                  </select>
                </div>

                {/* Price */}
                <div>
                  <label
                    htmlFor="product-price"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Price
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      ₱
                    </span>

                    <input
                      id="product-price"
                      name="price"
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={formData.price}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-300 py-2.5 pl-8 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* Status */}
                <div>
                  <label
                    htmlFor="product-status"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Status
                  </label>

                  <select
                    id="product-status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="active">
                    Active
                    </option>

                    <option value="inactive">
                    Inactive
                    </option>
                  </select>
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {formError}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeProductModal}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
  type="submit"
  disabled={saving}
  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
>
  {saving && (
    <Loader2
      size={17}
      className="animate-spin"
    />
  )}

  {saving
    ? "Saving..."
    : editingProduct
      ? "Save Changes"
      : "Add Product"}
</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 size={22} />
              </div>

              <h2 className="mt-5 text-xl font-bold text-slate-900">
                Delete Product?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-700">
                  {productToDelete.name}
                </span>
                ? This action cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>

              <button
  type="button"
  onClick={handleDeleteProduct}
  disabled={deleting}
  className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-400"
>
  {deleting && (
    <Loader2
      size={17}
      className="animate-spin"
    />
  )}

  {deleting
    ? "Deleting..."
    : "Delete Product"}
</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}