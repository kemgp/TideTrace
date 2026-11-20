import React from "react";
import { Link } from "react-router-dom";
import useRemoteData from "../hooks/useRemoteData.js";
import AdminIcon from "./AdminIcon.jsx";
import "./energy.css";

// Dashboard card with the member's balance. It hides itself if the balance cannot be read.
export function EnergyCard() {
  const result = useRemoteData("energy?limit=1&offset=0", { object: true });
  const balance = result.data?.balance;
  if (!Number.isFinite(balance)) return null;
  return <section className="energy-card" aria-labelledby="energy-card-title">
    <div className="row"><span className="energy-tile"><AdminIcon name="bolt" size={24} /></span><h2 id="energy-card-title">Tide Energy</h2></div>
    <p className="energy-figure">{balance}</p>
    <p className="hint">Earned from approved Traces, finished lessons and quizzes.</p>
    <Link className="btn outline sm" to="/user/energy">View energy history →</Link>
  </section>;
}

// The lesson whose quiz is waiting, or one passed in the last three days. `card` is the get_quiz_ready result.
// It replaces "Continue learning" while it shows, so the right column never has two lesson cards.
export function QuizReadyCard({ card }) {
  if (!card || card.state === "none") return null;
  const to = `/user/tides/${encodeURIComponent(card.tide_id)}`;
  if (card.state === "ready") {
    return <section className="learn dash-learning" aria-labelledby="quiz-ready-title">
      <p className="learn-eyebrow">Quiz ready</p>
      <h2 id="quiz-ready-title">{card.title}</h2>
      <p className="learn-sub">{card.active ? "Pass the quiz to earn 15 more Tide Energy." : "Take the quiz for this lesson."}</p>
      <Link className="btn outline" to={to}>Go to quiz →</Link>
    </section>;
  }
  const earned = Number(card.earned) || 0;
  return <section className="card energy-done" aria-labelledby="quiz-done-title">
    <h2 id="quiz-done-title">{card.title} is done</h2>
    <p className="hint">{earned > 0 ? `You earned ${earned} Tide Energy from this lesson and its quiz.` : "You finished this lesson and passed its quiz."}</p>
    <Link className="btn outline sm" to="/user/tides">Browse Tides</Link>
  </section>;
}
