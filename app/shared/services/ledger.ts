import { LiveTable, sql, tx, session, ForbiddenError, ValidationError } from "@elements/app";
import {
  Account,
  Budget,
  Category,
  CsvMapping,
  ImportRecord,
  Rule,
  Split,
  Transaction,
} from "#app/shared/lib/ledger";
import { fingerprints, mapCsv, parseCsv } from "#app/shared/lib/csv";

function ownerId(): string {
  return session.getOrThrow("userId");
}

function mustOwn(table: "accounts" | "categories" | "rules" | "budgets", id: string) {
  let userId = ownerId();
  let found = false;

  switch (table) {
    case "accounts":
      found = !sql(`select 1 from accounts where id = ${id} and userId = ${userId}`).empty();
      break;

    case "categories":
      found = !sql(`select 1 from categories where id = ${id} and userId = ${userId}`).empty();
      break;

    case "rules":
      found = !sql(`select 1 from rules where id = ${id} and userId = ${userId}`).empty();
      break;

    case "budgets":
      found = !sql(`select 1 from budgets where id = ${id} and userId = ${userId}`).empty();
      break;
  }

  if (!found) {
    throw new ForbiddenError();
  }
}

function requireName(name: string | undefined, what: string): string {
  let clean = (name ?? "").trim();

  if (clean === "") {
    throw new ValidationError(`give the ${what} a name`);
  }

  return clean;
}

/**
 * Every table below is opened partitioned by the signed-in user, in the route.
 * The partition keeps a browser from naming another user's rows on insert;
 * the handlers check the rows it names on update and delete really are theirs.
 */
export let accounts: LiveTable<Account> = new LiveTable<Account>({
  insert: (item) => {
    let name = requireName(item.name, "account");

    if (item.kind !== "checking" && item.kind !== "savings" && item.kind !== "credit") {
      throw new ValidationError("choose checking, savings or credit card");
    }

    return accounts.insert({ ...item, name, institution: (item.institution ?? "").trim() });
  },

  update: (item) => {
    mustOwn("accounts", item.id);
    return accounts.update({ ...item, name: requireName(item.name, "account") });
  },

  delete: (item) => {
    mustOwn("accounts", item.id);
    accounts.delete(item);
  },
});

export let categories: LiveTable<Category> = new LiveTable<Category>({
  insert: (item) => {
    let name = requireName(item.name, "category");
    let kind = item.kind ?? "expense";
    let colorSlot: number | null = null;

    // A new expense category takes the first chart color no other holds;
    // past eight it shares "Other".
    if (kind === "expense") {
      let taken = sql<{ colorSlot: number }>(`
        select colorSlot from categories where userId = ${ownerId()} and colorSlot is not null
      `).all().map((r) => r.colorSlot);

      colorSlot = [1, 2, 3, 4, 5, 6, 7, 8].find((slot) => !taken.includes(slot)) ?? null;
    }

    if (!sql(`select 1 from categories where userId = ${ownerId()} and lower(name) = lower(${name})`).empty()) {
      throw new ValidationError(`there is already a category named ${name}`);
    }

    return categories.insert({ ...item, name, kind, colorSlot });
  },

  update: (item) => {
    mustOwn("categories", item.id);
    return categories.update({ ...item, name: requireName(item.name, "category") });
  },

  delete: (item) => {
    mustOwn("categories", item.id);
    categories.delete(item);
  },
});

export let rules: LiveTable<Rule> = new LiveTable<Rule>({
  insert: (item) => {
    let pattern = (item.pattern ?? "").trim().toLowerCase();

    if (pattern.length < 2) {
      throw new ValidationError("a rule needs at least two characters to match");
    }

    mustOwn("categories", item.categoryId ?? "");

    return tx(() => {
      let rule = rules.insert({ ...item, pattern });

      // A new rule categorizes what is waiting for it. The transactions
      // trigger carries each change to every open page.
      sql(`
        update transactions
           set categoryId = ${rule.categoryId}
         where userId = ${ownerId()}
           and categoryId is null
           and splits is null
           and description ilike ${"%" + escapeLike(pattern) + "%"}
      `);

      return rule;
    });
  },

  update: (item) => {
    mustOwn("rules", item.id);
    mustOwn("categories", item.categoryId);
    return rules.update({ ...item, pattern: item.pattern.trim().toLowerCase() });
  },

  delete: (item) => {
    mustOwn("rules", item.id);
    rules.delete(item);
  },
});

export let budgets: LiveTable<Budget> = new LiveTable<Budget>({
  insert: (item) => {
    mustOwn("categories", item.categoryId ?? "");
    return budgets.insert({ ...item, amountCents: requireAmount(item.amountCents) });
  },

  update: (item) => {
    mustOwn("budgets", item.id);
    return budgets.update({ ...item, amountCents: requireAmount(item.amountCents) });
  },

  delete: (item) => {
    mustOwn("budgets", item.id);
    budgets.delete(item);
  },
});

function requireAmount(cents: number | undefined): number {
  if (typeof cents !== "number" || !Number.isInteger(cents) || cents < 0) {
    throw new ValidationError("a budget is an amount of zero or more");
  }

  return cents;
}

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => "\\" + c);
}

/** Written by importCsv through a view, so the history on an open page updates. */
export let imports: LiveTable<ImportRecord> = new LiveTable<ImportRecord>({
  insert: (item) => {
    mustOwn("accounts", item.accountId ?? "");
    return imports.insert(item);
  },

  update: () => {
    throw new ForbiddenError();
  },

  delete: () => {
    throw new ForbiddenError();
  },
});

/**
 * Written to by imports and bulk rule updates as well as through the view, so
 * a trigger broadcasts every write on a channel pinned here (see the
 * transactionsNotify migration). postedOn crosses as YYYY-MM-DD text.
 */
