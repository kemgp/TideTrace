import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp } from "../../../context/AppContext.jsx";
import CategorySelector from "../../../components/CategorySelector.jsx";
import LocationPicker from "../../../components/LocationPicker.jsx";
import Card from "../../../components/Card.jsx";
import Button from "../../../components/Button.jsx";

export default function EditSubmission() {
  const { id } = useParams();
  const { traces, categories, showToast, decideTrace } = useApp();
  const navigate = useNavigate();
  const trace = traces.find((t) => t.id === id);
  const [category, setCategory] = useState(trace?.category || "");
  const [location, setLocation] = useState(trace?.location || "");
  const [description, setDescription] = useState(trace?.description || "");

  if (!trace) {
    return (
      <div className="wrap" style={{ maxWidth: 760 }}>
        <p className="hint">Submission not found.</p>
        <button className="btn ghost sm" onClick={() => navigate("/user/contributions")}>← Back</button>
      </div>
    );
  }

  const resubmit = () => {
    trace.category = category;
    trace.location = location;
    trace.description = description;
    decideTrace(trace.id, "pending", "");
    showToast("Trace resubmitted for review");
    navigate("/user/contributions");
  };

  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <button className="btn ghost sm" style={{ marginBottom: 14 }} onClick={() => navigate(`/user/contributions/${trace.id}`)}>
        ← Back to submission
      </button>
      <div className="vhead">
        <span className="eyebrow">Edit &amp; resubmit</span>
        <h2>Update your trace</h2>
        <p>Address the moderator's feedback, then resubmit for another review.</p>
      </div>

      {trace.note && <div className="flag" style={{ marginBottom: 16 }}><b>Moderator feedback</b>{trace.note}</div>}

      <Card>
        <span className="lbl">Category</span>
        <CategorySelector categories={categories} value={category} onChange={setCategory} />
        <div className="divider" />
        <span className="lbl">Location</span>
        <LocationPicker location={location} onChange={setLocation} />
        <div className="divider" />
        <span className="lbl">Description</span>
        <textarea className="input" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
      </Card>

      <div className="row" style={{ marginTop: 16 }}>
        <Button variant="clay" onClick={resubmit}>Resubmit for review</Button>
        <Button variant="outline" onClick={() => navigate(`/user/contributions/${trace.id}`)}>Cancel</Button>
      </div>
    </div>
  );
}
