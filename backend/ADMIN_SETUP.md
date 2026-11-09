# Admin features setup

1. Make sure the original application tables (`licores`, `mesas`, `reservas`, `categorias`, `proveedores`, `empleados`, `promociones`, `kardex`, `facturas`, and `reseñas`) already exist. These repository migrations extend the original schema; they do not recreate or delete those tables.
2. In the Supabase SQL Editor, apply the repository migrations in this order:
   - `migrations/20261106_create_solicitudes_ayuda.sql`
   - `migrations/20261106_add_promo_image.sql`
   - `migrations/20261107_add_client_store_features.sql`
   - `migrations/20261107_add_admin_operations.sql`
   - `migrations/20261107_add_customer_experience.sql`
   - `migrations/20261107_add_customer_profiles.sql`
   - `migrations/20261108_create_business_settings.sql`
   - `migrations/20261108_add_promotion_price.sql`
   - `migrations/20261108_promotion_order_stock.sql`
3. Set `SUPABASE_URL`, the public `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_EMAIL` in the backend `.env`. The service-role key is required for server-side admin operations and RLS-protected writes. Never expose it to the frontend or commit it.
4. Enable email/password sign-in in Supabase Auth and restart the backend.
5. Open `/admin`, create an account using the exact `ADMIN_EMAIL`, and confirm the email if Supabase requires it. That address is the bootstrap administrator.
6. From **Personal y roles**, add each employee's email and role. Employees can then create accounts with that email; the backend checks their role on every protected API request.

Business information is stored in `business_settings` and served publicly via
the backend; only roles with the `configuracion` permission can change it.
After applying the migration and deploying the backend and frontend, open
**Configuración** and save the desired details. Earlier settings were stored
only in each browser and are not migrated automatically; copy those values
from the original browser if needed. Other devices refresh within 30 seconds
or when the tab regains focus. The admin theme and a customer's chosen currency
remain browser preferences; changing currency does not convert amounts.

The admin panel shows pending orders, help requests and low stock for authorized
roles. Browser alerts can be enabled explicitly and require the admin page to
stay open; they are not background push notifications. The customer's order
tracker offers browser alerts while its page remains open. Price and restock
requests are recorded for staff to contact customers manually. Email delivery
and notifications after the page is closed require additional infrastructure
and are not configured by these features.

The storefront endpoints for catalog, reservations, reviews, promotions, and customer help remain public. Administrative endpoints require an authenticated Supabase session. Receiving a purchase updates product stock, Kardex, and any dated inventory lots in one database transaction. POS invoices automatically credit one loyalty point per whole currency unit.

The catalog and administrative changes use the backend API as their source of
truth. If the API is unreachable or rejects an operation, the application
reports the error rather than retrying writes directly against Supabase or
assuming an empty catalog. Configure `VITE_API_URL` for the published frontend
and deploy the backend changes as well as the frontend.

The client-experience migration adds live reservation statuses, product-promotion links, expiration dates, and a queue of restock-interest requests. Staff can review those requests in **Alertas** and contact customers manually; sending email/SMS notifications requires a separately configured provider.

The customer-experience migration adds reward accounts, promo codes, gift cards, and order fields used by the customer account and checkout. Run the migrations in the same Supabase project referenced by the backend `.env`; a local migration file is not applied automatically.

In **Promociones**, manage public promotions and separately manage private
discount and gift-card codes. Customers enter those codes at checkout; gift-card
codes must be shared privately. Expired or inactive public promotions are not
displayed in the storefront. Codes already referenced by an order cannot be
deleted; deactivate them instead to preserve the order history and refunds.
Editing a gift-card balance replaces the current remaining balance, and is
rejected if that balance has changed since the administrator opened the form.
Public promotions can be ordered in PEN when active, unexpired, priced and in
stock. Stock is independent of product inventory and defaults to zero on
existing promotions; set the price and stock in the admin panel. Orders reserve
stock transactionally in the database, and cancellation returns it. Orders with
promotions cannot have their items edited or be reactivated after cancellation;
create a new order instead. Codes can be applied to the order as usual.
Apply both promotion migrations before deploying the updated backend and
frontend. Existing promotions are not assigned a price or stock automatically.

Customer checkout uses **Continue with Google**. Configure it once in the same Supabase project used by the backend:

1. In Google Cloud Console, create an OAuth client ID for a web application. Add Supabase's callback URL, shown on the Supabase Google provider setup page, to **Authorized redirect URIs** (it normally ends in `/auth/v1/callback`).
2. In Supabase **Authentication → Providers → Google**, enable the provider and enter the Google client ID and client secret.
3. In Supabase **Authentication → URL Configuration**, set the app's site URL and add each frontend origin to the redirect allow list (for local Vite development, `http://localhost:5173`; also add the production URL when deployed).
4. Save the settings and restart/reload the frontend. SMS/Phone Auth and Twilio are not required for Google sign-in.

The customer account screen requests Google's account chooser at sign-in. To
switch accounts, first use **Cerrar sesión o cambiar de cuenta**, then sign in
again and choose the other Google account. Provider configuration and redirect
allow-list errors must still be corrected in Google Cloud and Supabase.

Customer checkout requires a verified Google identity (or an existing verified phone session) and `SUPABASE_SERVICE_ROLE_KEY` on the backend. Orders are associated with the authenticated Supabase user; the API, tracker, and database row-level security only return that user's orders. The app removes the previous shared-device local order history. Older orders without `client_user_id` cannot be attributed safely and will not appear in customer accounts.

The customer-profile migration creates the private `customer-avatars` Storage bucket. Customers can update their profile name and upload a JPG, PNG, or WebP avatar up to 3 MB from **Mi cuenta**. Storage policies limit each signed-in customer to files under their own user ID. The admin **Clientes** page and **Ventas y caja** show profile details only for customers with account-linked orders; those profile images use short-lived signed URLs.
