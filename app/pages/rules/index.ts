import { Request, Response } from "@elements/app";
import { requireUser } from "#app/shared/services/auth";
import { ledgerViews, rules } from "#app/shared/services/ledger";
import html from "./template";

export default function route(req: Request, res: Response) {
  let userId = requireUser();

  if (!userId) {
    return;
  }

  return new html({ ...ledgerViews(userId), rules: rules.view({ userId }) });
}
