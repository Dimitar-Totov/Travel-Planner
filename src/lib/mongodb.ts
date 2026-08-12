import mongoose, { type Mongoose } from "mongoose";

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  // `var` (not `let`/`const`) is required here: ambient global declarations
  // in a `declare global` block must use `var`.
  var mongoose: MongooseCache | undefined;
}

// Reuse the cache across hot reloads / module re-evaluations in dev, and
// across warm serverless invocations in prod.
const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

/**
 * Returns a cached Mongoose connection, creating one if necessary.
 *
 * The `MONGODB_URI` env var is only required at call time (not at module
 * evaluation time), so a build without the var configured doesn't crash
 * before this is ever invoked.
 */
export async function connectDB(): Promise<Mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Don't cache a rejected promise forever - let the next call retry.
    cached.promise = null;
    throw error;
  }

  return cached.conn;
}
