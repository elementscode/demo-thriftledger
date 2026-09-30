import { Request, Response } from "@elements/app";
import { requireUser } from "#app/shared/services/auth";
import { budgets, ledgerViews } from "#app/shared/services/ledger";
import { currentMonth, isMonth } from "#app/shared/lib/ledger";
import html from "./template";

export default function route(req: Request, res: Response) {
  let userId = requireUser();

  if (!userId) {
    return;
  }

  let month = isMonth(req.query.month) ? req.query.month : currentMonth();

  return new html({
    ...ledgerViews(userId),
    budgets: budgets.view({ userId }),
    view: { month },
  });
}
