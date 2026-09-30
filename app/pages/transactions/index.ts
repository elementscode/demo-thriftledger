import { Request, Response } from "@elements/app";
import { requireUser } from "#app/shared/services/auth";
import { ledgerViews, rules } from "#app/shared/services/ledger";
import { isMonth } from "#app/shared/lib/ledger";
import html from "./template";

export default function route(req: Request, res: Response) {
  let userId = requireUser();

  if (!userId) {
    return;
  }

  return new html({
    ...ledgerViews(userId),
    rules: rules.view({ userId }),
    filters: {
      search: typeof req.query.q === "string" ? req.query.q : "",
      accountId: typeof req.query.account === "string" ? req.query.account : "",
      month: isMonth(req.query.month) ? req.query.month : "",
      uncategorized: req.query.show === "uncategorized",
      limit: 100,
    },
  });
}
