import "server-only";

/**
 * Platform operator (super-admin) allowlist. There is no staff role in the
 * schema by design; operators are identified by email via the OPERATOR_EMAILS
 * env var (comma-separated). Secure default: if unset, nobody is an operator.
 */
export function isOperator(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.OPERATOR_EMAILS ?? "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}
