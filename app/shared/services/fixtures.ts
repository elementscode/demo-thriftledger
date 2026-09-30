import { sql, session } from "@elements/app";
import { Account, Category } from "#app/shared/lib/ledger";

/**
 * A signed-in user with one checking account and a category of each kind,
 * for tests. Every test rolls back, so nothing here outlives the test.
 */
export function makeLedger(email = "tess@example.com") {
  let user = sql<{ id: string }>(`
    insert into users (email, name, passwordHash)
         values (${email}, 'Tess', crypt('secret-pass', genSalt('bf', 4)))
      returning id
  `).firstOrThrow();

  session.login({ userId: user.id, userName: "Tess" });

  let checking = sql<Account>(`
    insert into accounts (userId, name, kind, openingBalanceCents)
         values (${user.id}, 'Checking', 'checking', 100000)
      returning *
  `).firstOrThrow();

  let category = (name: string, kind: string, colorSlot: number | null) =>
    sql<Category>(`
      insert into categories (userId, name, kind, colorSlot)
           values (${user.id}, ${name}, ${kind}, ${colorSlot})
        returning *
    `).firstOrThrow();

  return {
    userId: user.id,
    checking,
    groceries: category("Groceries", "expense", 1),
    dining: category("Dining", "expense", 2),
    salary: category("Salary", "income", null),
    transfers: category("Transfers", "transfer", null),
  };
}

export function addTransaction(
  userId: string,
  accountId: string,
  postedOn: string,
  description: string,
  amountCents: number,
  categoryId: string | null = null,
): string {
  return sql<{ id: string }>(`
    insert into transactions (userId, accountId, postedOn, description, amountCents, categoryId)
         values (${userId}, ${accountId}, ${postedOn}::date, ${description}, ${amountCents}, ${categoryId})
      returning id
  `).firstOrThrow().id;
}
