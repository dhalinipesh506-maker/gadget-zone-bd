# Gadget Zone BD

মোবাইল-ফার্স্ট বাংলাদেশি গ্যাজেট স্টোর --- HTML, CSS ও Vanilla JavaScript।
এতে আছে বাংলা হোমপেজ, ক্যাটাগরি ফিল্টার, সার্চ, কার্ট/quantity controls, COD
checkout এবং Supabase-ভিত্তিক পণ্য/অর্ডার সংযোগের প্রস্তুতি।

## ফাইল

-   `index.html` --- পেজের কাঠামো
-   `style.css` --- কালো-নীল responsive ডিজাইন
-   `app.js` --- পণ্য, সার্চ, কার্ট ও checkout
-   `README.md` --- এই নির্দেশনা

## ১. Android ফোনে চালানো (শুধু preview)

1.  চারটি ফাইল একই ফোল্ডারে রাখুন।
2.  Android-এ কোনো কোড এডিটর/HTML preview অ্যাপ দিয়ে `index.html` খুলুন।
    `file://` preview-তে কিছু ব্রাউজার CDN বা Supabase request সীমিত করতে
    পারে।
3.  নির্ভরযোগ্য preview-এর জন্য HTTPS static hosting-এ deploy করুন। GitHub
    Pages-এর মতো static hosting ব্যবহার করা যায়; তবে real order তৈরি করতে
    Supabase সেটআপ আবশ্যক।
4.  পরিবর্তনের পর পেজ refresh করুন। বাস্তব গ্রাহকের ডেটা সংগ্রহের আগে privacy
    notice, support contact, delivery policy ও return/refund policy যোগ
    করুন।

## ২. Supabase সেটআপ

1.  Supabase-এ নতুন project তৈরি করুন এবং Project URL ও **publishable/anon
    public key** নিন।
2.  `app.js`-এ `SUPABASE_URL` ও `SUPABASE_ANON_KEY` বসান। Frontend-এ শুধু
    public key রাখা যাবে। **কখনো `service_role` key, database password,
    payment gateway secret বা অন্য secret frontend-এ দেবেন না।**
3.  Supabase SQL Editor-এ নিচের SQL চালিয়ে products টেবিল তৈরি করুন। শুরুতে
    নিজের পরীক্ষামূলক পণ্য যোগ করুন।

``` sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('Mobile','Earbuds','Chargers','Smartwatches')),
  price numeric(12,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  description text not null default '',
  emoji text not null default '📦',
  badge text not null default 'গ্যাজেট',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
create policy "Public can read active products"
on public.products for select to anon, authenticated
using (active = true);
```

Product listing-এর জন্য public read access যথেষ্ট। Public browser-কে
products insert/update/delete অনুমতি দেবেন না; catalog changes dashboard
বা trusted admin backend দিয়ে করুন।

## ৩. নিরাপদ COD order creation (Edge Function আবশ্যক)

এই frontend অর্ডার পাঠায় `create-cod-order` নামের Supabase Edge
Function-এ। **Function deploy না করা পর্যন্ত checkout বাস্তবে অর্ডার সংরক্ষণ
করবে না**---এটি ইচ্ছাকৃত; ভুয়া success দেখানো হয় না। Function-কে অবশ্যই: -
JSON input validate করতে হবে; নাম, বাংলাদেশি ফোন, ঠিকানা, product IDs ও
quantity সীমা যাচাই করতে হবে। - Browser থেকে পাঠানো price/total কখনো
বিশ্বাস করা যাবে না। `products` table থেকে বর্তমান price ও stock পড়ে
server-side total হিসাব করতে হবে। - Database transaction/RPC দিয়ে stock
যাচাই, stock decrement ও order creation atomicভাবে করতে হবে; একই সময়ে
আসা order-এ overselling ঠেকাতে হবে। - `payment_method='cod'` এবং
`payment_status='unpaid'` server-side সেট করতে হবে। Client যেন order
status বা payment status নিজে বেছে নিতে না পারে। - `service_role` secret
শুধু Supabase Edge Function secrets-এ রাখতে হবে; frontend-এ নয়। - Rate
limit / abuse protection, input size limit এবং উপযুক্ত error handling যোগ
করতে হবে। গ্রাহকের ঠিকানা/ফোন অপ্রয়োজনীয়ভাবে log করবেন না।

