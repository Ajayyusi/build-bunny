/**
 * Derive Build Bunny's brand assets from NITAQ Academy's official logo.
 *
 * The source logo (public/brand/nitaq-logo.webp, fetched from
 * nitaqacademy.com) is artwork on a solid white background. Placed on Build
 * Bunny's cream student surfaces that reads as a white box, so this script
 * produces a transparent-background PNG by keying out near-white pixels, plus
 * the favicon sizes the app needs. Re-runnable; outputs land in public/brand/.
 *
 *   node scripts/brand-assets.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const brand = join(here, "..", "public", "brand");
const source = join(brand, "nitaq-logo.webp");

/** Pixels at or above this on all channels are treated as background. */
const WHITE_CUTOFF = 238;
/** Feather band below the cutoff, so edges stay smooth rather than jagged. */
const FEATHER = 26;

async function makeTransparent() {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = Buffer.from(data);
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    const min = Math.min(r, g, b);
    if (min >= WHITE_CUTOFF) {
      px[i + 3] = 0;
    } else if (min >= WHITE_CUTOFF - FEATHER) {
      // Linear ramp through the feather band keeps antialiased edges soft.
      const t = (min - (WHITE_CUTOFF - FEATHER)) / FEATHER;
      px[i + 3] = Math.round(px[i + 3] * (1 - t));
    }
  }

  const transparent = sharp(px, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png();

  await transparent.clone().toFile(join(brand, "nitaq-logo.png"));
  await transparent
    .clone()
    .resize({ width: 480 })
    .toFile(join(brand, "nitaq-logo@480.png"));
  console.log(`nitaq-logo.png       ${info.width}x${info.height} (background keyed out)`);
  console.log("nitaq-logo@480.png   480w");
}

/**
 * Favicon: the wordmark is far too wide to read at 32px, so the icon is the
 * brand mark on NITAQ green — legible in a tab, and unmistakably theirs.
 */
async function makeFavicons() {
  const mark = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
       <rect width="512" height="512" rx="112" fill="#2e7d32"/>
       <text x="50%" y="52%" text-anchor="middle" dominant-baseline="central"
             font-family="Poppins, Segoe UI, sans-serif" font-weight="700"
             font-size="230" fill="#ffffff">N</text>
       <circle cx="256" cy="404" r="26" fill="#2bbbad"/>
     </svg>`,
  );
  for (const size of [512, 192, 180, 32]) {
    await sharp(mark).resize(size, size).png().toFile(join(brand, `icon-${size}.png`));
  }
  console.log("icon-{512,192,180,32}.png");
}

await makeTransparent();
await makeFavicons();
console.log("brand assets written to public/brand/");
