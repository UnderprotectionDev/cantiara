import type {
  CompletionEffectPalette,
  CompletionEffectTheme,
} from "@cantiara/api/completion-effects";
import { Button } from "@cantiara/ui/components/button";

import { COMPLETION_EFFECT_PALETTE_COLORS } from "../../lib/completion-effects-presentation";
import "./work-completion-feedback.css";

export default function WorkCompletionFeedback({
  effectPlaying,
  onReopen,
  palette,
  reopenDisabled,
  theme,
}: {
  effectPlaying: boolean;
  onReopen: () => void;
  palette: CompletionEffectPalette;
  reopenDisabled: boolean;
  theme: CompletionEffectTheme;
}) {
  const [first, second, third, fourth] =
    COMPLETION_EFFECT_PALETTE_COLORS[palette];

  return (
    <>
      {effectPlaying ? (
        <div
          aria-hidden="true"
          className="work-completion-effect"
          data-playing="true"
          data-theme={theme}
        >
          <svg
            aria-hidden="true"
            className="h-full w-full"
            fill="none"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 720 280"
          >
            {theme === "Calm" ? (
              <g data-effect-shape="calm">
                <circle cx="42" cy="76" fill={first} opacity="0.68" r="11" />
                <circle cx="114" cy="220" fill={second} opacity="0.82" r="8" />
                <circle cx="664" cy="62" fill={third} opacity="0.76" r="13" />
                <circle cx="602" cy="232" fill={fourth} opacity="0.8" r="9" />
              </g>
            ) : null}
            {theme === "Weave" ? (
              <g data-effect-shape="weave">
                <path
                  d="M-24 238C118 54 242 52 356 220s213 168 388-24"
                  stroke={first}
                  strokeLinecap="round"
                  strokeWidth="9"
                />
                <path
                  d="M-24 54c138 172 247 184 380 8s237-173 388 2"
                  stroke={second}
                  strokeLinecap="round"
                  strokeWidth="8"
                />
                <path
                  d="M20 140h680"
                  stroke={third}
                  strokeDasharray="2 14"
                  strokeLinecap="round"
                  strokeWidth="3"
                />
                <circle cx="360" cy="140" fill={fourth} r="7" />
              </g>
            ) : null}
            {theme === "Arc" ? (
              <g data-effect-shape="arc">
                <path
                  d="M52 252a308 186 0 0 1 616 0"
                  stroke={first}
                  strokeLinecap="round"
                  strokeWidth="9"
                />
                <path
                  d="M122 252a238 136 0 0 1 476 0"
                  stroke={second}
                  strokeLinecap="round"
                  strokeWidth="7"
                />
                <path
                  d="M200 252a160 88 0 0 1 320 0"
                  stroke={third}
                  strokeLinecap="round"
                  strokeWidth="5"
                />
                <circle cx="360" cy="252" fill={fourth} r="7" />
              </g>
            ) : null}
            {theme === "Nova" ? (
              <g data-effect-shape="nova">
                <circle cx="63" cy="178" fill={first} r="9" />
                <circle cx="142" cy="70" fill={second} r="6" />
                <circle cx="220" cy="232" fill={third} r="5" />
                <path
                  d="m357 38 10 29 30-4-23 20 13 28-30-14-27 15 8-29-23-19 30-2z"
                  fill={fourth}
                  opacity="0.88"
                />
                <circle cx="512" cy="80" fill={first} r="6" />
                <circle cx="648" cy="202" fill={second} r="10" />
              </g>
            ) : null}
          </svg>
        </div>
      ) : null}
      <div
        aria-live="polite"
        className="flex w-full items-center justify-between gap-3 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-sm"
        role="status"
      >
        <span className="font-medium">Work completed</span>
        <Button
          disabled={reopenDisabled}
          onClick={onReopen}
          size="xs"
          type="button"
          variant="ghost"
        >
          Reopen
        </Button>
      </div>
    </>
  );
}
