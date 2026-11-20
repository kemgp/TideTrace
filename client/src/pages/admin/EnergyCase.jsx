import React, { useId, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageHeader from "../../components/PageHeader.jsx";
import ConfirmDialog from "../../components/ConfirmDialog.jsx";
import Button from "../../components/Button.jsx";
import RemoteState from "../../components/RemoteState.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import { useApp } from "../../context/AppContext.jsx";
import { shortDate } from "../../api/relativeTime.js";
import { AWARD_LABEL } from "./EnergyActivity.jsx";
import "../../components/energy.css";

const SOURCE_LABEL = { trace: "Trace", tide: "Tide", quiz: "Quiz" };
const FLAG_BADGE = { open: ["open", "Open"], dismissed: ["dismissed", "Dismissed"], upheld: ["reversed", "Resolved: reversed"] };

function Field({ label, children }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

// Everything that happened to the award, oldest first: issued, flagged, then the admin decisions.
function buildTimeline(data) {
  const events = [{ key: "issued", at: data.created_at, text: `Award issued: ${data.amount} Tide Energy`, who: "System" }];
  for (const flag of data.flags || []) events.push({ key: `flag-${flag.id}`, at: flag.created_at, text: `Flagged by ${flag.flagged_by_name}`, who: flag.reason });
  (data.audit || []).forEach((entry, index) => {
    const reversed = entry.action === "reverse_energy_award";
    events.push({ key: `audit-${index}`, at: entry.created_at, text: `${reversed ? "Award reversed" : "Flag dismissed"}. Reason: ${entry.reason}`, who: entry.actor_name });
  });
  return events.sort((a, b) => new Date(a.at) - new Date(b.at));
}

export default function EnergyCase() {
  const { id } = useParams();
  const { writeData } = useApp();
  const result = useRemoteData(`admin/energy/awards/${id}`);
  const data = result.data;
  const fieldId = useId();
  const [outcome, setOutcome] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(null);

  const back = <Link className="btn ghost sm" to="/admin/energy">Back to Energy activity</Link>;
  const backLink = <Link className="page-hero__back" to="/admin/energy">← Back to Energy activity</Link>;
  if (result.loading || result.error) {
    return <>
      <PageHeader as="h1" eyebrow="Energy investigation" title="Energy case" back={backLink} />
      <div className="page-body">{result.error ? <div><p role="alert">{result.notFound ? "This award could not be found." : result.error}</p>{result.notFound ? back : <button type="button" className="btn outline sm" onClick={result.retry}>Try again</button>}</div> : <RemoteState loading />}</div>
    </>;
  }

  const flags = data.flags || [];
  const openFlag = flags.find((flag) => flag.status === "open");
  const reversed = Boolean(data.reversed);
  const heading = openFlag ? `Flag on a ${SOURCE_LABEL[data.source_type] || "source"} award` : AWARD_LABEL[data.award_type] || "Award";
  const canDecide = !reversed && !saved;
  const trimmed = reason.trim();
  const ready = Boolean(outcome) && trimmed.length > 0 && trimmed.length <= 2000;
  const flagged = flags[0];

  async function submit() {
    setBusy(true);
    setError("");
    try {
      if (outcome === "dismiss") await writeData(`admin/energy/flags/${openFlag.id}/dismiss`, { method: "POST", body: { reason: trimmed } });
      else await writeData(`admin/energy/awards/${data.id}/reverse`, { method: "POST", body: { reason: trimmed } });
      setSaved(outcome);
      setConfirming(false);
    } catch (problem) {
      setError(problem.message || "Could not save the decision. Try again.");
    } finally {
      setBusy(false);
    }
  }
  function decide(event) {
    event.preventDefault();
    if (!ready || busy) return;
    if (outcome === "reverse") { setError(""); setConfirming(true); } else submit();
  }

  return <>
    <PageHeader as="h1" back={backLink} eyebrow="Energy investigation" title={heading} subtitle={data.title} />
    <div className="page-body">
      <div className="energy-page energy-case">
        {data.source_deleted && <p className="notice is-warn">The source {SOURCE_LABEL[data.source_type]?.toLowerCase() || "item"} was deleted by its author. The award stays until an admin reverses it.</p>}

        <section className="card" aria-labelledby="award-title">
          <h2 id="award-title">Award</h2>
          <dl className="admin-settings-rules">
            <Field label="Member">{data.owner_name}</Field>
            <Field label="Type">{AWARD_LABEL[data.award_type] || "Award"}</Field>
            <Field label="Amount">{data.amount} Tide Energy</Field>
            <Field label="Source">{data.title}</Field>
            <Field label="Awarded">{shortDate(data.created_at)}</Field>
            <Field label="Status"><span className={`badge ${reversed ? "reversed" : "approved"}`}>{reversed ? "Reversed" : "Awarded"}</span></Field>
          </dl>
        </section>

        {flagged && <section className="card" aria-labelledby="flag-title">
          <h2 id="flag-title">Moderator flag</h2>
          <dl className="admin-settings-rules">
            <Field label="Flagged by">{flagged.flagged_by_name}</Field>
            <Field label="Flagged">{shortDate(flagged.created_at)}</Field>
            <Field label="Flag status"><span className={`badge ${(FLAG_BADGE[flagged.status] || FLAG_BADGE.open)[0]}`}>{(FLAG_BADGE[flagged.status] || FLAG_BADGE.open)[1]}</span></Field>
          </dl>
          <blockquote className="mod-dialog__quote">{flagged.reason}</blockquote>
        </section>}

        <section className="card" aria-labelledby="audit-title">
          <h2 id="audit-title">Audit history</h2>
          <ol className="ledger-list energy-timeline">
            {buildTimeline(data).map((event) => <li key={event.key} className="ledger-row">
              <div><p className="t">{event.text}</p><p className="ledger-meta"><span>{shortDate(event.at)}</span><span>{event.who}</span></p></div>
            </li>)}
          </ol>
        </section>

        {saved && <div className={`decision-outcome ${saved === "reverse" ? "is-rejected" : "is-approved"}`} role="status">
          <div>
            <p><b>{saved === "reverse" ? "Decision saved: award reversed." : "Decision saved: flag dismissed."}</b></p>
            <p>{saved === "reverse" ? "The member and the moderator were notified." : "The award stays. The moderator was notified."}</p>
          </div>
          {back}
        </div>}

        {reversed && !saved && <p className="notice">A reversed award cannot be reversed again or earned again for this source.</p>}

        {canDecide && <section className="card" aria-labelledby="decision-title">
          <h2 id="decision-title">Decision</h2>
          <form onSubmit={decide} noValidate>
            <fieldset className="energy-outcome">
              <legend>Outcome</legend>
              {openFlag && <label><input type="radio" name="outcome" value="dismiss" checked={outcome === "dismiss"} onChange={() => setOutcome("dismiss")} /> Dismiss flag. The award stays.</label>}
              <label><input type="radio" name="outcome" value="reverse" checked={outcome === "reverse"} onChange={() => setOutcome("reverse")} /> Reverse award. Adds a compensating entry.</label>
            </fieldset>
            <label htmlFor={fieldId}>Reason (required)</label>
            <textarea id={fieldId} rows={3} maxLength={2000} value={reason} aria-describedby={`${fieldId}-hint`} onChange={(event) => setReason(event.target.value)} />
            <p id={`${fieldId}-hint`} className="hint">The member and the flagging moderator are notified.</p>
            {error && !confirming && <p role="alert" className="err">{error}</p>}
            <Button type="submit" variant="blue" disabled={!ready} loading={busy && !confirming}>Save decision</Button>
          </form>
        </section>}
      </div>
    </div>
    {confirming && <ConfirmDialog title={`Reverse ${data.amount} Tide Energy?`} confirmLabel="Reverse award" variant="danger" busy={busy} error={error} onConfirm={submit} onCancel={() => { setConfirming(false); setError(""); }}>
      <p>This adds a negative entry to {data.owner_name}'s history and keeps the original award. It cannot be undone, and this source can never earn energy again.</p>
      <blockquote className="mod-dialog__quote">{trimmed}</blockquote>
    </ConfirmDialog>}
  </>;
}
