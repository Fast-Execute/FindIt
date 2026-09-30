"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Step = 1 | 2 | 3;

export default function EnrollDevicePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("My Phone");
  const [model, setModel] = useState("");
  const [platform, setPlatform] = useState("Android");
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [error, setError] = useState("");

  async function createEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authorized) {
      setError("Confirm that you own this device or are authorized to manage it.");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login?next=/dashboard/devices/enroll");
      return;
    }

    const id = crypto.randomUUID();
    const enrollmentCode = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();

    const { error: insertError } = await supabase.from("devices").insert({
      id,
      owner_id: user.id,
      name: name.trim() || "My Device",
      model: model.trim() || "Device model pending",
      platform,
      status: "UNREACHABLE",
      enrollment_code: enrollmentCode,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    const credentialResponse = await fetch("/api/device/credential", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: id }),
    });

    const credential = await credentialResponse.json();
    if (!credentialResponse.ok) {
      setError(credential.error ?? "Device was created, but its secure credential could not be issued.");
      setLoading(false);
      return;
    }

    setDeviceId(id);
    setDeviceToken(credential.token);
    setStep(3);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section>
        <a href="/dashboard/devices" className="text-sm font-semibold text-[var(--muted)] hover:text-white">← Back to devices</a>
        <p className="mt-8 text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Enrollment</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Protect a device.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">Create an authorized device record first. Status and location data only begins when a compatible device component is connected and permitted by the device owner.</p>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {[["1","Device"],["2","Authorize"],["3","Connected"]].map(([number,label], index) => (
          <div key={number} className={`rounded-2xl border p-4 ${step === index + 1 ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--line)] bg-[var(--panel)]"}`}>
            <div className="text-xs font-black text-[var(--muted)]">STEP {number}</div>
            <div className="mt-1 text-sm font-bold">{label}</div>
          </div>
        ))}
      </div>

      {step < 3 ? (
        <form onSubmit={createEnrollment} className="rounded-3xl border border-[var(--line)] bg-[var(--panel)] p-6 sm:p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div><h2 className="text-2xl font-black">Device details</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Give the device a name you will recognize in your recovery dashboard.</p></div>
              <Field label="Device name"><input value={name} onChange={e=>setName(e.target.value)} required className="input" placeholder="My Phone" /></Field>
              <Field label="Model"><input value={model} onChange={e=>setModel(e.target.value)} className="input" placeholder="Samsung Galaxy S24" /></Field>
              <Field label="Platform"><select value={platform} onChange={e=>setPlatform(e.target.value)} className="input"><option>Android</option><option>iOS</option><option>Other</option></select></Field>
              <button type="button" onClick={()=>setStep(2)} className="w-full rounded-2xl bg-[var(--accent)] px-5 py-3 font-black text-[#06100b] hover:brightness-110">Continue</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div><h2 className="text-2xl font-black">Confirm authorization</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">FindIt enrollment is intended for devices you own or have explicit permission to manage.</p></div>
              <label className="flex gap-4 rounded-2xl border border-[var(--line)] bg-black/10 p-5">
                <input type="checkbox" checked={authorized} onChange={e=>setAuthorized(e.target.checked)} className="mt-1 h-5 w-5 accent-[var(--accent)]" />
                <span><span className="font-bold">I own this device or am explicitly authorized to manage it.</span><span className="mt-1 block text-sm leading-6 text-[var(--muted)]">I understand that status/location collection requires device permissions and an authorized companion component.</span></span>
              </label>
              {error && <p className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
              <div className="flex flex-col gap-3 sm:flex-row"><button type="button" onClick={()=>setStep(1)} className="rounded-2xl border border-[var(--line)] px-5 py-3 font-bold">Back</button><button disabled={loading} type="submit" className="flex-1 rounded-2xl bg-[var(--accent)] px-5 py-3 font-black text-[#06100b] disabled:opacity-60">{loading ? "Creating enrollment…" : "Create authorized device"}</button></div>
            </div>
          )}
        </form>
      ) : (
        <section className="rounded-3xl border border-[var(--accent)]/30 bg-[var(--panel)] p-6 sm:p-8">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent)]/10 text-2xl text-[var(--accent)]">✓</div>
          <p className="mt-6 text-sm font-bold uppercase tracking-[.2em] text-[var(--accent)]">Enrollment created</p>
          <h2 className="mt-2 text-3xl font-black">Your device is ready to connect.</h2>
          <p className="mt-3 leading-7 text-[var(--muted)]">The account now has an authorized device record. The next stage will connect the device component and begin sending permitted status/location events.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[var(--line)] bg-black/10 p-5"><div className="text-xs font-bold uppercase tracking-[.16em] text-[var(--muted)]">Device ID</div><div className="mt-2 break-all font-mono text-sm">{deviceId}</div></div><div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5"><div className="text-xs font-bold uppercase tracking-[.16em] text-[var(--muted)]">Device credential</div><div className="mt-2 break-all font-mono text-sm">{deviceToken}</div><div className="mt-2 text-xs leading-5 text-[var(--muted)]">Shown once. Store it securely in the authorized companion.</div></div></div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button onClick={()=>router.push(`/dashboard/devices/${deviceId}`)} className="rounded-2xl bg-white px-5 py-3 font-black text-black">Open device</button><button onClick={()=>router.push("/dashboard/devices")} className="rounded-2xl border border-[var(--line)] px-5 py-3 font-bold">Back to devices</button></div>
        </section>
      )}

      <p className="text-xs leading-5 text-[var(--muted)]">FindIt does not bypass device security or claim universal live location after a phone is powered off.</p>
    </div>
  );
}

function Field({label, children}:{label:string; children:React.ReactNode}) {
  return <label className="block"><span className="mb-2 block text-sm font-bold">{label}</span>{children}</label>;
}