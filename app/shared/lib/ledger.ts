export type AccountKind = "checking" | "savings" | "credit";
export type CategoryKind = "expense" | "income" | "transfer";

export interface CsvMapping {
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;

  /** The export shows money out as positive, as most card statements do. */
  invertAmounts: boolean;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  kind: AccountKind;
  institution: string;
  openingBalanceCents: number;
  csvMapping: CsvMapping | null;
  createdAt: Date;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  kind: CategoryKind;
  colorSlot: number | null;
}

export interface Rule {
  id: string;
  userId: string;
  pattern: string;
  categoryId: string;
  createdAt: Date;
}

export interface Budget {
  id: string;
  userId: string;
  categoryId: string;
  amountCents: number;
}

export interface Split {
  categoryId: string;
  amountCents: number;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;

  /** YYYY-MM-DD, a calendar day with no time zone. */
  postedOn: string;
  description: string;
  amountCents: number;
  categoryId: string | null;
  splits: Split[] | null;
}

export interface ImportRecord {
  id: string;
  userId: string;
  accountId: string;
  fileName: string;
  addedCount: number;
  skippedCount: number;
  createdAt: Date;
}

export const ACCOUNT_KINDS: { kind: AccountKind; label: string }[] = [
  { kind: "checking", label: "Checking" },
  { kind: "savings", label: "Savings" },
  { kind: "credit", label: "Credit card" },
];

export const UNCATEGORIZED = "uncategorized";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const wholeMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function formatMoney(cents: number): string {
  return money.format(cents / 100);
}

export function formatWholeMoney(cents: number): string {
  return wholeMoney.format(Math.round(cents / 100));
}

