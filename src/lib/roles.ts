/**
 * The set of roles a `User` document can hold.
 *
 * This lives in its own module rather than alongside `lib/validation/auth.ts`
 * because it isn't a credential rule — `validation/auth.ts` is specifically
 * the home of the Zod schemas that police what a signed-in-or-signing-up
 * request is allowed to look like. A role is a domain fact about a user, and
 * it's consumed well outside that boundary: `models/User.ts`'s schema
 * (`enum: USER_ROLES`), the Auth.js module augmentation in
 * `types/next-auth.d.ts` (`User`/`Session`/`JWT` all carry a `UserRole`),
 * future route guards that will gate `/create-guide` and an eventual admin
 * panel on it, and future client UI that needs to render or branch on a
 * role. None of those have any business importing a module that also pulls
 * in registration/sign-in password rules, so the enum gets a home of its
 * own. Like `validation/auth.ts`, it stays dependency-free apart from plain
 * TypeScript/JS — no mongoose, bcrypt or `node:crypto` — so it's safe to
 * import from a client component.
 *
 * `"admin"` is declared now even though nothing in this codebase grants it —
 * no signup path, no self-serve upgrade, no API. It's declared anyway
 * because this array is the database's own constraint (`enum: USER_ROLES`
 * on the schema, see `models/User.ts`), not a UI convenience: adding a role
 * later means touching that schema *and* auditing every place that
 * exhaustively switches on `UserRole` (a `never` check should fail to
 * compile until each is updated), which is a bigger, riskier change than
 * declaring the value up front and simply never handing it out. There is
 * deliberately no code path that assigns `"admin"` to anyone — the first
 * admin account is minted by hand (a one-off database update), the same way
 * `scripts/seed-guides.ts`'s placeholder author is created outside any
 * public API.
 */

export const USER_ROLES = ["user", "guide", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** What every signup gets, absent any other instruction. See `models/User.ts`. */
export const DEFAULT_USER_ROLE: UserRole = "user";

/**
 * Narrows an unknown value (a raw Mongo field, a JWT claim read back off a
 * cookie, anything that crossed a serialization boundary) to `UserRole`.
 * Prefer this over a bare `as UserRole` cast anywhere a role's origin isn't
 * a freshly-read, freshly-validated Mongoose document.
 */
export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" &&
    (USER_ROLES as readonly string[]).includes(value)
  );
}
