import { redirect } from "next/navigation";
import { tenantDb } from "@/lib/db";
import { getSessionUser, userCount, type SessionUser } from "./session";

/** For pages and server components: the signed-in user, or a redirect to sign in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;
  redirect((await userCount()) === 0 ? "/setup" : "/login");
}

/** For pages: the user plus a database client scoped to them. */
export async function requireUserDb() {
  const user = await requireUser();
  return { user, db: tenantDb(user.id) };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Sign in to continue.");
  }
}

/** For route handlers: the user plus scoped client, or throws UnauthorizedError (see withApi). */
export async function requireApiUser() {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return { user, db: tenantDb(user.id) };
}
