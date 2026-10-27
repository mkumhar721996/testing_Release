import { useEffect, useState } from "react";
import { RegistrationForm } from "../auth/RegistrationForm";
import { listProducts, placeOrder, type Product } from "./shopClient";

type OrderOutcome = { ok: true } | { ok: false; message: string };

export function ShoppingPage({ signedIn = true }: { signedIn?: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, OrderOutcome>>({});
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    // The product list is session-guarded, so a signed-out visitor cannot load it.
    if (!signedIn) return;
    listProducts()
      .then(setProducts)
      .catch((err: Error) => setLoadError(err.message));
  }, [signedIn]);

  async function onOrder(productId: string) {
    const result = await placeOrder(productId);
    setOutcomes((prev) => ({
      ...prev,
      [productId]: result.ok ? { ok: true } : { ok: false, message: result.message },
    }));
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-semibold text-slate-900">Shop</h1>
      {!signedIn && (
        <>
          <button
            onClick={() => setRegistering((open) => !open)}
            className="mt-4 rounded bg-slate-900 px-4 py-2 text-white"
          >
            Register
          </button>
          {registering && <RegistrationForm />}
        </>
      )}
      {loadError && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {loadError}
        </p>
      )}
      <ul className="mt-4 space-y-3">
        {products.map((product) => {
          const outcome = outcomes[product.id];
          return (
            <li key={product.id} className="flex items-center gap-4 rounded bg-white p-4 shadow">
              <span className="flex-1 text-slate-900">{product.name}</span>
              <span className="text-slate-700">${(product.priceCents / 100).toFixed(2)}</span>
              <button
                onClick={() => onOrder(product.id)}
                aria-label={`Order ${product.name}`}
                className="rounded bg-slate-900 px-4 py-2 text-white"
              >
                Order
              </button>
              {outcome?.ok && (
                <p role="status" className="text-sm text-green-700">
                  Order placed
                </p>
              )}
              {outcome && !outcome.ok && (
                <p role="alert" className="text-sm text-red-700">
                  {outcome.message}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
