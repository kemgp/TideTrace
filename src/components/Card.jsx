import React from "react";

export default function Card({ children, className = "", style, ...rest }) {
  return (
    <div className={["card", className].filter(Boolean).join(" ")} style={style} {...rest}>
      {children}
    </div>
  );
}
