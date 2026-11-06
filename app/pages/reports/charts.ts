/** $1.2K, $12K, $1.4M: tick labels, in dollars from cents. */
export function compactMoney(cents: number): string {
  let dollars = cents / 100;
  let abs = Math.abs(dollars);
  let sign = dollars < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    return `${sign}$${trim(abs / 1_000_000)}M`;
  }

  if (abs >= 1000) {
    return `${sign}$${trim(abs / 1000)}K`;
  }

  return `${sign}$${Math.round(abs)}`;
}

function trim(n: number): string {
  return n >= 100 ? n.toFixed(0) : n.toFixed(1).replace(/\.0$/, "");
}
