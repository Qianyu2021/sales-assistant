import { useState, useRef } from "react";

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
    return {
      firstName: obj["first name"] || obj["firstname"] || obj["name"]?.split(" ")[0] || "",
      lastName: obj["last name"] || obj["lastname"] || obj["name"]?.split(" ")[1] || "",
      email: obj["email"] || obj["email address"] || "",
      company: obj["company"] || obj["company name"] || "",
      address: obj["address"] || obj["property address"] || "",
      city: obj["city"] || "",
      state: obj["state"] || "",
      source: "csv",
    };
  }).filter((r) => r.email || r.company);
}

export default function CsvUpload({ onSubmit }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const inputRef = useRef();

  function handleFile(f) {
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = (e) => setRows(parseCSV(e.target.result));
    reader.readAsText(f);
  }

  function handleEnrichAll() {
    rows.forEach((r) => onSubmit(r));
    setRows([]);
    setFileName("");
  }

  return (
    <div className="form-body">
      <div
        className={`drop-zone ${fileName ? "drop-zone-filled" : ""}`}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {fileName ? (
          <div className="scan-state">
            <div className="scan-icon">✓</div>
            <div className="scan-text">{fileName}</div>
            <div className="drop-subtext">{rows.length} leads found</div>
          </div>
        ) : (
          <>
            <div className="drop-icon">+</div>
            <div className="drop-text">Upload CSV file</div>
            <div className="drop-subtext">name, email, company, address, city, state</div>
          </>
        )}
      </div>

      {rows.length > 0 && (
        <div className="parsed-preview">
          <div className="parsed-label">{rows.length} leads ready</div>
          {rows.slice(0, 3).map((r, i) => (
            <div key={i} className="parsed-row">
              <span className="parsed-key">{r.firstName} {r.lastName}</span>
              <span className="parsed-val">{r.company}</span>
            </div>
          ))}
          {rows.length > 3 && (
            <div className="parsed-row">
              <span className="parsed-key" style={{ fontStyle: "italic" }}>
                +{rows.length - 3} more
              </span>
            </div>
          )}
        </div>
      )}

      <button
        className={`enrich-btn ${rows.length === 0 ? "enrich-btn-disabled" : ""}`}
        onClick={handleEnrichAll}
        disabled={rows.length === 0}
      >
        {rows.length > 0 ? `Enrich all ${rows.length} leads →` : "Upload a CSV first"}
      </button>
    </div>
  );
}
