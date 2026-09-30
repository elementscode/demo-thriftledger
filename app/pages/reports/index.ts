import { Request, Response } from "@elements/app";
import { requireUser } from "#app/shared/services/auth";
import { ledgerViews } from "#app/shared/services/ledger";
import { currentMonth, isMonth } from "#app/shared/lib/ledger";
import html from "./template";

export default function route(req: Request, res: Response) {
  let userId = requireUser();

  if (!userId) {
    return;
  }

  return new html({
    ...ledgerViews(userId),
    view: { month: isMonth(req.query.month) ? req.query.month : currentMonth() },
  });
}
