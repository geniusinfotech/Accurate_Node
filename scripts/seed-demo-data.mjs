/**
 * Seeds a full set of demo data through the real REST API: website catalogue,
 * counter (shop) catalogue, customers, dealers and their ledgers, the
 * manufacturing chain (raw material -> work batches -> finished stock ->
 * worker payments), counter sales, and the website side (coupons, offers,
 * testimonials, banners, orders, shipping rules).
 *
 * Everything goes through the API rather than the database, so DTO validation,
 * the publish gates and the ledger side effects all run exactly as they do for
 * a real user.
 *
 * Re-running is safe for records that can be matched (products by SKU,
 * customers by phone, coupons by code...). Ledger, batch and sale rows have no
 * natural key and WILL be duplicated, so use ONLY= to pick steps:
 *
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... node scripts/seed-demo-data.mjs
 *   ONLY=web,ops SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... node scripts/seed-demo-data.mjs
 *
 * Steps: web, parties, mfg, shop, sales, ops
 */
import { readFile } from 'node:fs/promises';

const API = process.env.SEED_API_URL || 'http://localhost:9009';
const ORIGIN = process.env.SEED_ORIGIN || 'http://localhost:9008';
const EMAIL = process.env.SEED_ADMIN_EMAIL;
const PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error(
    'Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before running the seeder, e.g.\n' +
      '  SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=... node scripts/seed-demo-data.mjs',
  );
  process.exit(1);
}

let token = '';
const failures = [];
const created = {};

const money = (n) => Math.round(n * 100) / 100;
const daysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString();
const daysAhead = (d) => new Date(Date.now() + d * 86400000).toISOString();

/* Self-throttle: the API allows 100 requests / 60s (THROTTLE_LIMIT). */
const WINDOW_MS = 60000;
const MAX_IN_WINDOW = 85;
const stamps = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function throttle() {
  for (;;) {
    const now = Date.now();
    while (stamps.length && now - stamps[0] > WINDOW_MS) stamps.shift();
    if (stamps.length < MAX_IN_WINDOW) { stamps.push(now); return; }
    const wait = WINDOW_MS - (now - stamps[0]) + 250;
    console.log(`  … rate limit guard, waiting ${Math.ceil(wait / 1000)}s`);
    await sleep(wait);
  }
}

