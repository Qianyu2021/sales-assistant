const SOURCE_LABEL = { gmail: "Gmail", sheet: "Sheets", manual: "Manual", csv: "CSV" };

function initials(lead) {
  return `${lead.firstName?.[0] || ""}${lead.lastName?.[0] || ""}`.toUpperCase() || "?";
}

function scoreClass(label) {
  if (label === "Hot") return "pill-hot";
  if (label === "Warm") return "pill-warm";
  if (label === "Cold") return "pill-cold";
  return "pill-processing";
}

export default function LeadQueue({ leads, selectedId, onSelect }) {
  if (leads.length === 0) return (
    <div className="queue-empty">No leads yet. Add one above.</div>
  );

  return (
    <div className="queue">
      <div className="queue-header">Queue ({leads.length})</div>
      {leads.map((lead, index) => (
        <div
          key={lead.id}
          className={`queue-row ${lead.id === selectedId ? "queue-row-active" : ""}`}
          onClick={() => onSelect(lead.id)}
        >
          <div className={`avatar avatar-${(index % 3) + 1}`}>
            {initials(lead)}
          </div>
          <div className="queue-info">
            <div className="queue-name">
              {lead.firstName} {lead.lastName}
            </div>
            <div className="queue-co">
              {lead.company}
              <span className="queue-source">{SOURCE_LABEL[lead.source]}</span>
            </div>
          </div>
          <span className={`pill ${scoreClass(lead.scoreLabel)} ${lead.status === "enriching" ? "pill-pulse" : ""}`}>
            {lead.status === "enriching" ? "..." : lead.scoreLabel || "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
