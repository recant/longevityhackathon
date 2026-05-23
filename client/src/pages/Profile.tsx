import { useEffect, useState } from "react";
import { getProfile, updateProfile, type Profile as ProfileType } from "../api";

export default function Profile() {
  const [form, setForm] = useState<Partial<ProfileType>>({});
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getProfile()
      .then((p) =>
        setForm({
          display_name: p.display_name,
          age: p.age ?? 68,
          sex: p.sex ?? "female",
          lifestyle: p.lifestyle ?? "",
          medications: p.medications ?? "",
          smoking: p.smoking ?? "never",
          sleep_habits: p.sleep_habits ?? "",
        })
      )
      .catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await updateProfile(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Save failed");
    }
  };

  return (
    <section className="card">
      <h2>Parent profile</h2>
      <p className="muted">
        Scores are adjusted for age and sex — this helps compare to typical patterns, not to
        judge.
      </p>
      <form onSubmit={submit}>
        <label className="field-label">Name</label>
        <input
          value={form.display_name ?? ""}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          placeholder="Mom, Dad, etc."
        />
        <label className="field-label">Age</label>
        <input
          type="number"
          min={50}
          max={110}
          value={form.age ?? ""}
          onChange={(e) => setForm({ ...form, age: Number(e.target.value) })}
        />
        <label className="field-label">Sex (for norm comparison)</label>
        <select
          value={form.sex ?? ""}
          onChange={(e) => setForm({ ...form, sex: e.target.value })}
        >
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="other">Other / prefer not to say</option>
        </select>
        <label className="field-label">Lifestyle notes</label>
        <textarea
          rows={2}
          value={form.lifestyle ?? ""}
          onChange={(e) => setForm({ ...form, lifestyle: e.target.value })}
          placeholder="Active gardener, retired teacher…"
        />
        <label className="field-label">Medications (optional)</label>
        <input
          value={form.medications ?? ""}
          onChange={(e) => setForm({ ...form, medications: e.target.value })}
        />
        <label className="field-label">Smoking</label>
        <select
          value={form.smoking ?? "never"}
          onChange={(e) => setForm({ ...form, smoking: e.target.value })}
        >
          <option value="never">Never</option>
          <option value="former">Former</option>
          <option value="current">Current</option>
        </select>
        <label className="field-label">Sleep habits</label>
        <textarea
          rows={2}
          value={form.sleep_habits ?? ""}
          onChange={(e) => setForm({ ...form, sleep_habits: e.target.value })}
          placeholder="Wakes at night, snoring, naps…"
        />
        <button className="btn block" type="submit">
          Save profile
        </button>
      </form>
      {saved && <p className="success-msg">Saved.</p>}
      {err && <p className="error">{err}</p>}
    </section>
  );
}
