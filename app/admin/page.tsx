import { requireAdmin } from "@/lib/admin";
import { formatDateTime, planLabel } from "@/lib/plans";
import { PAID_PLANS, formatZar } from "@/lib/pricing";

type Overview = {
  users_total: number;
  users_7d: number;
  devices_total: number;
  devices_online: number;
  devices_lost_mode: number;
  subscribers: Record<string, number>;
  past_due: number;
  mrr_zar: number;
  revenue_30d_zar: number;
  emails_pending: number;
  emails_stuck: number;
  alerts_24h: number;
};

type UserRow = {
  user_id: string;
  user_email: string | null;
  signed_up_at: string;
  last_sign_in_at: string | null;
  plan: string;
  device_count: number;
};

type PaymentRow = {
  payment_id: number;
  user_email: string | null;
  amount_zar: number | null;
  payment_status: string;
  paid_at: string;
};

type EmailProblem = {
  outbox_id: number;
  kind: string;
  user_email: string | null;
  attempts: number;
  last_error: string | null;
  queued_at: string;
  gave_up: boolean;
};

const PAYMENT_STYLES: Record<string, string> = {
  COMPLETE: "text-[var(--accent)]",
  FAILED: "text-red-300",
  CANCELLED: "text-yellow-300",
  PENDING: "text-[var(--muted)]",
};

export default async function AdminPage() {
  // Every page re-checks; see lib/admin.ts.
  const { supabase } = await requireAdmin();

  const [overviewResult, usersResult, paymentsResult, problemsResult] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_recent_users", { p_limit: 15 }),
    supabase.rpc("admin_recent_payments", { p_limit: 15 }),
    supabase.rpc("admin_email_problems", { p_limit: 15 }),
  ]);

  if (overviewResult.error || !overviewResult.data) {
    return (
      <div className="rounded-3xl border border-red-400/20 bg-red-500/5 p-6 text-sm text-red-200">
        The admin data could not be loaded. Check that migration <code>0008_admin_console.sql</code> has been applied.
      </div>
    );
  }

  const overview = overviewResult.data as Overview;
  const users = (usersResult.data as UserRow[] | null) ?? [];
  const payments = (paymentsResult.data as PaymentRow[] | null) ?? [];
  const problems = (problemsResult.data as EmailProblem[] | null) ?? [];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Admin</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">How FindIt is doing.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">
          Accounts, billing and email delivery. Customer device locations are never shown here.
        </p>
      </section>

      {(overview.emails_stuck > 0 || overview.past_due > 0) && (
        <section className="space-y-3">
          {overview.emails_stuck > 0 && (
            <div className="rounded-2xl border border-red-400/20 bg-red-500/5 px-5 py-4 text-sm text-red-200">
              {overview.emails_stuck} {overview.emails_stuck === 1 ? "email has" : "emails have"} stopped retrying. See the list below, fix the cause, then requeue them (README: Email).
            </div>
          )}
          {overview.past_due > 0 && (
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 px-5 py-4 text-sm text-yellow-200">
              {overview.past_due} {overview.past_due === 1 ? "subscription is" : "subscriptions are"} past due.
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Accounts" value={String(overview.users_total)} note={`${overview.users_7d} new in 7 days`} />
        <Stat label="Monthly recurring revenue" value={formatZar(Number(overview.mrr_zar))} note="Active subscriptions" />
        <Stat label="Collected, last 30 days" value={formatZar(Number(overview.revenue_30d_zar))} note="Completed payments" />
        <Stat label="Devices" value={String(overview.devices_total)} note={`${overview.devices_online} online · ${overview.devices_lost_mode} in Lost Mode`} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PAID_PLANS.map((plan) => (
          <Stat key={plan} label={`${planLabel(plan)} subscribers`} value={String(overview.subscribers[plan] ?? 0)} note="Active or past due" />
        ))}
        <Stat label="Alerts, last 24 hours" value={String(overview.alerts_24h)} note={`${overview.emails_pending} emails waiting to send`} />
      </section>

      <Panel title="Newest accounts" empty="No accounts yet." isEmpty={users.length === 0}>
        <div className="hidden grid-cols-[1.6fr_.7fr_.5fr_1fr_1fr] gap-3 pb-2 text-xs uppercase tracking-[.12em] text-[var(--muted)] md:grid">
          <span>Email</span><span>Plan</span><span>Devices</span><span>Signed up</span><span>Last sign-in</span>
        </div>
        {users.map((row) => (
          <div key={row.user_id} className="grid gap-1 py-3 text-sm md:grid-cols-[1.6fr_.7fr_.5fr_1fr_1fr] md:items-center md:gap-3">
            <span className="break-all font-semibold">{row.user_email ?? "—"}</span>
            <span>{planLabel(row.plan)}</span>
            <span>{row.device_count}</span>
            <span className="text-xs text-[var(--muted)]">{formatDateTime(row.signed_up_at)}</span>
            <span className="text-xs text-[var(--muted)]">{row.last_sign_in_at ? formatDateTime(row.last_sign_in_at) : "Never"}</span>
          </div>
        ))}
      </Panel>

      <Panel title="Recent payments" empty="No payments yet." isEmpty={payments.length === 0}>
        {payments.map((row) => (
          <div key={row.payment_id} className="grid gap-1 py-3 text-sm md:grid-cols-[1fr_1.6fr_.8fr_1fr] md:items-center md:gap-3">
            <span className="font-semibold">{row.amount_zar == null ? "—" : formatZar(Number(row.amount_zar))}</span>
            <span className="break-all">{row.user_email ?? "Unknown account"}</span>
            <span className={`text-xs font-bold ${PAYMENT_STYLES[row.payment_status] ?? ""}`}>{row.payment_status}</span>
            <span className="text-xs text-[var(--muted)]">{formatDateTime(row.paid_at)}</span>
          </div>
        ))}
      </Panel>

      <Panel title="Email problems" empty="No failed emails." isEmpty={problems.length === 0}>
        {problems.map((row) => (
          <div key={row.outbox_id} className="grid gap-1 py-3 text-sm md:grid-cols-[1.2fr_1.4fr_.7fr_1.4fr] md:items-center md:gap-3">
            <span className="font-semibold">{row.kind}</span>
            <span className="break-all">{row.user_email ?? "Unknown account"}</span>
            <span className={`text-xs font-bold ${row.gave_up ? "text-red-300" : "text-yellow-300"}`}>{row.gave_up ? "Gave up" : `Retrying (${row.attempts})`}</span>
            <span className="break-words text-xs text-[var(--muted)]">{row.last_error ?? "—"}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
      <div className="text-xs uppercase tracking-[.12em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{note}</div>
    </div>
  );
}

function Panel({ title, empty, isEmpty, children }: { title: string; empty: string; isEmpty: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6">
      <h2 className="text-xl font-black">{title}</h2>
      {isEmpty ? <p className="mt-4 text-sm text-[var(--muted)]">{empty}</p> : <div className="mt-4 divide-y divide-[var(--line)]">{children}</div>}
    </section>
  );
}