/** "1,284.50" or "-12" typed into an input, as cents. NaN when it is not a number. */
export function parseMoneyInput(text: string): number {
  let clean = text.replace(/[$,\s]/g, "");

  if (clean === "" || !/^-?\d*(\.\d{0,2})?$/.test(clean)) {
    return NaN;
  }

  return Math.round(Number(clean) * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** YYYY-MM of a YYYY-MM-DD day. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function todayIso(): string {
  let now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentMonth(): string {
  return monthOf(todayIso());
}

export function shiftMonth(month: string, by: number): string {
  let [year, m] = month.split("-").map(Number);
  let index = year * 12 + (m - 1) + by;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

export function monthLabel(month: string, style: "long" | "short" = "long"): string {
  let [year, m] = month.split("-").map(Number);
  let date = new Date(Date.UTC(year, m - 1, 1));

  if (style === "short") {
    return date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  }

  return date.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function dayLabel(day: string): string {
  let [year, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, d)).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Where a transaction's money went: its one category, or each part of a
 * split. A row with neither is one uncategorized part.
 */
export function allocations(t: Transaction): { categoryId: string | null; amountCents: number }[] {
  if (t.splits && t.splits.length > 0) {
    return t.splits;
  }

  return [{ categoryId: t.categoryId, amountCents: t.amountCents }];
}

export function isCategorized(t: Transaction): boolean {
  return (t.splits !== null && t.splits.length > 0) || t.categoryId !== null;
}

export function byCategoryId(categories: Iterable<Category>): Map<string, Category> {
  let map = new Map<string, Category>();

  for (let c of categories) {
    map.set(c.id, c);
  }

  return map;
}

/**
 * Spending in a month keyed by category id, uncategorized money out under
 * UNCATEGORIZED. A refund in an expense category lowers its total. Transfers
 * and income are not spending.
 */
export function spendingByCategory(
  transactions: Iterable<Transaction>,
  categories: Map<string, Category>,
  month: string,
): Map<string, number> {
  let totals = new Map<string, number>();

  for (let t of transactions) {
    if (monthOf(t.postedOn) !== month) {
      continue;
    }

    for (let part of allocations(t)) {
      let category = part.categoryId ? categories.get(part.categoryId) : undefined;
      let key: string;

      if (category) {
        if (category.kind !== "expense") {
          continue;
        }

        key = category.id;
      } else {
        if (part.amountCents >= 0) {
          continue;
        }

        key = UNCATEGORIZED;
      }

      totals.set(key, (totals.get(key) ?? 0) - part.amountCents);
    }
  }

  return totals;
}

export interface MonthFlow {
  month: string;
  incomeCents: number;
  spendingCents: number;
}

/** Income and spending for each month, oldest first. */
export function monthlyFlows(
  transactions: Iterable<Transaction>,
  categories: Map<string, Category>,
  months: string[],
): MonthFlow[] {
  let flows = new Map<string, MonthFlow>();

  for (let month of months) {
    flows.set(month, { month, incomeCents: 0, spendingCents: 0 });
  }

  for (let t of transactions) {
    let flow = flows.get(monthOf(t.postedOn));

    if (!flow) {
      continue;
    }

    for (let part of allocations(t)) {
      let category = part.categoryId ? categories.get(part.categoryId) : undefined;
      let kind = category?.kind ?? (part.amountCents >= 0 ? "income" : "expense");

      if (kind === "income") {
        flow.incomeCents += part.amountCents;
      } else if (kind === "expense") {
        flow.spendingCents -= part.amountCents;
      }
    }
  }

  return months.map((month) => flows.get(month)!);
}

export function accountBalance(account: Account, transactions: Iterable<Transaction>): number {
  let balance = account.openingBalanceCents;

  for (let t of transactions) {
    if (t.accountId === account.id) {
      balance += t.amountCents;
    }
  }

  return balance;
}

export interface NetWorthPoint {
  day: string;
  cents: number;
}

/**
 * Net worth at the end of every week from the first transaction to today,
 * and today itself. Opening balances count from the start.
 */
export function netWorthSeries(accounts: Iterable<Account>, transactions: Iterable<Transaction>): NetWorthPoint[] {
  let opening = 0;

  for (let a of accounts) {
    opening += a.openingBalanceCents;
  }

  let byDay = new Map<string, number>();
  let first = "";

  for (let t of transactions) {
    byDay.set(t.postedOn, (byDay.get(t.postedOn) ?? 0) + t.amountCents);

    if (first === "" || t.postedOn < first) {
      first = t.postedOn;
    }
  }

  let today = todayIso();

  if (first === "") {
    return [{ day: today, cents: opening }];
  }

  let points: NetWorthPoint[] = [];
  let running = opening;
  let cursor = isoToUtc(first);
  let end = isoToUtc(today);
  let step = 0;

  points.push({ day: utcToIso(cursor - 86400000), cents: opening });

  while (cursor <= end) {
    let day = utcToIso(cursor);
    running += byDay.get(day) ?? 0;
    step++;

    if (step % 7 === 0 || cursor === end) {
      points.push({ day, cents: running });
    }

    cursor += 86400000;
  }

  return points;
}

function isoToUtc(day: string): number {
  let [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToIso(ms: number): string {
  let date = new Date(ms);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The rule a description matches: the longest pattern wins, as the most specific. */
export function matchRule(rules: Iterable<Rule>, description: string): Rule | undefined {
  let text = description.toLowerCase();
  let best: Rule | undefined;

  for (let rule of rules) {
    let pattern = rule.pattern.trim().toLowerCase();

    if (pattern !== "" && text.includes(pattern) && (!best || pattern.length > best.pattern.trim().length)) {
      best = rule;
    }
  }

  return best;
}

/**
 * A pattern suggested for a new rule: the merchant, without a payment
 * processor's prefix ("SQ *", "PAYPAL *") or the store number, reference and
 * time that follow it.
 */
export function suggestPattern(description: string): string {
  let text = description.toLowerCase().replace(/^(sq|tst|sp|paypal|venmo|dd|pp)\s*\*\s*/, "");
  let words: string[] = [];

  for (let word of text.split(/\s+/)) {
    if (word === "" || /[\d#*]/.test(word) || words.length === 3) {
      break;
    }

    words.push(word);
  }

  if (words.length === 0) {
    return text.split("*")[0].trim();
  }

  return words.join(" ");
}
