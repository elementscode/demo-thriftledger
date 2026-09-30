import { test, equal } from "@elements/app";
import { fingerprints, guessMapping, mapCsv, parseAmount, parseCsv, parseDate } from "#app/shared/lib/csv";

test("csv", () => {
  test("parses quoted fields, doubled quotes and CRLF", () => {
    let table = parseCsv('﻿Date,Description,Amount\r\n09/01/2026,"LINDENWORKS, INC ""PAYROLL""",1200.00\r\n\r\n09/02/2026,Coffee,-4.50\r\n');
    equal(table.headers, ["Date", "Description", "Amount"]);
    equal(table.rows, [["09/01/2026", 'LINDENWORKS, INC "PAYROLL"', "1200.00"], ["09/02/2026", "Coffee", "-4.50"]]);
  });

  test("reads the date formats banks export", () => {
    equal(parseDate("2026-09-14"), "2026-09-14");
    equal(parseDate("09/14/2026"), "2026-09-14");
    equal(parseDate("9/4/26"), "2026-09-04");
    equal(parseDate("02/30/2026"), null);
    equal(parseDate("yesterday"), null);
  });

  test("reads amounts with symbols, commas and parentheses", () => {
    equal(parseAmount("$1,234.56"), 123456);
    equal(parseAmount("-42.1"), -4210);
    equal(parseAmount("(42.10)"), -4210);
    equal(parseAmount("+7"), 700);
    equal(parseAmount("n/a"), null);
  });

  test("guesses the columns from their names", () => {
    let mapping = guessMapping(["Transaction Date", "Post Date", "Description", "Type", "Amount"]);
    equal(mapping.dateColumn, "Transaction Date");
    equal(mapping.descriptionColumn, "Description");
    equal(mapping.amountColumn, "Amount");
  });

  test("maps rows, flips signs when asked, and reports bad lines", () => {
    let table = parseCsv("When,Payee,Charge\n2026-09-01,Books,12.00\nlater,Oops,1.00\n");
    let mapped = mapCsv(table, { dateColumn: "When", descriptionColumn: "Payee", amountColumn: "Charge", invertAmounts: true });
    equal(mapped.rows, [{ postedOn: "2026-09-01", description: "Books", amountCents: -1200 }]);
    equal(mapped.errors, ['line 3: "later" is not a date']);
  });

  test("numbers repeats so two identical purchases are both kept", () => {
    let prints = fingerprints([
      { postedOn: "2026-09-01", description: "Coffee", amountCents: -450 },
      { postedOn: "2026-09-01", description: "COFFEE ", amountCents: -450 },
      { postedOn: "2026-09-02", description: "Coffee", amountCents: -450 },
    ]);
    equal(prints, ["2026-09-01|-450|coffee|1", "2026-09-01|-450|coffee|2", "2026-09-02|-450|coffee|1"]);
  });
});
