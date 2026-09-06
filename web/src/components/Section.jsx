import React from "react";

import PrCard from "./PrCard.jsx";

export default function Section({ title, subtitle, items, emptyMessage, accent }) {
  return (
    <section className={`section accent-${accent}`}>
      <header className="section-head">
        <h2>
          {title}
          <span className="count">{items.length}</span>
        </h2>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </header>

      {items.length === 0 ? (
        <p className="empty">{emptyMessage}</p>
      ) : (
        <div className="cards">
          {items.map((pr) => (
            <PrCard key={pr.id} pr={pr} />
          ))}
        </div>
      )}
    </section>
  );
}
