import { useState } from "react";
import { workItems, type WorkItem, type WorkStatus } from "../prototypeData";

const columns: WorkStatus[] = ["Planned", "In progress", "Ready"];

function nextStatus(status: WorkStatus): WorkStatus {
  if (status === "Planned") return "In progress";
  return "Ready";
}

export function AlternativeB() {
  const [items, setItems] = useState<WorkItem[]>(workItems);
  const recommendedItem = items.find((item) => item.id === 2);
  const recommendedReady = recommendedItem?.status === "Ready";

  function advance(itemId: number) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, status: nextStatus(item.status) } : item,
      ),
    );
  }

  return (
    <div className="prototype-page direction-b">
      <header className="b-header">
        <a className="brand brand-light" href="/">Northstar</a>
        <nav aria-label="Workspace navigation">
          <a className="active" href="#board">Board</a>
          <a href="/">Compare directions</a>
        </nav>
      </header>

      <main className="b-main">
        <section className="b-hero">
          <div>
            <p className="eyebrow eyebrow-light">Direction B · Priority queue</p>
            <h1>Move the launch forward, one decision at a time.</h1>
          </div>
          <div className="b-next">
            <span>Recommended next</span>
            <strong>Review the core journey</strong>
            <button disabled={recommendedReady} onClick={() => advance(2)}>
              {recommendedReady ? "Ready" : "Mark ready"}
            </button>
          </div>
        </section>

        <section className="b-board" id="board" aria-label="Status board">
          {columns.map((column) => (
            <div className="board-column" key={column}>
              <div className="board-column-title">
                <h2>{column}</h2>
                <span>{items.filter((item) => item.status === column).length}</span>
              </div>
              <div className="board-stack">
                {items
                  .filter((item) => item.status === column)
                  .map((item) => (
                    <article className="board-card" key={item.id}>
                      <span className="owner-pill">{item.owner}</span>
                      <h3>{item.title}</h3>
                      <p>{item.note}</p>
                      <div>
                        <small>{item.due}</small>
                        {item.status !== "Ready" && (
                          <button onClick={() => advance(item.id)}>Advance</button>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
