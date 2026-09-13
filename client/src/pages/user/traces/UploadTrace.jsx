import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext.jsx";
import Sidebar from "../../../components/Sidebar.jsx";
import CategorySelector from "../../../components/CategorySelector.jsx";
import LocationPicker from "../../../components/LocationPicker.jsx";
import ImageUploader from "../../../components/ImageUploader.jsx";
import ReviewSubmission from "./ReviewSubmission.jsx";

const STEPS = [
  { key: 1, label: "Select Category", hint: "what kind of trace?" },
  { key: 2, label: "Add Location", hint: "map / drop pin" },
  { key: 3, label: "Add Description", hint: "short text" },
  { key: 4, label: "Photo / Video", hint: "or voice story" },
  { key: 5, label: "Review & Submit", hint: "confirm" },
];

export default function UploadTrace() {
  const { categories, addTrace, showToast } = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [draft, setDraft] = useState({ category: "", location: "", description: "", media: [] });

  const isStepComplete = (targetStep) => {
    if (targetStep === 1) return Boolean(draft.category.trim());
    if (targetStep === 2) return Boolean(draft.location && draft.location.trim());
    if (targetStep === 3) return draft.description.trim().length > 0;
    if (targetStep === 4) return draft.media.length > 0;
    return true;
  };

  const items = STEPS.map((s) => ({ ...s, done: s.key < step && isStepComplete(s.key) }));

  const canAdvance = () => {
    if (step === 1) return isStepComplete(1);
    if (step === 2) return isStepComplete(1) && isStepComplete(2);
    if (step === 3) return isStepComplete(1) && isStepComplete(2) && isStepComplete(3);
    if (step === 4) return isStepComplete(1) && isStepComplete(2) && isStepComplete(3) && isStepComplete(4);
    return true;
  };

  const next = () => {
    if (!canAdvance()) {
      showToast("Start with Step 1; complete each step before moving on.");
      return;
    }
    setStep((s) => Math.min(5, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const resetForm = () => {
    setDraft({ category: "", location: "", description: "", media: [] });
    setStep(1);
    setSubmitted(false);
  };

  const submit = () => {
    if (submitted) return;
    addTrace({ ...draft });
    setSubmitted(true);
    showToast("Trace submitted — pending review");
  };

  const uploadAnother = () => {
    resetForm();
  };

  if (submitted) {
    return (
      <div className="wrap">
        <div className="vhead">
          <span className="eyebrow">Upload trace</span>
          <h2>New trace</h2>
        </div>
        <div className="card success">
          <div className="ok">
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
          <h3>Trace submitted — pending review</h3>
          <p>Your trace is now in <b>My Contributions</b> and in the moderators' review queue. You'll get a notification once it's checked.</p>
          <div className="row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn blue" onClick={() => navigate("/user/contributions")}>View in My Contributions</button>
            <button className="btn outline" onClick={uploadAnother}>Upload another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="vhead">
        <span className="eyebrow">Upload trace</span>
        <h2>New trace</h2>
        <p>Five quick steps — under a minute. Nothing is published until you submit.</p>
      </div>

      <div className="upgrid">
        <Sidebar
          items={items}
          active={step}
          onSelect={(nextStep) => {
            if (nextStep === 1) return setStep(1);
            if (nextStep === 2 && !isStepComplete(1)) {
              showToast("Complete Step 1 before moving to Step 2.");
              return;
            }
            if (nextStep === 3 && (!isStepComplete(1) || !isStepComplete(2))) {
              showToast("Complete Steps 1 and 2 before moving to Step 3.");
              return;
            }
            if (nextStep === 4 && (!isStepComplete(1) || !isStepComplete(2) || !isStepComplete(3))) {
              showToast("Complete Steps 1–3 before moving to Step 4.");
              return;
            }
            if (nextStep === 5 && (!isStepComplete(1) || !isStepComplete(2) || !isStepComplete(3) || !isStepComplete(4))) {
              showToast("Complete all previous steps before reviewing.");
              return;
            }
            setStep(nextStep);
          }}
        />
        <div>
          {step === 1 && (
            <div className="card">
              <span className="lbl">Step 1 · Select category</span>
              <CategorySelector categories={categories} value={draft.category} onChange={(v) => setDraft({ ...draft, category: v })} />
              <p className="hint" style={{ marginTop: 12 }}>Pick what best matches your sighting, story, or activity.</p>
            </div>
          )}
          {step === 2 && (
            <div className="card">
              <span className="lbl">Step 2 · Add location (map / pin)</span>
              <LocationPicker location={draft.location} onChange={(v) => setDraft({ ...draft, location: v })} />
            </div>
          )}
          {step === 3 && (
            <div className="card">
              <span className="lbl">Step 3 · Add description</span>
              <textarea
                className="input"
                placeholder="What did you see? Local names are welcome."
                value={draft.description}
                maxLength={500}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
              <div className="row between" style={{ marginTop: 8 }}>
                <span className="hint">Keep it short — a moderator may ask for details.</span>
                <span className="hint">{draft.description.length} / 500</span>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="card">
              <span className="lbl">Step 4 · Photo / video / voice</span>
              <ImageUploader
                media={draft.media}
                onAdd={(kind) => setDraft({ ...draft, media: [...draft.media, kind] })}
                onRemove={(i) => setDraft({ ...draft, media: draft.media.filter((_, idx) => idx !== i) })}
              />
            </div>
          )}
          {step === 5 && (
            <ReviewSubmission draft={draft} onEdit={setStep} onSubmit={submit} onDiscard={() => setStep(1)} />
          )}

          {step < 5 && (
            <div className="wrow">
              <button className="btn outline sm" onClick={back} disabled={step === 1}>← Back</button>
              <button className="btn blue sm" onClick={next} disabled={!canAdvance()}>Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
