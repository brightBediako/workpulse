/**
 * Controlled gig / service category taxonomy for WorkPulse Connect.
 * Use `slug` in API bodies and queries (`cat` field).
 */
export const GIG_CATEGORIES = [
  {
    slug: "plumbing",
    label: "Plumbing",
    description: "Pipes, taps, water heaters, drainage",
  },
  {
    slug: "electrical",
    label: "Electrical",
    description: "Wiring, fixtures, installations, repairs",
  },
  {
    slug: "carpentry",
    label: "Carpentry",
    description: "Woodwork, furniture, fittings",
  },
  {
    slug: "painting",
    label: "Painting",
    description: "Interior and exterior painting",
  },
  {
    slug: "cleaning",
    label: "Cleaning",
    description: "Home, office, and deep cleaning",
  },
  {
    slug: "technician",
    label: "Technician",
    description: "Appliance and general technical repairs",
  },
  {
    slug: "mechanics",
    label: "Mechanics",
    description: "Vehicle and machine maintenance",
  },
  {
    slug: "masonry",
    label: "Masonry",
    description: "Brickwork, tiling, concrete",
  },
  {
    slug: "hvac",
    label: "HVAC & Cooling",
    description: "Air conditioning and ventilation",
  },
  {
    slug: "gardening",
    label: "Gardening & Landscaping",
    description: "Yards, plants, outdoor upkeep",
  },
  {
    slug: "moving",
    label: "Moving & Delivery",
    description: "Relocation help and light haulage",
  },
  {
    slug: "casual-labour",
    label: "Casual Labour",
    description: "Temporary and general labour",
  },
  {
    slug: "other",
    label: "Other Services",
    description: "Trades not listed above",
  },
];

export const GIG_CATEGORY_SLUGS = GIG_CATEGORIES.map((c) => c.slug);

const bySlug = new Map(GIG_CATEGORIES.map((c) => [c.slug, c]));
const byLabel = new Map(
  GIG_CATEGORIES.map((c) => [c.label.toLowerCase(), c])
);

/**
 * Normalize user input (slug or label) to canonical slug, or null if unknown.
 */
export const normalizeCategorySlug = (input) => {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const asSlug = trimmed.toLowerCase().replace(/\s+/g, "-");
  if (bySlug.has(asSlug)) return asSlug;

  const byLabelMatch = byLabel.get(trimmed.toLowerCase());
  if (byLabelMatch) return byLabelMatch.slug;

  return null;
};

export const isValidCategory = (input) =>
  Boolean(normalizeCategorySlug(input));
