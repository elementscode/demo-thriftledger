import { test, equal, assert, session } from "@elements/app";
import { signin } from "#app/shared/services/auth";
import { makeLedger } from "#app/shared/services/fixtures";

test("signin", () => {
  test("the right password signs in", () => {
    let ledger = makeLedger();
    session.logout();

    signin(" Tess@Example.com ", "secret-pass");
    equal(session.get("userId"), ledger.userId);
  });

  test("a wrong password does not say which part was wrong", () => {
    makeLedger();
    session.logout();

    let message = "";

    try {
      signin("tess@example.com", "not-it");
    } catch (err: any) {
      message = err.message;
    }

    equal(message, "invalid email or password");
    assert(!session.isLoggedIn());
  });
});