export let transactions: LiveTable<Transaction> = new LiveTable<Transaction>({
  channel: (partition) => (partition ? `transactions:${partition}` : "transactions"),

  select: ({ userId }) => sql<Transaction>(`
    select id, userId, accountId, to_char(postedOn, 'YYYY-MM-DD') as postedOn,
           description, amountCents, categoryId, splits
      from transactions
     where userId = ${userId}
  `),

  insert: () => {
    throw new ForbiddenError();
  },

  update: (item) => {
    let userId = ownerId();
    let current = sql<{ amountCents: number }>(`
      select amountCents from transactions where id = ${item.id} and userId = ${userId}
    `).first();

    if (!current) {
      throw new ForbiddenError();
    }

    let splits = checkSplits(item.splits, current.amountCents);
    let categoryId = splits ? null : item.categoryId;

    if (categoryId) {
      mustOwn("categories", categoryId);
    }

    return sql<Transaction>(`
      update transactions
         set categoryId = ${categoryId},
             splits = ${splits ? JSON.stringify(splits) : null}::jsonb
       where id = ${item.id}
         and userId = ${userId}
   returning id, userId, accountId, to_char(postedOn, 'YYYY-MM-DD') as postedOn,
             description, amountCents, categoryId, splits
    `).firstOrThrow();
  },

  delete: (item) => {
    sql(`delete from transactions where id = ${item.id} and userId = ${ownerId()}`);
  },
});

/** Two or more parts, each in one of the user's categories, adding up to the whole. */
function checkSplits(splits: Split[] | null, amountCents: number): Split[] | null {
  if (!splits || splits.length === 0) {
    return null;
  }

  if (splits.length < 2) {
    throw new ValidationError("a split needs at least two parts");
  }

  let total = 0;

  for (let part of splits) {
    if (!Number.isInteger(part.amountCents) || part.amountCents === 0) {
      throw new ValidationError("every part of a split needs an amount");
    }

    mustOwn("categories", part.categoryId);
    total += part.amountCents;
  }

  if (total !== amountCents) {
    throw new ValidationError("the parts of a split must add up to the transaction");
  }

  return splits.map((p) => ({ categoryId: p.categoryId, amountCents: p.amountCents }));
}

export interface ImportForm {
  accountId: string;
  fileName: string;
  text: string;
  mapping: CsvMapping;
}

export interface ImportResult {
  added: number;
  skipped: number;
  categorized: number;
  errors: string[];
}

/**
 * Parses and maps the file here, not in the browser, which only previews it.
 * The mapping is saved to the account so the next export from the same bank
 * imports with no questions.
 * @rpc
 */
export function importCsv(form: ImportForm): ImportResult {
  let userId = ownerId();
  mustOwn("accounts", form.accountId);

  if (form.text.length > 5_000_000) {
    throw new ValidationError("that file is over 5 MB; export a shorter date range");
  }

  let { rows, errors } = mapCsv(parseCsv(form.text), form.mapping);

  if (rows.length === 0) {
    throw new ValidationError(errors[0] ?? "the file has no transactions in it");
  }

  let ruleList = sql<Rule>(`select * from rules where userId = ${userId}`).all();
  let prints = fingerprints(rows);
  let added = 0;
  let categorized = 0;

  tx(() => {
    rows.forEach((row, i) => {
      let rule = matchLongest(ruleList, row.description);
      let inserted = !sql(`
        insert into transactions (userId, accountId, postedOn, description, amountCents, categoryId, fingerprint)
             values (${userId}, ${form.accountId}, ${row.postedOn}::date, ${row.description},
                     ${row.amountCents}, ${rule?.categoryId ?? null}, ${prints[i]})
        on conflict (accountId, fingerprint) do nothing
          returning id
      `).empty();

      if (inserted) {
        added++;

        if (rule) {
          categorized++;
        }
      }
    });

    let account = sql<Account>(`select * from accounts where id = ${form.accountId}`).firstOrThrow();
    accounts.view({ userId }).update({ ...account, csvMapping: form.mapping });

    imports.view({ userId }).insert({
      userId,
      accountId: form.accountId,
      fileName: form.fileName.slice(0, 200) || "upload.csv",
      addedCount: added,
      skippedCount: rows.length - added,
    });
  });

  return { added, skipped: rows.length - added, categorized, errors };
}

function matchLongest(ruleList: Rule[], description: string): Rule | undefined {
  let text = description.toLowerCase();
  let best: Rule | undefined;

  for (let rule of ruleList) {
    if (text.includes(rule.pattern) && (!best || rule.pattern.length > best.pattern.length)) {
      best = rule;
    }
  }

  return best;
}

/**
 * Runs every rule over the transactions still uncategorized.
 * @rpc
 */
export function applyRules(): number {
  let userId = ownerId();

  return sql<{ id: string }>(`
    update transactions t
       set categoryId = (
             select r.categoryId
               from rules r
              where r.userId = ${userId}
                and t.description ilike '%' || replace(replace(replace(r.pattern, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%'
              order by length(r.pattern) desc, r.createdAt
              limit 1
           )
     where t.userId = ${userId}
       and t.categoryId is null
       and t.splits is null
       and exists (
             select 1 from rules r
              where r.userId = ${userId}
                and t.description ilike '%' || replace(replace(replace(r.pattern, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%'
           )
 returning t.id
  `).all().length;
}

/** The views every signed-in page reads, for this user. */
export function ledgerViews(userId: string) {
  return {
    accounts: accounts.view({ userId }),
    categories: categories.view({ userId }),
    transactions: transactions.view({ userId }),
  };
}
