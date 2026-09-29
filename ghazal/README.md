# الغزال للكتب

An Arabic-first bookstore design demo. Open `index.html` in a browser; no build step is required.

The catalog has twelve books with real Arabic-edition cover images. Cover source listings are documented in [`assets/covers/SOURCES.md`](assets/covers/SOURCES.md). Catalog data and sample prices are in `script.js`.

The basket supports quantities and persists in browser storage. The checkout collects delivery details, calculates sample delivery fees in Algerian dinars, reviews the order, and confirms cash on delivery. **This is a demo flow:** confirmed orders are saved only in the same browser under `ghazal.demoOrders.v1`; they are not sent to a merchant. The newsletter preview also saves locally. A live launch needs a merchant order endpoint, actual prices, inventory, delivery rates, and contact details.
