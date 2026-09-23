import type {
  CompletionEffectPalette,
  CompletionEffectTheme,
} from "@cantiara/api/completion-effects";

import { COMPLETION_EFFECT_PALETTE_COLORS } from "../../lib/completion-effects-presentation";
import "./completion-effect-specimen.css";

interface CompletionEffectSpecimenProps {
  palette: CompletionEffectPalette;
  previewing: boolean;
  theme: CompletionEffectTheme;
}

export default function CompletionEffectSpecimen({
  palette,
  previewing,
  theme,
}: CompletionEffectSpecimenProps) {
  const [first, second, third, fourth] =
    COMPLETION_EFFECT_PALETTE_COLORS[palette];

  return (
    <div
      className="completion-effect-specimen relative isolate flex min-h-52 items-center justify-center overflow-hidden rounded-xl border bg-muted/20"
      data-previewing={previewing}
      data-theme={theme}
    >
      <svg
        aria-hidden="true"
        className="h-40 w-full max-w-md overflow-visible"
        fill="none"
        viewBox="0 0 360 176"
      >
        <g data-sample-element="calm" opacity="0.94">
          {theme === "Calm" ? (
            <>
              <circle cx="181" cy="88" fill={first} opacity="0.2" r="49" />
              <circle cx="166" cy="79" fill={second} opacity="0.74" r="27" />
              <circle cx="202" cy="92" fill={third} opacity="0.82" r="20" />
              <circle cx="177" cy="106" fill={fourth} opacity="0.68" r="13" />
            </>
          ) : null}
        </g>
        <g data-sample-element="weave" opacity="0.92">
          {theme === "Weave" ? (
            <>
              <path
                d="M75 105C120 35 155 35 202 105s82 70 127 0"
                stroke={first}
                strokeLinecap="round"
                strokeWidth="13"
              />
              <path
                d="M75 70c45 70 80 70 127 0s82-70 127 0"
                stroke={second}
                strokeLinecap="round"
                strokeWidth="13"
              />
              <path
                d="M75 88h281"
                opacity="0.7"
                stroke={third}
                strokeDasharray="3 12"
                strokeLinecap="round"
                strokeWidth="3"
              />
              <circle cx="180" cy="88" fill={fourth} r="7" />
            </>
          ) : null}
        </g>
        <g data-sample-element="arc" opacity="0.95">
          {theme === "Arc" ? (
            <>
              <path
                d="M112 108a68 68 0 0 1 136 0"
                stroke={first}
                strokeLinecap="round"
                strokeWidth="12"
              />
              <path
                d="M131 108a49 49 0 0 1 98 0"
                stroke={second}
                strokeLinecap="round"
                strokeWidth="8"
              />
              <path
                d="M151 108a29 29 0 0 1 58 0"
                stroke={third}
                strokeLinecap="round"
                strokeWidth="5"
              />
              <circle cx="180" cy="108" fill={fourth} r="7" />
            </>
          ) : null}
        </g>
        <g data-sample-element="nova" opacity="0.96">
          {theme === "Nova" ? (
            <>
              <path
                d="m180 36 13 35 36-4-27 24 16 32-38-17-35 20 10-38-29-23 38-2z"
                fill={first}
                opacity="0.8"
              />
              <circle cx="111" cy="62" fill={second} r="7" />
              <circle cx="247" cy="52" fill={third} r="5" />
              <circle cx="258" cy="119" fill={fourth} r="8" />
              <circle cx="128" cy="130" fill={third} r="4" />
              <circle cx="222" cy="135" fill={second} r="4" />
            </>
          ) : null}
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-x-8 bottom-5 -z-10 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}
