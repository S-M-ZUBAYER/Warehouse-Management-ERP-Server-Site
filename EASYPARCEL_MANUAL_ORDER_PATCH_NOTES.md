# EasyParcel Manual Order Patch Notes

Scope: manual order module only.

## Backend changes
- Completed Malaysia/Singapore manual-order logistics flow.
- Added saved-only, booking failed, AWB ready, pickup, transit, delivered, returned, cancelled statuses.
- Added Manual Order detail endpoint.
- Added saved-order EasyParcel push endpoint.
- Added EasyParcel status refresh endpoint.
- Stored sender, receiver, package, COD, AWB, tracking, provider order, waybill URL, booking error, and raw provider response data in `manual_orders`.
- Added `manual_order_status_history` to audit status changes.
- Added migration `026_update_manual_orders_for_logistics.sql`.

## Required DB update
Run the new migration or run Sequelize sync alter:

```bash
npm run db:sync
```

Production recommendation: run the SQL migration first, then restart backend.

## New endpoints
- `GET /api/v1/order-management/manual-orders?status=CREATED`
- `GET /api/v1/order-management/manual-orders/:id`
- `POST /api/v1/order-management/manual-orders/:id/easyparcel/submit`
- `POST /api/v1/order-management/manual-orders/:id/easyparcel/status`

## Status behavior
- Save Only -> `CREATED`
- Save + Submit EasyParcel -> `BOOKING_PENDING`, then `AWB_READY` or `BOOKING_FAILED`
- PWB again uses stored waybill URL; it does not create duplicate shipment.
- Refresh status calls EasyParcel tracking/status endpoint and stores status history.
