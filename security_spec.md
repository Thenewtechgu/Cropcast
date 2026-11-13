# CropCast Cloud Firestore Security Specification

## 1. Data Invariants (Eight Pillars Zero-Trust Model)

1. **PII Isolation & Identity Ownership**:
   - `/users/{userId}` holds user PII (`email`, `displayName`, `photoURL`) and is readable only by the owning UID (`request.auth.uid == userId`) or a verified Admin (`isAdmin()`).
   - User-owned plots, plans, tasks, feedbacks, Earth metrics, and shared references live strictly inside `/users/{userId}/...` subcollections.
2. **Master Gate Relational Sync**:
   - Every create in `/users/{userId}/plots/{plotId}` or `/users/{userId}/shared_refs/{plotId}` verifies `exists(/databases/$(database)/documents/users/$(userId))`.
   - Every create in `/users/{userId}/plans/{planId}`, `/tasks/{taskId}`, `/feedbacks/{feedbackId}`, and `/earth_metrics/{metricId}` verifies both the parent user document AND the referenced parent plot document (`/users/$(userId)/plots/$(...)`).
   - Creating a `/field_shares/{shareId}` invite verifies the referenced plot exists under `/users/$(request.auth.uid)/plots/$(incoming().fieldId)` and belongs to `request.auth.uid`.
3. **Anti-Update-Gap & Strict Schema Validation**:
   - Standalone `isValid[Entity](data)` validators run on BOTH `create` and `update` for every collection.
   - Creates enforce `keys().hasAll(...)` and `keys().hasOnly(...)` matching `firebase-blueprint.json`.
   - Updates enforce `incoming().diff(existing()).affectedKeys().hasOnly(...)` per action, immutable identity (`ownerId`, `uid`, `fieldId`, `plotId`), immutable `createdAt`, and server-enforced `request.time`.
4. **Path Variable Hardening & Resource Bounds**:
   - Single-doc reads/writes enforce `isValidId()` (`^[a-zA-Z0-9_\\-]+$`, max 128 chars).
   - Every `string` and `list` field carries explicit `.size()` bounds.
5. **Email Spoofing Guard for Admin RBAC**:
   - `isAdmin()` requires `request.auth.token.email_verified == true` alongside either a bootstrap admin email (`vanha.uow@gmail.com`, `fss01211cg@gmail.com`) or an `/admins/{uid}` document.
6. **Zero-Trust Share Token Redemption**:
   - Non-owners cannot overwrite plot details; link redemption only permits appending `request.auth.uid` to `sharedWithUids` if `incoming().presentedShareToken == existing().activeShareToken` (`size >= 12`).

## 2. The "Dirty Dozen" Attack Payloads

1. **Shadow Field Injection on Plot Create**: Adding `{ isVerified: true, adminBypass: true }` to `/users/{uid}/plots/{plotId}`. -> `PERMISSION_DENIED`
2. **Identity Spoofing on Task Create**: Authenticated as `userB`, setting `ownerId: "userA"` inside `/users/userB/tasks/{taskId}` or creating under `/users/userA/tasks/{taskId}`. -> `PERMISSION_DENIED`
3. **Orphaned Plan Create**: Creating `/users/userA/plans/NO_SUCH_PLOT` where parent `/users/userA/plots/NO_SUCH_PLOT` does not exist. -> `PERMISSION_DENIED`
4. **Email Spoofing Admin Escalation**: Authenticated with unverified email `email_verified: false` claiming `vanha.uow@gmail.com` or `fss01211cg@gmail.com` attempting to read `/nasa_sync_logs` or create `/admins/{uid}`. -> `PERMISSION_DENIED`
5. **Cross-Tenant PII Read**: Authenticated `userB` calling `get` or `list` on `/users/userA`. -> `PERMISSION_DENIED`
6. **Resource Exhaustion / 1MB String Poisoning**: Sending a 200KB string in `name` or a 2KB document ID to `/users/{uid}/plots/{hugeId}`. -> `PERMISSION_DENIED`
7. **Timestamp Forgery**: Setting `createdAt` or `updatedAt` to a client-chosen past timestamp instead of `request.time`. -> `PERMISSION_DENIED`
8. **Immutable Owner Tampering**: Attempting to change `ownerId` or `createdAt` during an `update` on `/users/{uid}/plots/{plotId}`. -> `PERMISSION_DENIED`
9. **Unauthorized Share Redemption Without Token**: `userB` attempting to append `userB` to `sharedWithUids` on `/users/userA/plots/{plotId}` with an invalid or empty `presentedShareToken`. -> `PERMISSION_DENIED`
10. **Non-Owner Mutating Plot Soil/Crop Data via Share Update Branch**: `userB` sending a valid `presentedShareToken` while also mutating `name` or `areaHa`. -> `PERMISSION_DENIED`
11. **Terminal Dataset Re-Poisoning by Non-Admin**: Farmer attempting to update or delete `/nasa_datasets/{datasetId}` or modify `uploadedBy`. -> `PERMISSION_DENIED`
12. **Blanket Query Scraping on Plots/Tasks**: Querying `/users/{userA}/plots` or `/field_shares` as an unrelated signed-in user `userB`. -> `PERMISSION_DENIED`
