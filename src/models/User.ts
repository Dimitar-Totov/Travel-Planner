import { Schema, model, models, type Document, type Model } from "mongoose";
import bcrypt from "bcrypt";

import { DEFAULT_USER_ROLE, USER_ROLES, type UserRole } from "@/lib/roles";

// Deliberately permissive/simple format check - the authoritative validation
// (including the "is this actually deliverable" question) belongs to a
// verification flow, not the schema. This just rejects obviously malformed
// input at the persistence layer as a last line of defense; the API/zod-style
// layer (`src/app/api/users/route.ts`) is the primary validator.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minLength: 2,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (value: string) => EMAIL_REGEX.test(value),
        message: "Please provide a valid email address",
      },
    },
    password: {
      type: String,
      required: true,
      // Never returned by default - callers must opt in with
      // `.select("+password")` (see `authorize` in `src/lib/auth.ts`).
      select: false,
      // No `minLength` here on purpose: this field stores the bcrypt
      // hash (always 60 chars), not the plaintext password, so a
      // schema-level length constraint on it is meaningless. Validate
      // the plaintext password length (>= 8) before it ever reaches
      // this model.
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: DEFAULT_USER_ROLE,
      required: true,
      // Unlike `password`, this is *not* `select: false` -
      // `authorize()` (`src/lib/auth.ts`) needs it on the exact same
      // sign-in read that already opts into `+password`, and there is
      // no confidentiality reason to hide it the way a password hash
      // is hidden. Indexed because the coming admin panel's very first
      // query is going to be "find everyone with role X".
      index: true,
    },
  },
  { timestamps: true },
);

// The schema `default` above - not any individual `User.create(...)` call
// site - is what guarantees every creation path ends up with "user": the
// registration route (`src/app/api/users/route.ts`), the guide-seeding
// script (`scripts/seed-guides.ts`), and any future path that creates a
// `User` without deciding otherwise. Keeping the guarantee here means a new
// call site can't forget it.

userSchema.pre("save", async function (this: IUser) {
  // Guard against re-hashing an already-hashed password on every
  // subsequent `save()` call (which would double-hash it and lock the
  // user out after the first update unrelated to their password).
  if (!this.isModified("password")) {
    return;
  }

  this.password = await bcrypt.hash(this.password, 10);
});

// `models.User ||` avoids `OverwriteModelError` on hot reload / repeated
// import in dev, where this module can be re-evaluated without the
// underlying mongoose connection/registry being reset.
const User: Model<IUser> = models.User || model<IUser>("User", userSchema);

export default User;
