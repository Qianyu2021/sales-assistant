import { useState } from "react";

const EMPTY = {
  firstName: "", lastName: "", email: "",
  company: "", address: "", city: "", state: "",
};

export default function ManualForm({ onSubmit }) {
  const [form, setForm] = useState(EMPTY);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function handleSubmit() {
    if (!form.email || !form.company) return;
    onSubmit({ ...form, source: "manual" });
    setForm(EMPTY);
  }

  return (
    <div className="form-body">
      <div className="form-row">
        <div className="form-field">
          <label className="field-label">First name</label>
          <input className="field-input" value={form.firstName} onChange={set("firstName")} placeholder="Sarah" />
        </div>
        <div className="form-field">
          <label className="field-label">Last name</label>
          <input className="field-input" value={form.lastName} onChange={set("lastName")} placeholder="Chen" />
        </div>
      </div>
      <div className="form-field form-full">
        <label className="field-label">Email address *</label>
        <input className="field-input" type="email" value={form.email} onChange={set("email")} placeholder="sarah@company.com" />
      </div>
      <div className="form-field form-full">
        <label className="field-label">Company *</label>
        <input className="field-input" value={form.company} onChange={set("company")} placeholder="Greywood Properties" />
      </div>
      <div className="form-field form-full">
        <label className="field-label">Property address</label>
        <input className="field-input" value={form.address} onChange={set("address")} placeholder="4821 Lakeview Drive" />
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="field-label">City</label>
          <input className="field-input" value={form.city} onChange={set("city")} placeholder="Austin" />
        </div>
        <div className="form-field">
          <label className="field-label">State</label>
          <input className="field-input" value={form.state} onChange={set("state")} placeholder="TX" />
        </div>
      </div>
      <button
        className={`enrich-btn ${!form.email || !form.company ? "enrich-btn-disabled" : ""}`}
        onClick={handleSubmit}
        disabled={!form.email || !form.company}
      >
        Enrich lead →
      </button>
    </div>
  );
}