প্রস্তাবিত টেবিলের কাঠামো (production-এ migration ও transaction/RPC ডিজাইন
যাচাই করে নিন):

``` sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null,
  customer_address text not null check (char_length(customer_address) between 8 and 500),
  payment_method text not null check (payment_method = 'cod'),
  payment_status text not null default 'unpaid' check (payment_status = 'unpaid'),
  order_status text not null default 'pending' check (order_status in ('pending','confirmed','shipped','delivered','cancelled')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 20)
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
-- Do not add public INSERT/SELECT policies for orders/order_items.
-- Edge Function using server-side credentials writes them after validation.
```

Function-এ `orders` ও `order_items` একসাথে এবং stock update
transaction-এ সম্পন্ন করুন। PostgreSQL function/RPC ব্যবহার করলে atomic
transaction করা সহজ হয়। Function সফল হলে JSON response দিন:
`{ "success": true, "order_id": "<created-order-uuid>" }` কোনো order
তৈরি না হলে `success: true` পাঠাবেন না।

Supabase CLI ব্যবহার করে Edge Function deploy করুন (কম্পিউটার বা cloud
development environment লাগতে পারে):

``` bash
supabase functions new create-cod-order
# function source লিখুন, secrets সেট করুন, তারপর:
supabase secrets set SERVICE_ROLE_KEY=YOUR_SERVER_SIDE_SERVICE_ROLE_KEY
supabase functions deploy create-cod-order
```

উপরের command-টি শুধু workflow দেখায়---সম্পূর্ণ function implementation,
atomic stock logic এবং validation না লিখে deploy করবেন না।
`SERVICE_ROLE_KEY`-এর আসল মান source control বা chat-এ রাখবেন না।
Supabase project URL ও public anon key গোপন secret নয়, কিন্তু database
security RLS/function validation-এর উপর নির্ভর করে।

## ৪. Payment gateway

এখন কেবল Cash on Delivery আছে। bKash/Nagad/card gateway যুক্ত করার সময়
gateway provider-এর অনুমোদিত merchant account ও server-side verification
flow ব্যবহার করুন। Browser থেকে "payment successful" ধরে নেবেন না। Order
paid হবে শুধু trusted server gateway verification/webhook সফল হলে। Gateway
secret কেবল Edge Function secrets-এ থাকবে।

## ৫. বাস্তব পণ্য ও অর্ডার

-   `app.js`-এর demo products শুধু UI preview; বাস্তব দাম/স্টক নয়। Supabase
    `products` টেবিলে ডেটা থাকলে সেগুলো লোড হবে।
-   লাইভ products schema-এর `category` মান অবশ্যই `Mobile`, `Earbuds`,
    `Chargers`, `Smartwatches` হতে হবে।
-   বর্তমান demo IDs UUID নয়, তাই live Supabase catalogue দিয়ে বদলে যাবে।
    Order Function শুধু database থেকে ফেরত পাওয়া real product UUID গ্রহণ
    করবে।
-   Delivery fee, order notification, customer order lookup, admin
    dashboard, privacy/terms এবং backup এখনো যোগ করতে হবে।

## ৬. Production checklist

-   [ ] Edge Function-এ input validation + atomic stock/order
    transaction
-   [ ] RLS পরীক্ষা; public order read/write নিষিদ্ধ
-   [ ] Live product pricing/stock যাচাই
-   [ ] HTTPS hosting ও domain
-   [ ] Privacy, delivery, cancellation/return policy
-   [ ] Test orders, rate limiting, monitoring ও backups
-   [ ] Payment gateway চালুর আগে provider approval + server verification
