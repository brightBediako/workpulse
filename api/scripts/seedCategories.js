/**
 * One-time / idempotent seed helper for category taxonomy.
 * Categories live in `constants/gigCategories.js` (source of truth).
 * This script prints the seeded list for ops/docs; no DB collection required.
 *
 * Usage: node scripts/seedCategories.js
 */
import {
  GIG_CATEGORIES,
  GIG_CATEGORY_SLUGS,
} from "../constants/gigCategories.js";

console.log("WorkPulse Connect — gig category taxonomy");
console.log(`Count: ${GIG_CATEGORIES.length}`);
console.log("Slugs:", GIG_CATEGORY_SLUGS.join(", "));
console.log("");
for (const cat of GIG_CATEGORIES) {
  console.log(`- ${cat.slug}: ${cat.label} — ${cat.description}`);
}
console.log("");
console.log("API: GET /api/categories");
