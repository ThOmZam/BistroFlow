# Security Specification: BistroFlow Restaurant OS

## 1. Data Invariants
- An `Order` cannot exist without a valid `Session` and `Account`.
- `stock` in `inventory` can only be modified by specific roles or via the "Inventory Deduction" logic (server-side preference, but for this demo we'll use secure client-side updates wrapped in business logic).
- A `Session` status change to 'closed' is terminal and prevents further orders.
- `User` profiles (especially PIN and Role) must be strictly protected.

## 2. The Dirty Dozen (Attacks to Block)
1. **Identity Theft**: User A tries to change their own role to 'admin' in `users` collection.
2. **Session Hijacking**: Waiter A tries to close a session belonging to another waiter's table (if we had waiter ownership, currently global for the restaurant team).
3. **Double Billing**: Multiple sessions active for the same table.
4. **Negative Stock**: Trying to set `stock` to a negative value.
5. **Ghost Orders**: Creating an order in a `closed` session.
6. **Price Spoofing**: Changing the price of a `MenuItem` (if client allowed it).
7. **Phantom Tables**: Creating tables with invalid IDs.
8. **PII Leak**: Accessing other users' PINs.
9. **History Tampering**: Modifying a `Transaction` after it's been created.
10. **State Skipping**: Changing order status from `pending` directly to `delivered` skipping `preparing` and `ready` (if enforced).
11. **Resource Exhaustion**: Sending 1MB strings as order notes.
12. **Unauthorized Payment**: Closing a session without a recorded transaction.

## 3. Test Runner (Conceptual/Draft)
We will verify that:
- `create` on `orders` fails if `session.status == 'closed'`.
- `update` on `users` fails for the `role` field unless the request is from an existing `admin`.
- `read` on `inventory` is restricted to authenticated staff.
