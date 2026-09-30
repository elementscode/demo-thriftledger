import { Request, Response, sql } from "@elements/app";
import { requireUser } from "#app/shared/services/auth";

interface Row {
  postedOn: string;
  description: string;
  amountCents: number;
}

/**
 * A card export to try the importer with: the last two weeks of the credit
 * card, which a re-import skips, and a few purchases the ledger has not seen.
 */
export default function sampleCsv(req: Request, res: Response) {
  let userId = requireUser();

  if (!userId) {
    return;
  }

  let card = sql<{ id: string }>(`
    select id from accounts where userId = ${userId} and kind = 'credit' order by createdAt limit 1
  `).first();

  let known = card
    ? sql<Row>(`
        select to_char(postedOn, 'YYYY-MM-DD') as postedOn, description, amountCents
          from transactions
         where accountId = ${card.id}
           and postedOn > current_date - 14
      `).all()
    : [];

  let fresh: [number, string, number][] = [
    [0, "FERNLEAF MARKET #512", -6412],
    [0, "DRIFTWOOD COFFEE VALENCIA", -725],
    [1, "PARCELWAY.COM*RT4KZ0", -3899],
    [1, "SUNPOINT FUEL 5741", -5240],
    [2, "SQ *COURTSIDE TENNIS CLUB", -2400],
    [2, "DASHPLATE*BUN & BARREL", -3187],
  ];

  let today = new Date();
  let rows: Row[] = [
    ...fresh.map(([daysAgo, description, amountCents]) => ({
      postedOn: isoDaysAgo(today, daysAgo),
      description,
      amountCents,
    })),
    ...known,
  ].sort((a, b) => b.postedOn.localeCompare(a.postedOn));

  let lines = ["Transaction Date,Post Date,Description,Type,Amount"];

  for (let row of rows) {
    let type = row.amountCents > 0 ? "Payment" : "Sale";
    lines.push([usDate(row.postedOn), usDate(row.postedOn), quote(row.description), type, (row.amountCents / 100).toFixed(2)].join(","));
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="lanternfield-card-${isoDaysAgo(today, 0)}.csv"`);
  res.send(lines.join("\r\n") + "\r\n");
}

function isoDaysAgo(today: Date, days: number): string {
  let d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function usDate(iso: string): string {
  let [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function quote(text: string): string {
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
