import { useState } from "react";
import { workItems } from "../prototypeData";

export function AlternativeC() {
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const current = workItems[step];

  function toggleComplete() {
    setCompleted((items) =>
      items.includes(current.id)
        ? items.filter((id) => id !== current.id)
        : [...items, current.id],
    );
  }

  return (
    <div className="prototype-page direction-c">
      <header className="c-header">
        <a className="brand" href="/">Northstar</a>
        <span>Direction C · Guided focus</span>
        <a className="quiet-button quiet-link" href="/">Compare directions</a>
      </header>

      <main className="c-main">
        <aside className="c-progress" aria-label="Launch progress">
          <p className="eyebrow">Launch review</p>
          <h1>Finish the decisions that matter.</h1>
          <div className="progress-track" aria-hidden="true">
            <span style={{ width: `${((step + 1) / workItems.length) * 100}%` }} />
          </div>
          <p>Step {step + 1} of {workItems.length}</p>
          <ol>
            {workItems.map((item, index) => (
              <li className={index === step ? "active" : ""} key={item.id}>
                <button onClick={() => setStep(index)}>
                  <span>{completed.includes(item.id) ? "Done" : `0${index + 1}`}</span>
                  {item.title}
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <section className="c-focus" aria-live="polite">
          <div className="focus-card">
            <span className="owner-pill owner-pill-dark">{current.owner}</span>
            <h2>{current.title}</h2>
            <p>{current.note}</p>

            <div className="decision-panel">
              <span>Decision check</span>
              <strong>Is this item ready to move forward?</strong>
              <label>
                <input
                  checked={completed.includes(current.id)}
                  onChange={toggleComplete}
                  type="checkbox"
                />
                Mark this decision as complete
              </label>
            </div>

            <div className="focus-actions">
              <button
                className="quiet-button"
                disabled={step === 0}
                onClick={() => setStep((value) => Math.max(0, value - 1))}
              >
                Previous
              </button>
              <button
                className="primary-button primary-button-dark"
                disabled={step === workItems.length - 1}
                onClick={() => setStep((value) => Math.min(workItems.length - 1, value + 1))}
              >
                Continue
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
