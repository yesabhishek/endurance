import { getDb } from "@/lib/db";

export type AuditAction =
  | "auth.setup"
  | "auth.signup"
  | "auth.login"
  | "auth.login_failed"
  | "auth.logout"
  | "auth.password_changed"
  | "credential.saved"
  | "credential.deleted"
  | "kite.connected"
  | "kite.disconnected"
  | "gmail.connected"
  | "data.reset";

/** Records a security-relevant event. Never pass secrets in metadata. */
export async function audit(
  action: AuditAction,
  options: { userId?: string | null; ip?: string | null; userAgent?: string | null; metadata?: Record<string, unknown> } = {},
) {
  try {
    await getDb().auditEvent.create({
      data: {
        action,
        userId: options.userId ?? null,
        ip: options.ip ?? null,
        userAgent: options.userAgent?.slice(0, 300) ?? null,
        metadataJson: options.metadata ? JSON.stringify(options.metadata) : null,
      },
    });
  } catch (error) {
    console.error("[audit] could not record event", action, error);
  }
}
