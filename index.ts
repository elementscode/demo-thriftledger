import { App } from "@elements/app";
import config from "#config";
import home from "#app/pages/home";
import signin from "#app/pages/signin";
import transactions from "#app/pages/transactions";
import importPage from "#app/pages/import";
import sampleCsv from "#app/pages/import/sample";
import reports from "#app/pages/reports";
import accountsPage from "#app/pages/accounts";
import rulesPage from "#app/pages/rules";
import notFound from "#app/pages/errors/not-found";
import unhandled from "#app/pages/errors/unhandled";

const app = new App();

app.route("/", home);
app.route("/signin", signin);
app.route("/transactions", transactions);
app.route("/import", importPage);
app.route("/import/sample.csv", sampleCsv);
app.route("/reports", reports);
app.route("/accounts", accountsPage);
app.route("/rules", rulesPage);

app.error((req, res, err) => {
  switch (err.statusCode) {
    case 404:
      return notFound(req, res, err);

    default:
      return unhandled(req, res, err);
  }
});

app.start(config);
