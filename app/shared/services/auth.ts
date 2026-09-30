import { sql, session, redirect, AuthError } from "@elements/app";

/** The seeded account, shown on the sign-in page. */
export const DEMO_LOGIN = { email: "maya@thriftledger.dev", password: "budget-2026" };

interface User {
  id: string;
  name: string;
}

/** @rpc */
export function signin(email: string, password: string) {
  let address = email.trim().toLowerCase();

  if (!address || !password) {
    throw new AuthError("enter your email and password");
  }

  let user = sql<User>(`
    select id, name from users
     where email = ${address}
       and passwordHash = crypt(${password}, passwordHash)
  `).first();

  if (!user) {
    throw new AuthError("invalid email or password");
  }

  session.login({ userId: user.id, userName: user.name });
}

/** @rpc */
export function signout() {
  session.logout();
}

/**
 * The signed-in user's id. When there is none this redirects to sign in and
 * returns undefined, so the route returns without rendering.
 */
export function requireUser(): string | undefined {
  let userId = session.get("userId");

  if (!userId) {
    redirect("/signin");
  }

  return userId;
}
