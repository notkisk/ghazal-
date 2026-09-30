
  1. Replace localStorage demo storage with a real backend/database.
      - Books, stock, discounts, publishers, authors, orders, users.
      - Orders must remain available across devices and browsers.

  2. Secure the owner dashboard properly.
      - Real authentication.
      - Owner/admin roles.
      - Server-side authorization.
      - Audit log for edits, deletions, stock changes, and exports.

  3. Finish Ecotrack integration.
      - Generate the exact XLSX template format.
      - Append selected orders to the original workbook structure.
      - Validate wilaya, commune, phone, shipment type, prices, and required
        columns before export.

      - Add export history and prevent duplicate exports.

  4. Improve inventory management.
      - Stock reservations during checkout.
      - Automatic stock deduction after confirmation.
      - Restock history.
      - Low-stock alerts.
      - Bulk stock updates.
      - Prevent orders when stock is insufficient.

  5. Complete the order workflow.
      - Statuses: new, confirmed, preparing, shipped, delivered, cancelled,
        returned.

      - Customer order lookup.
      - Internal notes.
      - Order timeline.
      - Filtering by status, wilaya, commune, date, and payment/shipping type.

  6. Make the bulk book importer production-ready.
      - Duplicate detection.
      - Update existing books instead of creating duplicates.
      - Image upload mapping.
      - Author/publisher matching.
      - Import validation report.
      - Undo last import.

  7. Improve search and discovery.
      - Search by title, author, publisher, genre, and ISBN.
      - Better related-book recommendations.
      - “Recently viewed”.
      - “Similar books”.
      - Proper empty and unavailable states.

  8. Add testing before further expansion.
      - Mobile checkout tests.
      - Cart animation tests.
      - Order creation tests.
      - Stock tests.
      - Ecotrack export tests.
      - Bulk import tests.
      - Dashboard permission tests.

  9. Add store essentials.
      - Privacy policy and terms.
      - Shipping/returns information.
      - Contact page.
      - SEO metadata.
      - Open Graph previews.
      - Favicon.
      - Image optimization and loading states.

  10. Polish the dashboard.

  - Better analytics with date ranges.
  - Revenue by period, wilaya, publisher, and book.
  - Best sellers.
  - Conversion rate.
  - Abandoned carts.
  - Low-stock and unavailable alerts.
  - Exportable reports.
