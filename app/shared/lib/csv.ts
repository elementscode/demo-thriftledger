import { CsvMapping } from "#app/shared/lib/ledger";

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

export interface ParsedRow {
  postedOn: string;
  description: string;
  amountCents: number;
}

export interface MappedCsv {
  rows: ParsedRow[];

  /** One line per row that could not be read, with its line number in the file. */
  errors: string[];
}

/** RFC 4180: quoted fields, doubled quotes, and newlines inside quotes. */
export function parseCsv(text: string): CsvTable {
  let records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let body = text.replace(/^﻿/, "");

  for (let i = 0; i < body.length; i++) {
    let c = body[i];

    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }

      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") {
        i++;
      }

      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  let nonEmpty = records.filter((r) => r.some((f) => f.trim() !== ""));
  let headers = (nonEmpty[0] ?? []).map((h) => h.trim());

  return { headers, rows: nonEmpty.slice(1) };
}

/** 2026-09-14, 09/14/2026, 9/14/26. Slashes are read month first, as US banks write them. */
export function parseDate(text: string): string | null {
  let value = text.trim();
  let iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  let year: number, month: number, day: number;

  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    let us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value);

    if (!us) {
      return null;
    }

    [month, day, year] = [Number(us[1]), Number(us[2]), Number(us[3])];

    if (year < 100) {
      year += 2000;
    }
  }

  let date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "$1,234.56", "-42.10", "(42.10)" as cents. */
export function parseAmount(text: string): number | null {
  let value = text.trim();
  let negative = false;

  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }

  value = value.replace(/[$,\s]/g, "");

  if (value.startsWith("-")) {
    negative = !negative;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }

  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(value)) {
    return null;
  }

  let cents = Math.round(Number(value) * 100);

  return negative ? -cents : cents;
}

/** A best guess at the mapping from the header names, for an account seen for the first time. */
export function guessMapping(headers: string[]): CsvMapping {
  let find = (patterns: RegExp[]) => {
    for (let p of patterns) {
      let hit = headers.find((h) => p.test(h));

      if (hit) {
        return hit;
      }
    }

    return headers[0] ?? "";
  };

  return {
    dateColumn: find([/^(transaction |posted |post )?date$/i, /date/i]),
    descriptionColumn: find([/^description$/i, /desc|payee|merchant|memo|name/i]),
    amountColumn: find([/^amount$/i, /amount|value/i]),
    invertAmounts: false,
  };
}

export function mapCsv(table: CsvTable, mapping: CsvMapping): MappedCsv {
  let dateAt = table.headers.indexOf(mapping.dateColumn);
  let descriptionAt = table.headers.indexOf(mapping.descriptionColumn);
  let amountAt = table.headers.indexOf(mapping.amountColumn);
  let rows: ParsedRow[] = [];
  let errors: string[] = [];

  if (dateAt < 0 || descriptionAt < 0 || amountAt < 0) {
    return { rows, errors: ["choose a column for the date, the description and the amount"] };
  }

  table.rows.forEach((record, i) => {
    let line = i + 2;
    let postedOn = parseDate(record[dateAt] ?? "");
    let amount = parseAmount(record[amountAt] ?? "");
    let description = (record[descriptionAt] ?? "").trim().replace(/\s+/g, " ");

    if (!postedOn) {
      errors.push(`line ${line}: "${record[dateAt] ?? ""}" is not a date`);
      return;
    }

    if (amount === null) {
      errors.push(`line ${line}: "${record[amountAt] ?? ""}" is not an amount`);
      return;
    }

    if (description === "") {
      errors.push(`line ${line}: no description`);
      return;
    }

    rows.push({ postedOn, description, amountCents: mapping.invertAmounts ? -amount : amount });
  });

  return { rows, errors };
}

/**
 * Stable identities for a file's rows. Two identical coffees on the same day
 * are two purchases, so each repeat of a date, amount and description gets
 * the next occurrence number. Re-importing the file, or an export that
 * overlaps it, produces the same fingerprints for the rows already imported.
 */
export function fingerprints(rows: ParsedRow[]): string[] {
  let seen = new Map<string, number>();

  return rows.map((row) => {
    let key = `${row.postedOn}|${row.amountCents}|${row.description.trim().replace(/\s+/g, " ").toLowerCase()}`;
    let n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return `${key}|${n}`;
  });
}
