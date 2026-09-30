import { Request, Response } from "@elements/app";
import { requireUser } from "#app/shared/services/auth";
import { accounts, imports, transactions } from "#app/shared/services/ledger";
import html from "./template";

export default function route(req: Request, res: Response) {
  let userId = requireUser();

  if (!userId) {
    return;
  }

  return new html({
    accounts: accounts.view({ userId }),
    transactions: transactions.view({ userId }),
    imports: imports.view({ userId }),
    initialAccountId: typeof req.query.account === "string" ? req.query.account : "",
  });
}
