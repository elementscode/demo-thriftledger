import { Category } from "#app/shared/lib/ledger";

export function seriesColor(category: Category | undefined): string {
  return category?.colorSlot ? `var(--series-${category.colorSlot})` : "var(--series-other)";
}
