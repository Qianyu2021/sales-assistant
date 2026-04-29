export default function GmailConnect({
  gmailConnected,
  automationReady,
  onConnect,
  error,
  gmailAccount,
  lastSyncAt,
  lastSeenAt,
  lastSkippedReason,
  lastError,
  lastMessageSubject,
}) {
  return (
    <div className="form-body">
      <div className="gmail-connect-card">
        <div className="gmail-connect-title">Connect your Gmail</div>
        <div className="gmail-connect-copy">
          Let EliseAI watch inbound emails, identify likely customer interest, and turn qualified messages into scored leads automatically.
        </div>
      </div>

      <div className="gmail-steps">
        <div className="gmail-step">
          <div className="gmail-step-label">Automatic screening</div>
          <div className="gmail-step-copy">New inbound emails are screened for buyer intent so reps do not have to sort every message by hand.</div>
        </div>
        <div className="gmail-step">
          <div className="gmail-step-label">Lead scoring</div>
          <div className="gmail-step-copy">Likely customer inquiries are enriched, scored, and routed into the queue with draft outreach and rep-ready insights.</div>
        </div>
        <div className="gmail-step">
          <div className="gmail-step-label">Rep experience</div>
          <div className="gmail-step-copy">Once connected, sales can simply work the queue. The app handles filtering, scoring, and context gathering in the background.</div>
        </div>
      </div>

      <div className={`gmail-status ${gmailConnected ? "gmail-status-ready" : ""}`}>
        {gmailConnected
          ? "Gmail is connected. New qualified inquiries will flow into the queue automatically."
          : "Gmail is not connected yet. Connect an inbox to start turning inbound emails into scored leads."}
      </div>

      {gmailAccount && (
        <div className="gmail-helper-text">
          Connected inbox: {gmailAccount}
          {lastSyncAt ? ` · Last sync ${new Date(lastSyncAt).toLocaleString()}` : ""}
        </div>
      )}

      {(lastSeenAt || lastMessageSubject || lastSkippedReason || lastError) && (
        <div className="gmail-helper-text">
          {lastMessageSubject ? `Last email checked: ${lastMessageSubject}. ` : ""}
          {lastSeenAt ? `Seen ${new Date(lastSeenAt).toLocaleString()}. ` : ""}
          {lastSkippedReason ? `Last skipped: ${lastSkippedReason}. ` : ""}
          {lastError ? `Last sync error: ${lastError}.` : ""}
        </div>
      )}

      <button
        className={`enrich-btn ${gmailConnected ? "enrich-btn-disabled" : ""}`}
        onClick={onConnect}
        disabled={gmailConnected}
      >
        {gmailConnected ? "Gmail connected" : "Connect Gmail"}
      </button>

      {error && <div className="gmail-helper-text gmail-error-text">{error}</div>}

      {!automationReady && (
        <div className="gmail-helper-text">
          Inbox automation is not fully enabled in this environment yet, but the sales-facing connection flow is ready for a real Gmail handoff.
        </div>
      )}
    </div>
  );
}
