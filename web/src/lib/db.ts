import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Unscoped client. Use it only for identity (users, sessions), shared reference
 * data (securities) and audit events. Everything a user owns goes through tenantDb.
 */
export function getDb() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

const UNSCOPED_MODELS = new Set<Prisma.ModelName>(["User", "Session", "Security", "AuditEvent"]);

export const TENANT_MODELS = new Set<Prisma.ModelName>(
  Object.values(Prisma.ModelName).filter((model) => !UNSCOPED_MODELS.has(model)),
);

type Args = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn"]);
const UPDATE_OPERATIONS = new Set(["update", "updateMany", "updateManyAndReturn"]);

function withoutUserId(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const copy = { ...(data as Record<string, unknown>) };
  delete copy.userId;
  delete copy.user;
  return copy;
}

/** Applies the tenant rule to one query's arguments. Exported for tests. */
export function scopeArgs(operation: string, rawArgs: unknown, userId: string): Args {
  const args: Args = { ...((rawArgs as Args | undefined) ?? {}) };

  if (CREATE_OPERATIONS.has(operation)) {
    const stamp = (row: unknown) => ({ ...(row as Record<string, unknown>), userId });
    args.data = Array.isArray(args.data) ? args.data.map(stamp) : stamp(args.data);
    return args;
  }

  if (operation === "upsert") {
    args.where = { ...args.where, userId };
    args.create = { ...args.create, userId };
    args.update = withoutUserId(args.update) as Record<string, unknown>;
    return args;
  }

  // find*, count, aggregate, groupBy, update*, delete*
  args.where = { ...args.where, userId };
  if (UPDATE_OPERATIONS.has(operation)) {
    args.data = withoutUserId(args.data);
  }
  return args;
}

function createTenantClient(userId: string) {
  return getDb().$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model as Prisma.ModelName)) return query(args);
          return query(scopeArgs(operation, args, userId) as typeof args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof createTenantClient>;

/**
 * Client bound to one user. Every read and write on a user-owned model is
 * filtered by, or stamped with, this userId; callers cannot widen it.
 */
export function tenantDb(userId: string): TenantDb {
  if (!userId) throw new Error("tenantDb requires a userId.");
  return createTenantClient(userId);
}

export type DbClient = ReturnType<typeof getDb>;
