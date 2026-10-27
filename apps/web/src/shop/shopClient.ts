const base = () => import.meta.env.VITE_API_BASE_URL ?? "";

export type Product = { id: string; name: string; priceCents: number };
export type PlaceOrderResult = { ok: true; orderId: string } | { ok: false; message: string };

export async function listProducts(): Promise<Product[]> {
  const res = await fetch(`${base()}/products`, { credentials: "include" });
  if (!res.ok) throw new Error("Could not load products.");
  return res.json();
}

export async function placeOrder(productId: string): Promise<PlaceOrderResult> {
  const res = await fetch(`${base()}/orders`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  if (res.ok) {
    const data = await res.json();
    return { ok: true, orderId: data.id };
  }
  return { ok: false, message: "We could not place your order." };
}
