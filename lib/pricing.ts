export type DivisionPricing = {
  price_early: number | null;
  price_normal: number;
  price_late: number | null;
  early_bird_ends: string | null;
  late_starts: string | null;
};

export function currentPrice(division: DivisionPricing) {
  const today = new Date().toISOString().slice(0, 10);
  if (division.price_early != null && division.early_bird_ends && today <= division.early_bird_ends) {
    return division.price_early;
  }
  if (division.price_late != null && division.late_starts && today >= division.late_starts) {
    return division.price_late;
  }
  return division.price_normal;
}
