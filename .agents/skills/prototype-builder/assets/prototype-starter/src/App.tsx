import { AlternativeA } from "./alternatives/AlternativeA";
import { AlternativeB } from "./alternatives/AlternativeB";
import { AlternativeC } from "./alternatives/AlternativeC";
import { directions } from "./prototypeData";

function ComparisonHome() {
  return (
    <main className="comparison-home">
      <div className="comparison-heading">
        <p className="eyebrow">Prototype comparison</p>
        <h1>Three ways to shape the same product idea</h1>
        <p>
          Each direction uses the same sample outcome and data while changing the
          information architecture, navigation, and interaction model.
        </p>
      </div>

      <section className="direction-grid" aria-label="Prototype directions">
        {directions.map((direction, index) => (
          <a
            className={`direction-card direction-card-${direction.key}`}
            href={`/alternative-${direction.key}`}
            key={direction.key}
          >
            <span className="direction-index">0{index + 1}</span>
            <div>
              <h2>{direction.name}</h2>
              <p>{direction.summary}</p>
            </div>
            <span className="direction-link">Open direction</span>
          </a>
        ))}
      </section>
    </main>
  );
}

export function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/alternative-a") return <AlternativeA />;
  if (path === "/alternative-b") return <AlternativeB />;
  if (path === "/alternative-c") return <AlternativeC />;
  return <ComparisonHome />;
}
