# Security Specification: Okane Firestore RBAC & Data Integrity

## 1. Data Invariants

1. **User Sandboxing & Data Isolation**: All data collections (`expenses`, `friends`, `wallets`, `settlements`, `recurringRules`, `settings`) are strictly scoped under the path `/users/{userId}/...`. A user may never read, list, create, update, or delete any resource belonging to another user.
2. **Authentication & Identity Integrity**: The user must be authenticated (`request.auth != null`). The document's `userId` field (or subcollection parent path `{userId}`) must strictly match `request.auth.uid`.
3. **No Blanket Queries**: `allow list` operations must strictly ensure `request.auth.uid == userId` to prevent scraping or accidental broad leaks.
4. **Path & ID Variable Hardening**: Document IDs and route parameters must strictly adhere to the `isValidId()` format (max 128 chars, alphanumeric with underscore and dash).
5. **Payload Schema & Type Safety**: Every field in every payload must strictly adhere to allowed types and bounded lengths (`isValidExpense()`, `isValidFriend()`, etc.).
6. **Denial-of-Wallet Protection**: Strings and arrays must have strict length ceilings (`maxLength`) to prevent storage amplification and cost attacks.
7. **Action-Based Partial Updates**: Updates must explicitly whitelist affected keys (`affectedKeys().hasOnly(...)`) and retain user ownership (`incoming().userId == existing().userId`).

---

## 2. The "Dirty Dozen" Payloads (Exploit Scenarios)

The following 12 payloads represent malicious or invalid payloads that MUST return `PERMISSION_DENIED`:

1. **Payload 1: Unauthenticated Read/Write**: Attempting to read `/users/user_abc/expenses/exp_1` without any auth credentials.
2. **Payload 2: Cross-User Read**: User `attacker_123` attempting to read `/users/victim_456/expenses/exp_victim`.
3. **Payload 3: Cross-User List Query**: User `attacker_123` attempting to query/list `/users/victim_456/friends`.
4. **Payload 4: Identity Spoofing on Create**: User `user_1` attempting to create an expense in `/users/user_1/expenses/exp_1` with `userId: "user_2"`.
5. **Payload 5: Path Traversal / Poisoned ID**: Attempting to create an expense at `/users/user_1/expenses/../../root_hack`.
6. **Payload 6: Huge String Payload (Denial-of-Wallet)**: Creating an expense where `description` is a 1MB junk string (exceeds 256 chars limit).
7. **Payload 7: Shadow Field / Ghost Field Injection**: Attempting to write `{ id: "exp_1", description: "Lunch", amount: 20, ... other fields, isVerified: true, isAdmin: true }`.
8. **Payload 8: Negative/Invalid Amount Type**: Attempting to write an expense with `amount: "twenty"` (string instead of number).
9. **Payload 9: Cross-User Settlement Update**: User `attacker_123` attempting to update `/users/victim_456/settlements/settle_1`.
10. **Payload 10: Modifying Immutable Owner**: Updating an existing wallet and attempting to change `userId` from `user_1` to `user_2`.
11. **Payload 11: Invalid Enum Bypass**: Writing an expense with `flow: "sideways"` or `type: "stolen"`.
12. **Payload 12: Blank Parent Read**: Querying the root `/{document=**}` catch-all to scan entire database.

---

## 3. The Test Runner (firestore.rules.test.ts)

A test specification simulating these conditions to guarantee rejection.