async function call(method, path, body, opts = {}) {
  await throttle();
  const headers = { Origin: ORIGIN };
  if (token && !opts.anon) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (res.status === 429 && !opts.retried) {
    console.log(`  … 429 on ${path}, backing off 62s`);
    await sleep(62000);
    stamps.length = 0;
    return call(method, path, body, { ...opts, retried: true });
  }
  if (!res.ok) {
    failures.push({ method, path, status: res.status, body: json, sent: body instanceof FormData ? '[multipart]' : body });
    console.log(`  ✗ ${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
    return null;
  }
  console.log(`  ✓ ${method} ${path} -> ${res.status}`);
  return json?.body !== undefined ? json.body : json;
}

const unwrapList = (r) => (Array.isArray(r) ? r : r?.data ?? r?.items ?? r?.products ?? r?.results ?? []);
const idOf = (o) => o?._id ?? o?.id;

async function login() {
  const r = await call('POST', '/auth/login', { email: EMAIL, password: PASSWORD });
  token = r?.access_token;
  if (!token) throw new Error('login failed');
  console.log('logged in as admin\n');
}

/* ------------------------------------------------------------------ */
/* 1. Website catalogue: categories + brands + products                */
/* ------------------------------------------------------------------ */
const WEB_CATEGORIES = [
  { name: 'Necklaces', slug: 'necklaces', description: 'Kundan, polki and temple necklace sets for weddings and festive wear.', showOnHomepage: true, homepageCoverImage: '/images/necklace-1.png' },
  { name: 'Earrings', slug: 'earrings', description: 'Jhumkas, chandbalis and everyday studs in gold and rose gold plating.', showOnHomepage: true, homepageCoverImage: '/images/earrings-1.png' },
  { name: 'Bangles & Bracelets', slug: 'bangles-bracelets', description: 'Kada, chudi sets and slim bracelets in antique and high-gold finish.', showOnHomepage: true, homepageCoverImage: '/images/bangle-1.png' },
  { name: 'Rings', slug: 'rings', description: 'Adjustable cocktail rings, finger rings and ring sets.', showOnHomepage: true, homepageCoverImage: '/images/ring-1.png' },
  { name: 'Bridal Sets', slug: 'bridal-sets', description: 'Complete bridal jewellery sets with necklace, earrings and maang tikka.', showOnHomepage: false, homepageCoverImage: '/images/necklace-2.png' },
];

const WEB_PRODUCTS = [
  { cat: 'necklaces', name: 'Meenakari Kundan Choker Set', sku: 'GLT-NEC-001', price: 2499, mrp: 3499, stock: 24, img: ['/images/necklace-1.png', '/images/necklace-2.png'], tags: ['kundan', 'bridal', 'festive'], occasion: ['Wedding', 'Festive'], flags: { isFeatured: true, isBestseller: true }, desc: 'Hand-set kundan stones on a meenakari base with pearl drops. Comes with matching earrings and an adjustable dori.', dims: { necklaceLength: '16 inch', weight: '120 g' }, mat: { baseMetal: 'Brass', plating: '22K Gold Plated' } },
  { cat: 'necklaces', name: 'Temple Lakshmi Long Haram', sku: 'GLT-NEC-002', price: 3299, mrp: 4599, stock: 12, img: ['/images/necklace-2.png'], tags: ['temple', 'south indian'], occasion: ['Wedding', 'Festive'], flags: { isPremium: true, isFeatured: true }, desc: 'South Indian temple haram with Lakshmi motifs and ruby-green stones. A statement piece for the sangeet and reception.', dims: { necklaceLength: '28 inch', weight: '210 g' }, mat: { baseMetal: 'Brass', plating: 'Antique Gold' } },
  { cat: 'necklaces', name: 'Rose Gold Pearl Layered Chain', sku: 'GLT-NEC-003', price: 1199, mrp: 1799, stock: 40, img: ['/images/necklace-1.png'], tags: ['office wear', 'minimal'], occasion: ['Everyday', 'Party Wear'], flags: { isNewArrival: true }, desc: 'Two-layer rose gold chain with freshwater-look pearls. Light enough for all-day office wear.', dims: { necklaceLength: '18 inch', weight: '45 g' }, mat: { baseMetal: 'Alloy', plating: 'Rose Gold' } },
  { cat: 'earrings', name: 'Peacock Jhumka Earrings', sku: 'GLT-EAR-001', price: 899, mrp: 1399, stock: 60, img: ['/images/earrings-1.png', '/images/earrings-2.png'], tags: ['jhumka', 'festive'], occasion: ['Festive', 'Party Wear'], flags: { isBestseller: true, isNewArrival: true }, desc: 'Classic peacock jhumkas with pearl fringe and a secure screw-back closure.', dims: { earringDrop: '2.5 inch', weight: '28 g' }, mat: { baseMetal: 'Brass', plating: 'Gold Plated' } },
  { cat: 'earrings', name: 'Chandbali Mirror Work Earrings', sku: 'GLT-EAR-002', price: 749, mrp: 1099, stock: 55, img: ['/images/earrings-2.png'], tags: ['chandbali', 'mirror'], occasion: ['Party Wear'], flags: { isFeatured: true }, desc: 'Half-moon chandbalis with real mirror work and oxidised silver finish.', dims: { earringDrop: '3 inch', weight: '32 g' }, mat: { baseMetal: 'Alloy', plating: 'Oxidised Silver' } },
  { cat: 'earrings', name: 'Everyday Zircon Stud Pair', sku: 'GLT-EAR-003', price: 399, mrp: 699, stock: 120, img: ['/images/earrings-1.png'], tags: ['studs', 'daily'], occasion: ['Everyday'], flags: { isNewArrival: true }, desc: 'Hypoallergenic zircon studs that stay bright with daily wear.', dims: { earringDrop: '0.5 inch', weight: '6 g' }, mat: { baseMetal: 'Stainless Steel', plating: 'Rhodium' } },
  { cat: 'bangles-bracelets', name: 'Antique Kada Pair (2.6)', sku: 'GLT-BAN-001', price: 1599, mrp: 2299, stock: 18, img: ['/images/bangle-1.png', '/images/bangle-2.png'], tags: ['kada', 'bridal'], occasion: ['Wedding'], flags: { isFeatured: true }, desc: 'Broad antique kada pair with kundan centre and enamel detailing.', dims: { bangleDiameter: '2.6 inch', weight: '160 g' }, mat: { baseMetal: 'Brass', plating: 'Antique Gold' } },
  { cat: 'bangles-bracelets', name: 'Rose Gold Charm Bracelet', sku: 'GLT-BAN-002', price: 649, mrp: 999, stock: 70, img: ['/images/bangle-2.png'], tags: ['bracelet', 'gift'], occasion: ['Everyday', 'Party Wear'], flags: { isNewArrival: true, isBestseller: true }, desc: 'Adjustable chain bracelet with heart and evil-eye charms. Packs well as a gift.', dims: { weight: '18 g' }, mat: { baseMetal: 'Alloy', plating: 'Rose Gold' } },
  { cat: 'rings', name: 'Adjustable Polki Cocktail Ring', sku: 'GLT-RNG-001', price: 549, mrp: 899, stock: 85, img: ['/images/ring-1.png'], tags: ['ring', 'polki'], occasion: ['Party Wear', 'Festive'], flags: { isBestseller: true }, desc: 'Free-size polki statement ring that adjusts from size 12 to 18.', dims: { weight: '12 g' }, mat: { baseMetal: 'Brass', plating: 'Gold Plated' } },
  { cat: 'rings', name: 'Oxidised Silver Boho Ring Set', sku: 'GLT-RNG-002', price: 449, mrp: 799, stock: 95, img: ['/images/ring-2.png'], tags: ['ring set', 'boho'], occasion: ['Everyday'], flags: { isNewArrival: true }, desc: 'Set of five stackable oxidised rings in mixed motifs.', dims: { weight: '22 g' }, mat: { baseMetal: 'Alloy', plating: 'Oxidised Silver' } },
  { cat: 'bridal-sets', name: 'Complete Bridal Set - Ruby Red', sku: 'GLT-BRD-001', price: 6499, mrp: 8999, stock: 6, img: ['/images/necklace-2.png', '/images/earrings-2.png'], tags: ['bridal', 'combo'], occasion: ['Wedding'], flags: { isPremium: true, isCombo: true, isFeatured: true }, desc: 'Necklace, chandbali earrings, maang tikka and a pair of kadas in ruby-red stones.', dims: { necklaceLength: '17 inch', weight: '480 g' }, mat: { baseMetal: 'Brass', plating: '22K Gold Plated' } },
  { cat: 'bridal-sets', name: 'Pastel Polki Engagement Set', sku: 'GLT-BRD-002', price: 4799, mrp: 6499, stock: 9, img: ['/images/necklace-1.png'], tags: ['engagement', 'polki'], occasion: ['Wedding', 'Party Wear'], flags: { isCombo: true, isNewArrival: true }, desc: 'Pastel-toned polki set with soft pink and mint stones for engagements and roka.', dims: { necklaceLength: '15 inch', weight: '260 g' }, mat: { baseMetal: 'Brass', plating: 'Rose Gold' } },
];

async function seedWebsiteCatalogue() {
  console.log('— website categories —');
  created.webCategories = {};
  const existing = unwrapList(await call('GET', '/categories'));
  for (const c of WEB_CATEGORIES) {
    const hit = existing.find((e) => e.slug === c.slug);
    if (hit) { created.webCategories[c.slug] = idOf(hit); console.log(`  = category ${c.slug} exists`); continue; }
    const r = await call('POST', '/categories', c);
    if (r) created.webCategories[c.slug] = idOf(r);
  }

  console.log('— website brand —');
  const brands = unwrapList(await call('GET', '/brands'));
  let brand = brands.find((b) => b.code === 'GLITERA');
  if (!brand) brand = await call('POST', '/brands', { name: 'Glitera Jewels', code: 'GLITERA' });
  created.webBrand = idOf(brand);

  console.log('— website products —');
  created.webProducts = [];
  // includeUnpublished, or a product still pending review looks missing and the
  // re-run collides on its SKU.
  const existingProducts = unwrapList(
    await call('GET', '/products?limit=300&includeUnpublished=true'),
  );
  for (const p of WEB_PRODUCTS) {
    const hit = existingProducts.find((e) => e.sku === p.sku);
    if (hit) { created.webProducts.push({ id: idOf(hit), sku: hit.sku, name: hit.name, status: hit.status }); console.log(`  = product ${p.sku} exists`); continue; }
    const categoryId = created.webCategories[p.cat];
    if (!categoryId) { failures.push({ note: `missing category ${p.cat} for ${p.sku}` }); continue; }
    const dto = {
      categoryId,
      brandId: created.webBrand,
      name: p.name,
      sku: p.sku,
      price: p.price,
      mrp: p.mrp,
      discountPercent: Math.round(((p.mrp - p.price) / p.mrp) * 100),
      stock: p.stock,
      images: p.img,
      description: p.desc,
      tags: p.tags,
      occasion: p.occasion,
      material: p.mat,
      dimensions: p.dims,
      isHypoallergenic: true,
      warranty: '6 months on plating',
      status: 'pending',
      isActive: true,
      ...p.flags,
    };
    const r = await call('POST', '/products', dto);
    if (r) created.webProducts.push({ id: idOf(r), sku: p.sku, name: p.name });
  }

  // A product can only go live when it is traceable to a finished-stock record,
  // so mint the finished stock first and then publish against it.
  console.log('— publish website products from finished stock —');
  const lots = ['LOT-BR-2601', 'LOT-BS-2602', 'LOT-WM-2603'];
  const toPublish = created.webProducts.filter((p) => p.status !== 'published').slice(0, 11);
  for (let i = 0; i < toPublish.length; i++) {
    const wp = toPublish[i];
    const stock = await call('POST', '/manufacturing/semi-finished-stock', {
      stage: 'packing',
      quantity: 20 + i * 5,
      lotId: lots[i % lots.length],
      status: 'completed',
    });
    if (!stock) continue;
    await call('PUT', `/products/${wp.id}`, {
      status: 'published',
      sourceStockId: idOf(stock),
    });
  }
}

/* ------------------------------------------------------------------ */
/* 2. Offline shop catalogue (POS)                                     */
/* ------------------------------------------------------------------ */
const SHOP_CATEGORIES = [
  { name: 'Counter Necklaces', slug: 'counter-necklaces', description: 'Necklace stock kept at the front counter.' },
  { name: 'Counter Earrings', slug: 'counter-earrings', description: 'Jhumka and stud trays.' },
  { name: 'Counter Bangles', slug: 'counter-bangles', description: 'Bangle and kada boxes by size.' },
  { name: 'Wholesale Lots', slug: 'wholesale-lots', description: 'Bulk packs sold to retailers by the dozen.' },
];

const SHOP_PRODUCTS = [
  { cat: 'counter-necklaces', name: 'Counter Kundan Choker', sku: 'SHP-NEC-101', price: 1450, purchaseRate: 980, mrp: 1899, stock: 36 },
  { cat: 'counter-necklaces', name: 'Counter Pearl Mala', sku: 'SHP-NEC-102', price: 780, purchaseRate: 520, mrp: 1099, stock: 48 },
  { cat: 'counter-necklaces', name: 'Counter Temple Haram', sku: 'SHP-NEC-103', price: 2250, purchaseRate: 1600, mrp: 2999, stock: 14 },
  { cat: 'counter-earrings', name: 'Counter Jhumka Small', sku: 'SHP-EAR-101', price: 320, purchaseRate: 190, mrp: 499, stock: 140 },
  { cat: 'counter-earrings', name: 'Counter Jhumka Large', sku: 'SHP-EAR-102', price: 560, purchaseRate: 360, mrp: 799, stock: 90 },
  { cat: 'counter-earrings', name: 'Counter Zircon Studs', sku: 'SHP-EAR-103', price: 210, purchaseRate: 120, mrp: 349, stock: 200 },
  { cat: 'counter-bangles', name: 'Counter Kada 2.4', sku: 'SHP-BAN-101', price: 980, purchaseRate: 640, mrp: 1399, stock: 26 },
  { cat: 'counter-bangles', name: 'Counter Kada 2.6', sku: 'SHP-BAN-102', price: 980, purchaseRate: 640, mrp: 1399, stock: 22 },
  { cat: 'counter-bangles', name: 'Counter Chudi Set 12pc', sku: 'SHP-BAN-103', price: 1550, purchaseRate: 1050, mrp: 2099, stock: 18 },
  { cat: 'wholesale-lots', name: 'Wholesale Jhumka Dozen', sku: 'SHP-WHL-101', price: 2800, purchaseRate: 2100, mrp: 3600, stock: 30 },
  { cat: 'wholesale-lots', name: 'Wholesale Chain Dozen', sku: 'SHP-WHL-102', price: 3400, purchaseRate: 2600, mrp: 4200, stock: 25 },
  { cat: 'wholesale-lots', name: 'Wholesale Ring Gross', sku: 'SHP-WHL-103', price: 5200, purchaseRate: 3900, mrp: 6500, stock: 10 },
];

async function seedShopCatalogue() {
  console.log('— shop categories —');
  created.shopCategories = {};
  const existing = unwrapList(await call('GET', '/shop-categories'));
  for (const c of SHOP_CATEGORIES) {
    const hit = existing.find((e) => e.slug === c.slug);
    if (hit) { created.shopCategories[c.slug] = idOf(hit); console.log(`  = shop category ${c.slug} exists`); continue; }
    const r = await call('POST', '/shop-categories', { ...c, isActive: true, showOnHomepage: false });
    if (r) created.shopCategories[c.slug] = idOf(r);
  }

  console.log('— shop brand —');
  const brands = unwrapList(await call('GET', '/shop-brands'));
  let brand = brands.find((b) => b.code === 'COUNTER');
  if (!brand) brand = await call('POST', '/shop-brands', { name: 'Counter Stock', code: 'COUNTER' });
  created.shopBrand = idOf(brand);

  console.log('— shop products —');
  created.shopProducts = [];
  const existingProducts = unwrapList(await call('GET', '/shop-products?includeUnpublished=true&limit=500'));
  for (const p of SHOP_PRODUCTS) {
    const hit = existingProducts.find((e) => e.sku === p.sku);
    if (hit) { created.shopProducts.push({ id: idOf(hit), ...p }); console.log(`  = shop product ${p.sku} exists`); continue; }
    const shopCategoryId = created.shopCategories[p.cat];
    if (!shopCategoryId) { failures.push({ note: `missing shop category ${p.cat}` }); continue; }
    const r = await call('POST', '/shop-products', {
      shopCategoryId,
      shopBrandId: created.shopBrand,
      name: p.name,
      sku: p.sku,
      price: p.price,
      purchaseRate: p.purchaseRate,
      mrp: p.mrp,
      stock: p.stock,
      status: 'pending',
      isActive: true,
    });
    if (r) created.shopProducts.push({ id: idOf(r), ...p });
  }

  // Publishing a shop product requires a finished-stock source (traceability gate).
  console.log('— publish shop products from finished stock —');
  const allStock = unwrapList(await call('GET', '/manufacturing/semi-finished-stock'));
  const publishable = allStock.filter((s) => ['ready', 'completed'].includes(s.status));
  for (let i = 0; i < publishable.length && i < created.shopProducts.length; i++) {
    const sp = created.shopProducts[i];
    await call('PUT', `/shop-products/${sp.id}`, {
      status: 'published',
      sourceStockId: idOf(publishable[i]),
    });
  }
}

/* ------------------------------------------------------------------ */
/* 3. Customers + dealers                                              */
/* ------------------------------------------------------------------ */
const CUSTOMERS = [
  { name: 'Rekha Traders', phone: '9824011111', address: 'Shop 14, Manek Chowk, Ahmedabad 380001', gstin: '24AABCR1234M1Z5', notes: 'Buys jhumkas in bulk every month.' },
  { name: 'Shreeji Jewellers', phone: '9824022222', address: '2nd Floor, Ring Road, Surat 395002', gstin: '24AACCS5678N1Z2', notes: 'Credit customer, settles every 30 days.' },
  { name: 'Priya Sharma', phone: '9824033333', address: 'B-402 Silver Heights, Vadodara 390007', notes: 'Retail walk-in, prefers rose gold.' },
  { name: 'Anjali Boutique', phone: '9824044444', address: 'Near Law Garden, Ahmedabad 380006', gstin: '24AAECA9012P1Z8' },
  { name: 'Meena Bhai Retail', phone: '9824055555', address: 'Station Road, Rajkot 360001' },
  { name: 'Kavita Fashion Hub', phone: '9824066666', address: 'Mota Bazar, Bhavnagar 364001', notes: 'Asks for combo packs.' },
];

const DEALERS = [
  { name: 'Ravi Metal Supply', phone: '9909011111', address: 'Industrial Estate, Rakhial, Ahmedabad', notes: 'Brass sheet and wire supplier.' },
  { name: 'Gujarat Stone House', phone: '9909022222', address: 'Zaveri Bazar Lane 3, Surat', notes: 'Kundan and CZ stones.' },
  { name: 'Maruti Plating Works', phone: '9909033333', address: 'GIDC Phase 2, Vatva', notes: 'Gold and rhodium plating job work.' },
  { name: 'Shakti Packaging', phone: '9909044444', address: 'Narol Cross Road, Ahmedabad', notes: 'Boxes, pouches and cards.' },
];

async function seedParties() {
  console.log('— customers —');
  created.customers = [];
  const existing = unwrapList(await call('GET', '/customers?limit=200'));
  for (const c of CUSTOMERS) {
    const hit = existing.find((e) => e.phone === c.phone);
    if (hit) { created.customers.push(hit); console.log(`  = customer ${c.phone} exists`); continue; }
    const r = await call('POST', '/customers', c);
    if (r) created.customers.push(r);
  }

  console.log('— dealers —');
  created.dealers = [];
  const existingD = unwrapList(await call('GET', '/dealers'));
  for (const d of DEALERS) {
    const hit = existingD.find((e) => e.name === d.name);
    if (hit) { created.dealers.push(hit); console.log(`  = dealer ${d.name} exists`); continue; }
    const r = await call('POST', '/dealers', { ...d, isActive: true });
    if (r) created.dealers.push(r);
  }

  console.log('— dealer ledger entries —');
  const entries = [
    { i: 0, type: 'purchase', amount: 48500, mode: 'credit', notes: 'Brass sheet 25 kg', date: daysAgo(40) },
    { i: 0, type: 'payment', amount: 30000, mode: 'bank', notes: 'Part payment NEFT', date: daysAgo(25) },
    { i: 1, type: 'purchase', amount: 72000, mode: 'credit', notes: 'Kundan stones assorted', date: daysAgo(35) },
    { i: 1, type: 'payment', amount: 72000, mode: 'upi', notes: 'Full settlement', date: daysAgo(12) },
    { i: 2, type: 'purchase', amount: 18500, mode: 'credit', notes: 'Gold plating job work - 3 lots', date: daysAgo(20) },
    { i: 3, type: 'purchase', amount: 9600, mode: 'cash', notes: 'Gift boxes 500 pcs', date: daysAgo(8) },
    { i: 3, type: 'payment', amount: 5000, mode: 'cash', notes: 'Advance against boxes', date: daysAgo(5) },
  ];
  for (const e of entries) {
    const dealer = created.dealers[e.i];
    if (!dealer) continue;
    await call('POST', `/dealers/${idOf(dealer)}/ledger`, {
      type: e.type, amount: e.amount, mode: e.mode, notes: e.notes, date: e.date,
    });
  }
}

/* ------------------------------------------------------------------ */
/* 4. Manufacturing: raw material -> workers -> batches -> stock       */
/* ------------------------------------------------------------------ */
async function seedManufacturing() {
  console.log('— raw materials —');
  created.rawMaterials = [];
  const rms = [
    { materialName: 'Brass Wire 0.8mm', quantity: 25, pricePerKg: 640, lotId: 'LOT-BR-2601', dealerIdx: 0, reference: 'INV-8841', purchaseDate: daysAgo(40), notes: 'For chain making' },
    { materialName: 'Brass Sheet 22G', quantity: 18, pricePerKg: 690, lotId: 'LOT-BS-2602', dealerIdx: 0, reference: 'INV-8867', purchaseDate: daysAgo(30) },
    { materialName: 'White Metal Alloy', quantity: 30, pricePerKg: 415, lotId: 'LOT-WM-2603', dealerIdx: 0, reference: 'INV-8902', purchaseDate: daysAgo(18) },
    { materialName: 'Kundan Stones Mixed', quantity: 4, pricePerKg: 8200, lotId: 'LOT-KS-2604', dealerIdx: 1, reference: 'GS-1120', purchaseDate: daysAgo(35) },
    { materialName: 'CZ Stones 3mm', quantity: 2.5, pricePerKg: 11500, lotId: 'LOT-CZ-2605', dealerIdx: 1, reference: 'GS-1145', purchaseDate: daysAgo(10) },
  ];
  for (const rm of rms) {
    const dealer = created.dealers[rm.dealerIdx];
    const dto = {
      materialName: rm.materialName,
      quantity: rm.quantity,
      pricePerKg: rm.pricePerKg,
      totalAmount: money(rm.quantity * rm.pricePerKg),
      lotId: rm.lotId,
      reference: rm.reference,
      purchaseDate: rm.purchaseDate,
      ...(rm.notes ? { notes: rm.notes } : {}),
      ...(dealer ? { dealerId: idOf(dealer), dealerName: dealer.name } : {}),
    };
    const r = await call('POST', '/manufacturing/raw-materials', dto);
    if (r) created.rawMaterials.push(r);
  }

  console.log('— workers —');
  created.workers = [];
  const workers = [
    { name: 'Ramesh Chauhan', phone: '9712011111', type: 'chain', rateConfig: { perKg: 180 }, status: 'active' },
    { name: 'Suresh Parmar', phone: '9712022222', type: 'chain', rateConfig: { perKg: 165 }, status: 'active' },
    { name: 'Dinesh Vaghela', phone: '9712033333', type: 'polish', rateConfig: { perKg: 120 }, status: 'active' },
    { name: 'Geeta Ben', phone: '9712044444', type: 'packing', rateConfig: { perPcs: 4.5 }, status: 'active' },
    { name: 'Nita Ben', phone: '9712055555', type: 'packing', rateConfig: { perPcs: 5 }, status: 'active' },
    { name: 'Kiran Solanki', phone: '9712066666', type: 'refine', rateConfig: { perKg: 260 }, status: 'active' },
  ];
  const existingW = unwrapList(await call('GET', '/manufacturing/workers'));
  for (const w of workers) {
    const hit = existingW.find((e) => e.phone === w.phone);
    if (hit) { created.workers.push(hit); console.log(`  = worker ${w.phone} exists`); continue; }
    const r = await call('POST', '/manufacturing/workers', w);
    if (r) created.workers.push(r);
  }

  const workerByType = (t) => created.workers.filter((w) => w.type === t);

  console.log('— work batches —');
  created.batches = [];
  const chainWorkers = workerByType('chain');
  const polishWorkers = workerByType('polish');
  const packingWorkers = workerByType('packing');

  const batchPlan = [
    { stage: 'raw->chain', worker: chainWorkers[0], rm: 0, kg: 8, dateOut: daysAgo(34), notes: 'Chain making from brass wire' },
    { stage: 'raw->chain', worker: chainWorkers[1], rm: 0, kg: 6, dateOut: daysAgo(28), notes: 'Second lot chain' },
    { stage: 'raw->chain', worker: chainWorkers[0], rm: 2, kg: 10, dateOut: daysAgo(16), notes: 'White metal chain' },
    { stage: 'chain->polish', worker: polishWorkers[0], rm: null, kg: 7.4, dateOut: daysAgo(22), notes: 'Polish for lot BR-2601' },
    { stage: 'polish->packing', worker: packingWorkers[0], rm: null, kg: 7.1, pcs: 420, dateOut: daysAgo(14), notes: 'Packing 420 pcs' },
    { stage: 'polish->packing', worker: packingWorkers[1], rm: null, kg: 5.5, pcs: 300, dateOut: daysAgo(6), notes: 'Packing 300 pcs - in progress' },
  ];
  for (const b of batchPlan) {
    if (!b.worker) { failures.push({ note: `no worker for stage ${b.stage}` }); continue; }
    const dto = {
      stage: b.stage,
      workerId: idOf(b.worker),
      kgGivenOut: b.kg,
      dateOut: b.dateOut,
      assignNotes: b.notes,
      ...(b.pcs ? { pcsGivenOut: b.pcs } : {}),
      ...(b.rm !== null && created.rawMaterials[b.rm] ? { rawMaterialId: idOf(created.rawMaterials[b.rm]), lotId: created.rawMaterials[b.rm].lotId } : {}),
    };
    const r = await call('POST', '/manufacturing/work-batches', dto);
    if (r) created.batches.push(r);
  }

  console.log('— complete some batches —');
  const completions = [
    { i: 0, body: { date: daysAgo(26), weightReturned: 7.72, defectCount: 3, pcsReturned: 430, makingChargePerPcs: 0, totalMakingCharge: 1389.6, note: 'Loss 3.5%', isFinal: true } },
    { i: 1, body: { date: daysAgo(20), weightReturned: 5.78, defectCount: 2, pcsReturned: 320, totalMakingCharge: 953.7, note: 'Loss 3.7%', isFinal: true } },
    { i: 3, body: { date: daysAgo(15), weightReturned: 7.28, defectCount: 1, totalMakingCharge: 873.6, note: 'Polish done', isFinal: true } },
    { i: 4, body: { date: daysAgo(9), pcsReturned: 415, defectCount: 5, makingChargePerPcs: 4.5, totalMakingCharge: 1867.5, note: 'Packed and boxed', isFinal: true } },
  ];
  for (const c of completions) {
    const b = created.batches[c.i];
    if (!b) continue;
    await call('PATCH', `/manufacturing/work-batches/${idOf(b)}/complete`, c.body);
  }

  console.log('— semi finished stock —');
  created.semiStock = [];
  const semi = [
    { stage: 'chain', quantity: 7.72, lotId: 'LOT-BR-2601', status: 'ready', rm: 0 },
    { stage: 'polish', quantity: 7.28, lotId: 'LOT-BR-2601', status: 'completed', rm: 0 },
    { stage: 'chain', quantity: 5.78, lotId: 'LOT-BS-2602', status: 'ready', rm: 1 },
    { stage: 'packing', quantity: 415, lotId: 'LOT-BR-2601', status: 'completed', rm: 0 },
  ];
  for (const s of semi) {
    const dto = {
      stage: s.stage, quantity: s.quantity, lotId: s.lotId, status: s.status,
      ...(created.rawMaterials[s.rm] ? { rawMaterialId: idOf(created.rawMaterials[s.rm]) } : {}),
    };
    const r = await call('POST', '/manufacturing/semi-finished-stock', dto);
    if (r) created.semiStock.push(r);
  }

  console.log('— worker payments —');
  const payments = [
    { w: 0, b: 0, amountDue: 1389.6, amountPaid: 1389.6, mode: 'cash', date: daysAgo(25), remarks: 'Chain lot BR-2601' },
    { w: 1, b: 1, amountDue: 953.7, amountPaid: 700, mode: 'upi', date: daysAgo(19), remarks: 'Part payment' },
    { w: 2, b: 3, amountDue: 873.6, amountPaid: 873.6, mode: 'bank', date: daysAgo(14), remarks: 'Polish charges' },
    { w: 3, b: 4, amountDue: 1867.5, amountPaid: 1000, advance: 500, mode: 'cash', date: daysAgo(8), remarks: 'Packing, advance adjusted' },
    { w: 4, amountDue: 0, advance: 2000, amountPaid: 0, mode: 'cash', date: daysAgo(4), remarks: 'Festival advance' },
  ];
  for (const p of payments) {
    const worker = created.workers[p.w];
    if (!worker) continue;
    const batch = p.b !== undefined ? created.batches[p.b] : null;
    await call('POST', '/manufacturing/worker-payments', {
      workerId: idOf(worker),
      ...(batch ? { workBatchId: idOf(batch) } : {}),
      amountDue: p.amountDue,
      amountPaid: p.amountPaid,
      ...(p.advance ? { advance: p.advance } : {}),
      mode: p.mode,
      date: p.date,
      remarks: p.remarks,
    });
  }
}

/* ------------------------------------------------------------------ */
/* 5. Counter sales + customer ledger                                  */
/* ------------------------------------------------------------------ */
async function seedSales() {
  console.log('— counter sales —');
  created.sales = [];
  let sp = created.shopProducts;
  if (!sp?.length) {
    sp = unwrapList(await call('GET', '/shop-products?includeUnpublished=true&limit=500'))
      .map((p) => ({ id: idOf(p), sku: p.sku, name: p.name, price: p.price }));
  }
  if (!sp?.length) { console.log('  no shop products, skipping sales'); return; }
  const pick = (sku) => sp.find((p) => p.sku === sku);
  if (!created.customers?.length) {
    const all = unwrapList(await call('GET', '/customers?limit=200'));
    created.customers = CUSTOMERS.map((c) => all.find((e) => e.phone === c.phone)).filter(Boolean);
  }

  const plan = [
    { cust: 0, mode: 'cash', days: 30, items: [['SHP-EAR-101', 12], ['SHP-NEC-102', 4]], discount: 200, freight: 0, paidFull: true },
    { cust: 1, mode: 'credit', days: 26, items: [['SHP-WHL-101', 3], ['SHP-WHL-102', 2]], discount: 500, freight: 350, paid: 8000 },
    { cust: 2, mode: 'upi', days: 21, items: [['SHP-WHL-102', 1], ['SHP-EAR-103', 6]], discount: 0, freight: 0, paidFull: true },
    { cust: 3, mode: 'card', days: 17, items: [['SHP-NEC-101', 5], ['SHP-BAN-101', 3]], discount: 300, freight: 120, paidFull: true },
    { cust: 1, mode: 'credit', days: 12, items: [['SHP-NEC-103', 2], ['SHP-BAN-103', 4]], discount: 250, freight: 200, paid: 3000 },
    { cust: 4, mode: 'cash', days: 8, items: [['SHP-EAR-102', 10]], discount: 150, freight: 0, paidFull: true },
    { cust: 5, mode: 'credit', days: 5, items: [['SHP-BAN-102', 6], ['SHP-EAR-101', 20]], discount: 400, freight: 250, paid: 2000 },
    { cust: 2, mode: 'upi', days: 2, items: [['SHP-WHL-103', 1], ['SHP-NEC-102', 3]], discount: 0, freight: 100, paidFull: true },
  ];

  for (const s of plan) {
    const items = [];
    for (const [sku, qty] of s.items) {
      const p = pick(sku);
      if (!p) { failures.push({ note: `sale references unknown sku ${sku}` }); continue; }
      items.push({ productId: p.id, name: p.name, sku: p.sku, quantity: qty, price: p.price });
    }
    if (!items.length) continue;
    const gross = items.reduce((a, i) => a + i.quantity * i.price, 0);
    const net = money(gross - (s.discount || 0) + (s.freight || 0));
    const customer = created.customers[s.cust];
    const dto = {
      paymentMode: s.mode,
      customerName: customer?.name,
      phone: customer?.phone,
      discount: s.discount || 0,
      freight: s.freight || 0,
      amountPaid: s.paidFull ? net : s.paid,
      saleDate: daysAgo(s.days),
      notes: s.mode === 'credit' ? 'Credit bill, balance to be settled.' : 'Counter sale.',
      items,
    };
    const r = await call('POST', '/sales', dto);
    if (r) created.sales.push(r);
  }

  console.log('— customer ledger payments —');
  const ledger = [
    { cust: 1, amount: 5000, mode: 'upi', days: 10, notes: 'Against credit bill' },
    { cust: 1, amount: 3000, mode: 'cash', days: 4, notes: 'Part settlement' },
    { cust: 5, amount: 1500, mode: 'cash', days: 1, notes: 'Part payment' },
  ];
  for (const l of ledger) {
    const c = created.customers[l.cust];
    if (!c) continue;
    await call('POST', '/customer-ledger/payment', {
      customerName: c.name, phone: c.phone, amount: l.amount, mode: l.mode, date: daysAgo(l.days), notes: l.notes,
    });
  }
}

/* ------------------------------------------------------------------ */
/* 6. Website side: orders, coupons, offers, testimonials, banners      */
/* ------------------------------------------------------------------ */
async function seedWebsiteOps() {
  console.log('— shipping settings —');
  await call('POST', '/settings/shipping', {
    value: { freeShippingAbove: 1499, flatRate: 79, codCharge: 49, estimatedDays: '4-7 business days' },
  });

  console.log('— coupons —');
  const coupons = [
    { code: 'WELCOME10', discountValue: 10, discountType: 'percent', minSpendGoal: 999, validFrom: daysAgo(30), validUntil: daysAhead(60), isActive: true },
    { code: 'FESTIVE500', discountValue: 500, discountType: 'fixed', minSpendGoal: 2999, validFrom: daysAgo(10), validUntil: daysAhead(30), isActive: true },
    { code: 'BRIDAL15', discountValue: 15, discountType: 'percent', minSpendGoal: 4999, validFrom: daysAgo(5), validUntil: daysAhead(45), isActive: true },
    { code: 'LOYAL250', discountValue: 250, discountType: 'fixed', minSpendGoal: 1999, validFrom: daysAgo(20), validUntil: daysAhead(90), isActive: true, isAutoApplied: true },
  ];
  const existingC = unwrapList(await call('GET', '/coupons'));
  for (const c of coupons) {
    if (existingC.find((e) => e.code === c.code)) { console.log(`  = coupon ${c.code} exists`); continue; }
    await call('POST', '/coupons', c);
  }

  console.log('— deals & offers —');
  const deals = [
    { title: 'Festive Season Sale', description: 'Flat 25% off on all festive necklace sets and jhumkas this Navratri.', discountPercentage: 25, couponCode: 'FESTIVE500', validFrom: daysAgo(10), validUntil: daysAhead(20), isActive: true, image: '/images/gallery-1.png' },
    { title: 'Bridal Week Special', description: 'Buy any bridal set and get a matching maang tikka free.', discountPercentage: 15, couponCode: 'BRIDAL15', validFrom: daysAgo(3), validUntil: daysAhead(25), isActive: true, image: '/images/gallery-2.png' },
    { title: 'First Order Offer', description: 'Extra 10% off for first-time shoppers on orders above Rs. 999.', discountPercentage: 10, couponCode: 'WELCOME10', validFrom: daysAgo(30), validUntil: daysAhead(60), isActive: true, image: '/images/gallery-3.png' },
  ];
  const existingD = unwrapList(await call('GET', '/deals-offers'));
  for (const d of deals) {
    if (existingD.find((e) => e.title === d.title)) { console.log(`  = deal ${d.title} exists`); continue; }
    await call('POST', '/deals-offers', d);
  }

  console.log('— testimonials —');
  const testimonials = [
    { text: 'Ordered the Meenakari choker for my sister’s wedding. The finish looks exactly like the photos and the packing was very safe.', customerName: 'Nidhi Patel', customerPost: 'Ahmedabad', isActive: true, sortOrder: 1, image: '/images/why-1.jpg' },
    { text: 'I run a small boutique and have been buying wholesale lots for six months. Quality stays consistent and delivery is always on time.', customerName: 'Ritu Shah', customerPost: 'Boutique Owner, Surat', isActive: true, sortOrder: 2, image: '/images/why-2.jpg' },
    { text: 'The rose gold bracelet has not faded even after daily wear for three months. Very happy with the plating quality.', customerName: 'Aarti Mehta', customerPost: 'Vadodara', isActive: true, sortOrder: 3, image: '/images/gallery-4.png' },
    { text: 'Great collection of temple jewellery. The Lakshmi haram was the highlight of my reception look.', customerName: 'Divya Iyer', customerPost: 'Rajkot', isActive: true, sortOrder: 4, image: '/images/gallery-5.png' },
    { text: 'Customer support helped me pick the right bangle size over WhatsApp. Smooth experience end to end.', customerName: 'Sneha Joshi', customerPost: 'Bhavnagar', isActive: true, sortOrder: 5, image: '/images/gallery-6.png' },
  ];
  const existingT = unwrapList(await call('GET', '/testimonials'));
  for (const t of testimonials) {
    if (existingT.find((e) => e.customerName === t.customerName)) { console.log(`  = testimonial ${t.customerName} exists`); continue; }
    await call('POST', '/testimonials', t);
  }

  console.log('— banners —');
  const existingB = unwrapList(await call('GET', '/banners'));
  const bannerSources = [
    'uploads/banners/banner-1785049112240-597494725.jpg',
    'uploads/banners/banner-1785049337028-952147927.jpg',
    'uploads/banners/banner-1785049378280-116414572.jpg',
  ];
  const bannerMeta = [
    { title: 'Festive Collection 2026', description: 'Handcrafted kundan and temple sets for the wedding season.', ctaText: 'Shop Festive', link: '/shop?category=necklaces', displayOrder: 1 },
    { title: 'Everyday Elegance', description: 'Lightweight studs, chains and bracelets under Rs. 999.', ctaText: 'Explore Daily Wear', link: '/shop', displayOrder: 2 },
    { title: 'Bridal Sets Just In', description: 'Complete sets with necklace, earrings, tikka and kadas.', ctaText: 'View Bridal', link: '/collections', displayOrder: 3 },
  ];
  for (let i = 0; i < bannerMeta.length; i++) {
    const m = bannerMeta[i];
    if (existingB.find((e) => e.title === m.title)) { console.log(`  = banner ${m.title} exists`); continue; }
    let buf;
    try { buf = await readFile(new URL(`../${bannerSources[i]}`, import.meta.url)); }
    catch (e) { failures.push({ note: `banner source missing: ${bannerSources[i]}` }); continue; }
    const fd = new FormData();
    fd.set('title', m.title);
    fd.set('description', m.description);
    fd.set('ctaText', m.ctaText);
    fd.set('link', m.link);
    fd.set('displayOrder', String(m.displayOrder));
    fd.set('isActive', 'true');
    fd.set('desktopMediaType', 'image');
    fd.set('desktopMedia', new Blob([buf], { type: 'image/jpeg' }), `seed-banner-${i + 1}.jpg`);
    await call('POST', '/banners', fd);
  }

  console.log('— website orders —');
  const prods = unwrapList(await call('GET', '/products?limit=200'));
  const bySku = (sku) => prods.find((p) => p.sku === sku);
  const orderPlan = [
    { name: 'Nidhi Patel', phone: '9825101010', address: '12 Satyam Residency, Bopal, Ahmedabad', pincode: '380058', items: [['GLT-NEC-001', 1], ['GLT-EAR-001', 2]], status: 'delivered', paymentStatus: 'paid', courier: 'Delhivery', tracking: 'DLV10023481' },
    { name: 'Ritu Shah', phone: '9825202020', address: '304 Pearl Arcade, Adajan, Surat', pincode: '395009', items: [['GLT-BRD-001', 1]], status: 'shipped', paymentStatus: 'paid', courier: 'BlueDart', tracking: 'BD8891245' },
    { name: 'Aarti Mehta', phone: '9825303030', address: '7 Kalyan Society, Alkapuri, Vadodara', pincode: '390007', items: [['GLT-BAN-002', 2], ['GLT-RNG-001', 1]], status: 'processing', paymentStatus: 'paid' },
    { name: 'Divya Iyer', phone: '9825404040', address: 'C-9 Krishna Park, Kalawad Road, Rajkot', pincode: '360005', items: [['GLT-NEC-002', 1], ['GLT-EAR-002', 1]], status: 'placed', paymentStatus: 'pending' },
    { name: 'Sneha Joshi', phone: '9825505050', address: '21 Shivalik Row House, Bhavnagar', pincode: '364002', items: [['GLT-EAR-003', 3], ['GLT-RNG-002', 2]], status: 'cancelled', paymentStatus: 'failed' },
    { name: 'Priya Sharma', phone: '9824033333', address: 'B-402 Silver Heights, Vadodara', pincode: '390007', items: [['GLT-NEC-003', 1], ['GLT-EAR-001', 1]], status: 'delivered', paymentStatus: 'paid', courier: 'Delhivery', tracking: 'DLV10029914' },
  ];
  created.orders = [];
  for (const o of orderPlan) {
    const items = [];
    for (const [sku, qty] of o.items) {
      const p = bySku(sku);
      if (!p) { failures.push({ note: `order references unknown sku ${sku}` }); continue; }
      items.push({ productId: idOf(p), name: p.name, sku: p.sku, image: p.images?.[0], quantity: qty, price: p.price });
    }
    if (!items.length) continue;
    const subtotal = items.reduce((a, i) => a + i.quantity * i.price, 0);
    const shippingCost = subtotal >= 1499 ? 0 : 79;
    const discount = subtotal > 3000 ? 500 : 0;
    const r = await call('POST', '/orders', {
      customerName: o.name, phone: o.phone, address: o.address, pincode: o.pincode,
      items, subtotal, discount, shippingCost,
      totalAmount: money(subtotal - discount + shippingCost),
      paymentStatus: o.paymentStatus,
      ...(o.paymentStatus === 'paid' ? { paymentId: `pay_seed_${Math.random().toString(36).slice(2, 12)}` } : {}),
      notes: 'Seeded order for QA.',
    });
    if (r) {
      created.orders.push(r);
      if (o.status !== 'placed') {
        await call('PATCH', `/orders/${idOf(r)}/tracking`, {
          orderStatus: o.status,
          ...(o.courier ? { courierName: o.courier, trackingId: o.tracking } : {}),
          notes: `Status set to ${o.status} during seeding.`,
        });
      }
    }
  }
}

/* ------------------------------------------------------------------ */
const ONLY = (process.env.ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const wanted = (name) => !ONLY.length || ONLY.includes(name);

async function main() {
  await login();
  if (wanted('web')) await seedWebsiteCatalogue();
  if (wanted('parties')) await seedParties();
  if (wanted('mfg')) await seedManufacturing();
  if (wanted('shop')) await seedShopCatalogue();
  if (wanted('sales')) await seedSales();
  if (wanted('ops')) await seedWebsiteOps();

  console.log('\n===== SUMMARY =====');
  console.log(`failures: ${failures.length}`);
  for (const f of failures) console.log(JSON.stringify(f).slice(0, 400));
  if (failures.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
