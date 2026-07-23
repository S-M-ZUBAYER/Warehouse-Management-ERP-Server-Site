# Manual Order EasyParcel Final Patch Notes

Scope: Manual Order only.

## Implemented
- Malaysia and Singapore domestic EasyParcel manual-order booking remains provider-routed by sender/warehouse country.
- Manual Order list uses EasyParcel-aligned statuses:
  - Created
  - Booking Pending
  - Booking Failed
  - Schedule In Arrangement
  - To Be Collected
  - Drop Off
  - Collected
  - Delivery In Transit
  - Delivery On Hold
  - Delivered
  - Returned
  - Cancelled
- Tracking refresh uses EasyParcel OpenAPI tracking status endpoint and stores both raw provider status and normalized ERP status.
- Cancel endpoint added for EasyParcel shipments before courier processing/collection.
- Cancelled EasyParcel manual orders can be pushed again; old cancelled AWB/PDF is not reused after a new push attempt.
- Prepaid and COD manual order data is stored in the existing manual_orders/logistic_raw fields.
- Optional payment certificate upload is stored under uploads/manual-payment-certificates and referenced from the manual order.
- Waybill URL/PDF and filename are stored so PWB again can reopen the saved waybill.

## Database changes
Run migrations/027_update_manual_order_status_cancel_certificate.sql after the previous manual-order migrations.

No new shipment or COD settlement tables were added in this patch. For the current MY/SG manual-order flow, the existing manual_orders, manual_order_items and manual_order_status_history tables are enough. Add separate wallet/COD settlement ledger tables later only if you implement multi-company wallet settlement and COD payout accounting.
