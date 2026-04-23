function slugify(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildSeededVariant(product) {
  return {
    id: `${product.id}-default`,
    legacyId: null,
    title: "Default",
    sku: slugify(product.title).toUpperCase(),
    price: null,
    compareAtPrice: null,
    inventory: Number(product.inventory || 0),
    availableForSale: Number(product.inventory || 0) > 0,
    selectedOptions: [],
  };
}

function normalizeSeededProduct(product) {
  const description = `${product.title} is part of the seeded fallback catalog used when Shopify sync is unavailable.`;
  const variant = buildSeededVariant(product);

  return {
    ...product,
    legacyId: product.id,
    handle: slugify(product.title),
    description,
    descriptionHtml: `<p>${description}</p>`,
    image: null,
    images: [],
    options: [],
    variants: [variant],
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    currencyCode: "USD",
    availableForSale: variant.availableForSale,
    inventoryTracked: true,
  };
}

const SEEDED_PRODUCTS = [
  { id: "gid://shopify/Product/10435360817444", title: "Women's Sun Dresses - Size 4-10 - Box of 10", status: "active", inventory: 0, category: "Dresses", productType: "Women's Clothing", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435356688676", title: "Women's Tank Tops - Size 4-8 - Box of 10", status: "active", inventory: 0, category: "Uncategorized", productType: "Women's Clothing", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435354329380", title: "Women's Jean Shorts - Size 4-10 - Box of 10", status: "active", inventory: 0, category: "Denim Shorts", productType: "Women's Clothing", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435344662820", title: "Women's Jeans - High Rise / Mom Fit - Size 4-10 - Box of 10", status: "active", inventory: 0, category: "Jeans", productType: "Denim", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435335586084", title: "Dickies Work Pants - Clean - 32-38 Waist - Box of 10", status: "active", inventory: 0, category: "Work Safety Protective Gear", productType: "Workwear", vendor: "Dickies" },
  { id: "gid://shopify/Product/10435327197476", title: "Carhartt Bib Overalls - Worn Vintage - Box of 10", status: "active", inventory: 0, category: "Contractor Pants & Coveralls", productType: "Workwear", vendor: "Carhartt" },
  { id: "gid://shopify/Product/10435323461924", title: "Mixed Outerwear - Clean - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Coats & Jackets", productType: "Outerwear", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435309895972", title: "Columbia Jackets - Clean - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Coats & Jackets", productType: "Outerwear", vendor: "Columbia" },
  { id: "gid://shopify/Product/10435298853156", title: "Blank / Minimal Tees - Clean - M/L Mix - Box of 10", status: "active", inventory: 0, category: "T-Shirts", productType: "T-Shirts", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435290464548", title: "Contemporary Graphic Tees - Clean - M/L Mix - Box of 10", status: "active", inventory: 0, category: "T-Shirts", productType: "T-Shirts", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435286368548", title: "Licensed Graphic Tees - Sports / NASCAR - M/L Mix - Box of 10", status: "active", inventory: 0, category: "T-Shirts", productType: "T-Shirts", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435282043172", title: "Harley Davidson Graphic Tees - Vintage - M/L Mix - Box of 10", status: "active", inventory: 0, category: "T-Shirts", productType: "T-Shirts", vendor: "Harley Davidson" },
  { id: "gid://shopify/Product/10435217916196", title: "Mixed Athletic Wear - Value - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Activewear", productType: "Athletic Wear", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435214770468", title: "Women's Athletic Jackets - Clean - Size 4-8 Mix - Box of 10", status: "active", inventory: 0, category: "Jackets", productType: "Athletic Wear", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435212017956", title: "Lululemon Athletic Tops - Women's 4-8 - Clean - Box of 10", status: "active", inventory: 0, category: "Activewear Tops", productType: "Athletic Wear", vendor: "Lululemon" },
  { id: "gid://shopify/Product/10435206250788", title: "Women's Athletic Shorts - Clean - Size 4-8 Mix - Box of 10", status: "active", inventory: 0, category: "Shorts", productType: "Athletic Wear", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435202842916", title: "Women's Athletic Tops - Clean - Size 4-8 Mix - Box of 10", status: "active", inventory: 0, category: "Activewear Tops", productType: "Athletic Wear", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435197600036", title: "Champion Athletic Wear - Clean - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Activewear", productType: "Athletic Wear", vendor: "Champion" },
  { id: "gid://shopify/Product/10435193831716", title: "Adidas Hoodies & Sweatshirts - Clean - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Hoodies", productType: "Athletic Wear", vendor: "Adidas" },
  { id: "gid://shopify/Product/10435191570724", title: "Nike Hoodies & Sweatshirts - Clean - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Hoodies", productType: "Athletic Wear", vendor: "Nike" },
  { id: "gid://shopify/Product/10435186917668", title: "Under Armour Athletic Wear - Clean - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Activewear", productType: "Athletic Wear", vendor: "Under Armour" },
  { id: "gid://shopify/Product/10435184328996", title: "Adidas Track Pants & Joggers - Clean - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Track Pants", productType: "Athletic Wear", vendor: "Adidas" },
  { id: "gid://shopify/Product/10435181314340", title: "Nike Athletic Tops - Clean - M/L Mix - Box of 10", status: "active", inventory: 0, category: "T-Shirts", productType: "Athletic Wear", vendor: "Nike" },
  { id: "gid://shopify/Product/10435178266916", title: "Lululemon Leggings - Women's 4-8 - Clean - Box of 10", status: "active", inventory: 0, category: "Leggings", productType: "Athletic Wear", vendor: "Lululemon" },
  { id: "gid://shopify/Product/10435162210596", title: "The North Face Jackets - Mixed Styles - Box of 10", status: "active", inventory: 0, category: "Coats & Jackets", productType: "Outerwear", vendor: "The North Face" },
  { id: "gid://shopify/Product/10435156246820", title: "Carhartt Double Knee Work Pants - Worn Vintage - Box of 10", status: "active", inventory: 0, category: "Contractor Pants & Coveralls", productType: "Workwear", vendor: "Carhartt" },
  { id: "gid://shopify/Product/10435152347428", title: "Carhartt Work Jackets - Worn Vintage - Box of 10", status: "active", inventory: 0, category: "Coats & Jackets", productType: "Workwear", vendor: "Carhartt" },
  { id: "gid://shopify/Product/10435143368996", title: "Patagonia Fleece Jackets - Mixed Styles - Box of 10", status: "active", inventory: 0, category: "Coats & Jackets", productType: "Outerwear", vendor: "Patagonia" },
  { id: "gid://shopify/Product/10435108602148", title: "Nike Athletic Shorts - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Shorts", productType: "Athletic Wear", vendor: "Nike" },
  { id: "gid://shopify/Product/10435104702756", title: "Vintage Pearl Snap Shirts - Western - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Shirts", productType: "Button Downs / Western Shirts", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435101557028", title: "Grandmacore Knit Sweaters - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Sweaters", productType: "Sweaters / Hoodies", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435094118692", title: "University Sweatshirts - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Sweatshirts", productType: "Sweaters / Hoodies", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435091136804", title: "Champion Reverse Weave Sweatshirts - M/L Mix - Box of 10", status: "active", inventory: 0, category: "Sweatshirts", productType: "Athletic Wear", vendor: "Champion" },
  { id: "gid://shopify/Product/10435086778660", title: "Y2K Graphic Tees - M/L Mix - Box of 10", status: "active", inventory: 0, category: "T-Shirts", productType: "T-Shirts", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435085861156", title: "Vintage Band Tees - Graphic - Box of 10", status: "active", inventory: 0, category: "Uncategorized", productType: "T-Shirts", vendor: "Mixed" },
  { id: "gid://shopify/Product/10435062104356", title: "Wrangler Denim - 30-36 Waist - Box of 10", status: "active", inventory: 0, category: "Jeans", productType: "Denim", vendor: "Wrangler" },
  { id: "gid://shopify/Product/10435047260452", title: "Levi's Denim - 30-36 Waist - Box of 10", status: "active", inventory: 1, category: "Jeans", productType: "Denim", vendor: "Levi's" },
];

export const STORE_OPERATIONS_NOTES = [
  "Route-based reseller shopping openings are retired.",
  "All incoming route material is now sorted on site by the NCT team.",
  "Curated wholesale lots should publish to Shopify instead of relying on shopping-day bookings.",
];

export function getSeededStoreProducts() {
  return SEEDED_PRODUCTS.map((product) => normalizeSeededProduct(product));
}

export function buildCatalogSummary(products) {
  const rows = products || [];
  const activeCount = rows.filter((product) => product.status === "active").length;
  const inStockCount = rows.filter((product) => Number(product.inventory || 0) > 0).length;
  const productTypeCount = new Set(rows.map((product) => product.productType).filter(Boolean)).size;
  const vendorCount = new Set(rows.map((product) => product.vendor).filter(Boolean)).size;

  return {
    totalProducts: rows.length,
    activeProducts: activeCount,
    inStockProducts: inStockCount,
    productTypes: productTypeCount,
    vendors: vendorCount,
  };
}

export function buildCategoryCards(products) {
  const grouped = new Map();

  for (const product of products || []) {
    const key = product.productType || "Uncategorized";
    if (!grouped.has(key)) {
      grouped.set(key, {
        slug: key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        title: key,
        productCount: 0,
        categories: new Set(),
        sampleTitles: [],
      });
    }

    const bucket = grouped.get(key);
    bucket.productCount += 1;
    if (product.category) {
      bucket.categories.add(product.category);
    }
    if (bucket.sampleTitles.length < 3) {
      bucket.sampleTitles.push(product.title);
    }
  }

  return [...grouped.values()]
    .map((bucket) => ({
      slug: bucket.slug,
      title: bucket.title,
      productCount: bucket.productCount,
      categories: [...bucket.categories].sort(),
      sampleTitles: bucket.sampleTitles,
    }))
    .sort((left, right) => right.productCount - left.productCount || left.title.localeCompare(right.title));
}