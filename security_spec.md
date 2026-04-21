# Security Specification

## Data Invariants
1. A transaction cannot be created or updated if its `employeeId` does not exist in the `employees` collection (Foreign Key Atomicity Rule).
2. Users can only fetch projects and lists they belong to if they are not HR/Admin.
3. Every document ID must strictly be validated against `isValidId` size (<128) and shape (alphanumeric/email format).
4. Unauthorised roles must not write to their own permissions (e.g. users modifying `role` or `isAdmin`). We explicitly limit updates via `incoming().diff(existing()).affectedKeys().hasOnly(['name'])`.
5. No client delegation for queries (no blanket queries without `resource.data` restriction for normal users). All basic user lists are constrained by `resource.data.employeeId == request.auth.uid`.

## The "Dirty Dozen" Payloads
1. **Shadow Update (Role Escalation):**
   ```json
   { "name": "Hack", "role": "Admin" } // fails validation on users/{id} update because only 'name' is in hasOnly
   ```
2. **Schema Break (Type Mismatch):**
   ```json
   { "name": 50 } // fails because name is string
   ```
3. **Denial of Wallet (Giant String ID):**
   ```json
   { "id": "A".repeat(2000) } // fails isValidId which expects size() <= 128
   ```
4. **Denial of Wallet (Giant Name):**
   ```json
   { "name": "A".repeat(300) } // fails isValidAppUser name.size() <= 256
   ```
5. **Orphaned Write (Bad Employee ID in Transaction):**
   ```json
   { "employeeId": "invalid", "month": "2023-01" } // fails exists() check on employees
   ```
6. **Identity Spoofing (Creating task as another user):**
   ```json
   { "creatorId": "admin-uid" } // fails incoming().creatorId == request.auth.uid
   ```
7. **Cross-Tenant Leak (Employees):**
   ```json
   // Querying `employees` list as Basic User without where clause
   // Fails rule: list: if isHR() || resource.data.employeeId == request.auth.uid
   ```
8. **Email Spoofing (Unverified Token):**
   ```json
   // request.auth.token.email_verified == false
   // Fails isSignedIn() helper
   ```
9. **The "Immortal Field" Attack:**
   ```json
   // Updating `employeeId` in existing employee document
   // Fails update rule constraint: incoming().employeeId == existing().employeeId
   ```
10. **The Update Gap (Missing schema keys on update):**
    ```json
    // Removing `status` from `projectTasks` update
    // Fails incoming().keys().hasAll(['status', ...])
    ```
11. **Malicious Enum Assignment:**
    ```json
    { "status": "Hacked" } // fails AppUser/PayrollRun status Enum blueprint
    ```
12. **PII Blanket Leak:**
    ```json
    // Querying transactions without ID as Basic user
    // Fails `resource.data.employeeId == request.auth.uid`
    ```

## The Test Runner (firestore.rules.test.ts)
```typescript
import { readFileSync, writeFileSync } from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

let testEnv;

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: 'test-project',
        firestore: { rules: readFileSync('firestore.rules', 'utf8') }
    });
});

afterAll(async () => {
    await testEnv.cleanup();
});

test('Dirty 1: Role Escalation is rejected', async () => {
    const db = testEnv.authenticatedContext('user123', { email: 'user@test.com', email_verified: true }).firestore();
    await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('users').doc('user@test.com').set({ name: 'Old', role: 'Viewer', status: 'Active', email: 'user@test.com' });
    });
    // Attempting update adding role
    await assertFails(db.collection('users').doc('user@test.com').update({ name: 'Hack', role: 'Admin' }));
});

// ... remaining tests implement the Dirty Dozen
```
