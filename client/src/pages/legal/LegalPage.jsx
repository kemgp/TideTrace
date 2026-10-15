import React from "react";
import { Link } from "react-router-dom";
import terms from "../../../../docs/legal/terms-and-conditions.md?raw";
import privacy from "../../../../docs/legal/privacy-policy.md?raw";
import "./legal.css";

// Render the formatting used by the reviewed local documents as React text.
// Raw HTML is never interpreted.
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\))/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    return link ? <a key={index} href={link[2]}>{link[1]}</a> : part;
  });
}
export default function LegalPage({ document }) {
  const source = document === "privacy" ? privacy : terms;
  return <div className="wrap legal-page">
    <nav className="legal-nav" aria-label="Legal pages">
      <Link to="/">Home</Link>
      <Link to="/terms-of-service" aria-current={document === "terms" ? "page" : undefined}>Terms of Service</Link>
      <Link to="/privacy-policy" aria-current={document === "privacy" ? "page" : undefined}>Privacy Policy</Link>
    </nav>
    <article className="legal-document">
      {source.trim().split(/\n\s*\n/).map((block, index) => {
        if (block.startsWith("# ")) return <h1 key={index}>{inline(block.slice(2))}</h1>;
        if (block.startsWith("## ")) return <h2 key={index}>{inline(block.slice(3))}</h2>;
        if (block.startsWith("- ")) return <ul key={index}>{block.split("\n").map((line, item) => <li key={item}>{inline(line.replace(/^- /, ""))}</li>)}</ul>;
        return <p key={index}>{inline(block.replace(/\n/g, " "))}</p>;
      })}
    </article>
  </div>;
}
