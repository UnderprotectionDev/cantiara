import { useState } from "react";
import { workItems } from "../prototypeData";

export function AlternativeA() {
  const [selectedId, setSelectedId] = useState(workItems[1].id);
  const selected = workItems.find((item) => item.id === selectedId) ?? workItems[0];

  return (
    <div className="prototype-page direction-a">
      <aside className="a-sidebar">
        <a className="brand" href="/">Northstar</a>
        <nav aria-label="Workspace navigation">
          <a className="active" href="#work">Work items</a>
          <a href="/">Compare directions</a>
        </nav>
        <div className="sidebar-note">
          <span>Direction A</span>
          <strong>Operational overview</strong>
        </div>
      </aside>

      <main className="a-main">
        <header className="a-header">
          <div>
            <p className="eyebrow">Launch workspace</p>
            <h1>Keep every moving part visible</h1>
          </div>
        </header>

        <section className="metric-row" aria-label="Launch metrics">
          <article><span>Readiness</span><strong>68%</strong><small>Up 12% this week</small></article>
          <article><span>Open items</span><strong>3</strong><small>One needs attention</small></article>
          <article><span>Next checkpoint</span><strong>Today</strong><small>Core journey review</small></article>
        </section>

        <div className="a-workspace" id="work">
          <section className="a-list" aria-label="Work items">
            <div className="section-heading">
              <div><p className="eyebrow">Work queue</p><h2>Launch items</h2></div>
            </div>
            {workItems.map((item) => (
              <button
                className={`work-row ${item.id === selected.id ? "selected" : ""}`}
                key={item.id}
                onClick={() => setSelectedId(item.id)}
              >
                <span className={`status-dot status-${item.status.toLowerCase().replaceAll(" ", "-")}`} />
                <span><strong>{item.title}</strong><small>{item.owner}</small></span>
                <span className="row-meta">{item.due}</span>
              </button>
            ))}
          </section>

          <aside className="a-detail" aria-live="polite">
            <p className="eyebrow">Selected item</p>
            <h2>{selected.title}</h2>
            <p>{selected.note}</p>
            <dl>
              <div><dt>Status</dt><dd>{selected.status}</dd></div>
              <div><dt>Owner</dt><dd>{selected.owner}</dd></div>
              <div><dt>Due</dt><dd>{selected.due}</dd></div>
            </dl>
          </aside>
        </div>
      </main>
    </div>
  );
}
