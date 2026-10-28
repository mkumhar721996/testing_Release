summary: |
  Let a signed-in user order an iPhone from a shopping page. The repo today has only auth (sign-in, session, activation, password reset) and a placeholder signed-in shell, so there is no shopping page, product catalogue or order concept. This plan adds the thinnest vertical slice that satisfies the single acceptance criterion. In comp_api_service, a Product entity, an Order entity, an authenticated GET /products and an authenticated POST /orders. In comp_web_app, a ShoppingPage at /shop that lists products and has an "Order" button per product, which calls the API and confirms that the order was placed.
scope:
  - description: |
      API data model. Add a Product entity (id uuid, name, category, priceCents int, available boolean) and an Order entity (id uuid, userId uuid, productId uuid, quantity int default 1, status varchar default 'placed', createdAt timestamptz). Quantity is fixed at 1 in this story. Entities are auto-loaded through TypeOrmModule.forFeature, so no change to the app.module.ts TypeORM config is needed.
    files:
      - services/api/src/shop/entities/product.entity.ts
      - services/api/src/shop/entities/order.entity.ts
    rationale: |
      Follows the existing entity style (services/api/src/auth/entities/user.entity.ts) and the postgres and TypeORM stack.
  - description: |
      API service and controller. ShopService exposes listProducts() and placeOrder(userId, productId). placeOrder throws ProductNotFoundError when the product is missing or unavailable, and otherwise saves an Order with status 'placed' and returns it. ShopController (@Controller()) has GET /products and POST /orders, both behind SessionGuard. POST /orders returns 201 with the order id, productId and status, and returns 404 { code: 'product_not_found' } for an unknown or unavailable product or a malformed body. ShopModule imports AuthModule, which already exports SessionGuard and SessionService, and is added to the AppModule imports.
    files:
      - services/api/src/shop/shop.service.ts
      - services/api/src/shop/shop.controller.ts
      - services/api/src/shop/shop.errors.ts
      - services/api/src/shop/shop.module.ts
      - services/api/src/app/app.module.ts
    rationale: |
      Mirrors the auth module layout (service, errors, controller, module) and reuses the SessionGuard cookie session for authentication. The guard sets req.user to { id, email }, which supplies the order's userId.
  - description: |
      Web client and page. shopClient.ts exports
      `listProducts(): Promise<Product[]>` and `placeOrder(productId: string): Promise<{ ok: true; orderId: string } | { ok: false; message: string }>`,
      using fetch with credentials include, as authClient.ts does. ShoppingPage fetches products on mount and renders a list with an "Order" button for each one. After a successful order it shows role=status text "Order placed" for that product, and on failure it shows a role=alert message. Styling is Tailwind, as in the existing pages. App.tsx routes /shop to ShoppingPage inside AuthProvider, and shows SignInPage when the user is signed out. The signed-in Shell gets a "Shop" link to /shop.
    files:
      - apps/web/src/shop/shopClient.ts
      - apps/web/src/shop/ShoppingPage.tsx
      - apps/web/src/App.tsx
    rationale: |
      App.tsx already does pathname-based routing with no router library, so /shop follows the same pattern and no new dependency is needed.
  - description: |
      Tests, written first (see tests). API unit and e2e tests, web component tests and a Playwright e2e test.
    files:
      - services/api/src/shop/shop.service.spec.ts
      - services/api/test/shop.e2e-spec.ts
      - apps/web/src/shop/ShoppingPage.test.tsx
      - apps/web/src/App.test.tsx
      - apps/web/e2e/shop.spec.ts
    rationale: |
      TDD per the acceptance criterion. Uses jest and supertest for the API, and vitest and playwright for the web app, as the confirmed stack says.
