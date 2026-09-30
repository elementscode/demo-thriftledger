import { test, equal } from "@elements/app";
import { transactions } from "#app/shared/services/ledger";
import { parseCsv } from "#app/shared/lib/csv";
import { addTransaction, makeLedger } from "#app/shared/services/fixtures";
import { preview } from "./template";

test("import page", () => {
  test("the preview marks the rows the account already has", () => {
    let ledger = makeLedger();
    addTransaction(ledger.userId, ledger.checking.id, "2026-09-01", "KETTLEBIRD COFFEE", -450);

    let table = parseCsv("Date,Description,Amount\n2026-09-01,KETTLEBIRD COFFEE,-4.50\n2026-09-01,KETTLEBIRD COFFEE,-4.50\n2026-09-02,LINDENWORKS PAYROLL,2500\n");
    let result = preview(
      {
        accountId: ledger.checking.id,
        fileName: "x.csv",
        text: "",
        table,
        mapping: { dateColumn: "Date", descriptionColumn: "Description", amountColumn: "Amount", invertAmounts: false },
        remembered: false,
        error: "",
        busy: false,
        result: null,
      },
      transactions.view({ userId: ledger.userId }),
    );

    equal(result.duplicates, 1);
    equal(result.fresh, 2);
    equal(result.rows.map((r) => r.duplicate), [true, false, false]);
  });
});
