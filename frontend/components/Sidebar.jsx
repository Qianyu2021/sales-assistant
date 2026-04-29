import { useState } from "react";
import ManualForm from "./ManualForm";
import GmailConnect from "./GmailConnect";
import LeadQueue from "./LeadQueue";

const TABS = ["Manual", "Gmail"];

export default function Sidebar({
  leads,
  selectedId,
  onSelect,
  onAddLead,
  n8nStatus,
  gmailConnected,
  gmailConnectError,
  onConnectGmail,
}) {
  const [activeTab, setActiveTab] = useState("Manual");

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-dot" />
          <span className="logo-text">EliseAI</span>
        </div>
        <div className="sidebar-subtitle">Connect inboxes, score buyer intent, and give reps instant context</div>
      </div>

      <div className="tab-row">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tab-btn ${activeTab === t ? "tab-active" : ""}`}
            onClick={() => setActiveTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="input-pane">
        {activeTab === "Manual" && <ManualForm onSubmit={onAddLead} />}
        {activeTab === "Gmail" && (
          <GmailConnect
            gmailConnected={gmailConnected}
            automationReady={Boolean(n8nStatus.connected)}
            onConnect={onConnectGmail}
            error={gmailConnectError}
            gmailAccount={n8nStatus.gmailAccount}
            lastSyncAt={n8nStatus.gmailLastSyncAt}
            lastSeenAt={n8nStatus.gmailLastSeenAt}
            lastSkippedReason={n8nStatus.gmailLastSkippedReason}
            lastError={n8nStatus.gmailLastError}
            lastMessageSubject={n8nStatus.gmailLastMessageSubject}
          />
        )}
      </div>

      <LeadQueue leads={leads} selectedId={selectedId} onSelect={onSelect} />

      <div className="status-bar">
        <span className={`status-item ${n8nStatus.connected ? "status-on" : "status-off"}`}>
          <span className="status-dot" />
          n8n
        </span>
        <span className={`status-item ${n8nStatus.gmail ? "status-on" : "status-off"}`}>
          <span className="status-dot" />
          Gmail
        </span>
        <span className={`status-item ${n8nStatus.sheets ? "status-on" : "status-off"}`}>
          <span className="status-dot" />
          Sheets
        </span>
      </div>
    </aside>
  );
}