tests:
  - |
    API unit, services/api/src/shop/shop.service.spec.ts. Write it first, and it fails because ShopService does not exist.
    ```ts
    const order = await service.placeOrder(user.id, iphone.id);
    expect(order).toMatchObject({ userId: user.id, productId: iphone.id, status: 'placed' });
    await expect(service.placeOrder(user.id, 'missing-id')).rejects.toBeInstanceOf(ProductNotFoundError);
    ```
  - |
    API e2e (AC1), services/api/test/shop.e2e-spec.ts. It seeds an available iPhone product, signs in with the fake Cognito as auth.e2e-spec.ts does, then orders it.
    ```ts
    const res = await agent.post('/orders').send({ productId: iphone.id });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ productId: iphone.id, status: 'placed' });
    expect(await ds.getRepository(Order).countBy({ productId: iphone.id })).toBe(1);
    // unauthenticated
    await request(app.getHttpServer()).post('/orders').send({ productId: iphone.id }).expect(401);
    ```
  - |
    Web component (AC1), apps/web/src/shop/ShoppingPage.test.tsx. It mocks ./shopClient, lists an iPhone, clicks Order and expects the order to be placed.
    ```tsx
    vi.mocked(client.listProducts).mockResolvedValue([{ id: "p1", name: "iPhone 16", priceCents: 79900 }]);
    vi.mocked(client.placeOrder).mockResolvedValue({ ok: true, orderId: "o1" });
    render(<ShoppingPage />);
    await userEvent.click(await screen.findByRole("button", { name: /order iphone 16/i }));
    expect(client.placeOrder).toHaveBeenCalledWith("p1");
    expect(await screen.findByRole("status")).toHaveTextContent("Order placed");
    ```
  - |
    Web routing, App.test.tsx. With a session present, /shop renders the shopping page.
    ```tsx
    window.history.pushState({}, "", "/shop");
    vi.mocked(client.getSession).mockResolvedValue({ email: "ada@example.com" });
    render(<App />);
    expect(await screen.findByRole("heading", { name: /shop/i })).toBeInTheDocument();
    ```
  - |
    Playwright, apps/web/e2e/shop.spec.ts. It stubs /auth/session, /products and /orders with page.route, as auth.spec.ts does, goes to /shop, clicks the Order button and expects "Order placed" to be visible.
    ```ts
    await page.getByRole("button", { name: /order iphone/i }).click();
    await expect(page.getByText("Order placed")).toBeVisible();
    ```
assumptions_or_open_questions:
  - |
    The repo has no shopping page, catalogue or order model, so this story creates them. Product management (admin CRUD), payment, stock levels, quantity selection, shipping address, order history and cart are out of scope. Please confirm that a minimal "place order" record is enough for "the iPhone order is placed".
  - |
    Ordering requires a signed-in user, reusing the existing cookie session. If guests should be able to order, the guard and the userId column would change.
  - |
    Any product in the catalogue can be ordered. "iPhone" is identified by the product data (for example name or category), with no iPhone-specific code path. The e2e test seeds its own iPhone product.
  - |
    No production product data exists yet. The deployed catalogue needs its iPhone product seeded or inserted by whoever operates the system (see Data & rollout).
estimated_points: 5
package_dependencies: []
notes: |
  ### Data & rollout
  - **Existing data**: two new tables, `products` and `orders`. No existing table or row is altered, so existing users and sessions are unaffected.
  - **Backfill / seed**: no backfill. The shopping page needs at least one available iPhone product row to show anything. The plan does not add a production seed. Tests insert their own fixtures, and the open questions ask the reviewer whether a seed script is wanted.
  - **Settings**: none. No new env vars.
  - **Provisioning**: the tables come from TypeORM `synchronize`, which app.module.ts enables outside production. The repo has no migration setup, so production schema creation is an existing project gap. Production needs the two tables created, by whatever mechanism the project adopts, before deploying.
  - **Order and rollback**: create the tables, then deploy the API, then the web app. Rollback is safe by leaving the tables in place, because older code ignores them. The new routes are purely additive.

  ```mermaid
  flowchart TD
    App[App.tsx] --> SP[ShoppingPage.tsx]
    SP --> SC[shopClient.ts]
    SC -->|GET /products, POST /orders| SCtl[shop.controller.ts]
    SCtl --> Guard[session.guard.ts]
    SCtl --> SSvc[shop.service.ts]
    SSvc --> Ent[Product and Order entities]
    SM[shop.module.ts] --> AM[auth.module.ts]
    APM[app.module.ts] --> SM
    classDef touched fill:#f96,color:#000
    class App,SP,SC,SCtl,SSvc,Ent,SM,APM touched
  ```
  Touched nodes are the ones this plan creates or edits. session.guard.ts and auth.module.ts are untouched context that is reused.
review_focus: |
  IN scope is only the order path: Product and Order entities, GET /products, POST /orders, and the /shop page with an Order button. Payment, inventory, quantity, cart, order history and admin tooling are OUT. The riskiest areas are that the repo has no migrations, so production tables rely on TypeORM synchronize being run another way, and that the story assumes a signed-in user. Treat the absence of an iPhone-specific code path as deliberate, since the catalogue data decides what is an iPhone.
