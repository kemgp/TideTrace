import React from "react";

// The ocean page header: eyebrow, title, optional subtitle and actions on a deep-water band with a wave edge.
// `back` is an optional link shown above the eyebrow. Put the page content in a <div className="page-body"> straight after it. Children render under the subtitle.
export default function PageHeader({ back, eyebrow, title, subtitle, actions, as: Heading = "h2", children }) {
  return <section className="page-hero">
    <div className="page-hero__inner">
      <div>
        {back}
        {eyebrow && <p className="page-hero__eyebrow">{eyebrow}</p>}
        <Heading className="page-hero__title">{title}</Heading>
        {subtitle && <p className="page-hero__sub">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="page-hero__actions">{actions}</div>}
    </div>
    <svg className="page-hero__wave" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 40c120 40 240 40 360 10s240-40 360-10 240 40 360 10 240-30 360 0v40H0z" />
    </svg>
  </section>;
}
