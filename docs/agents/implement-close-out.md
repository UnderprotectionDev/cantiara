# Implement close-out

Final user message after `/implement` — Turkish, three sections in order.

## When

Run after work is committed, `/code-review` has finished, and tests have run.

## 1. Ne eklendi

Plain-language summary of what landed:

- User-visible behaviour or capability delivered
- Main files, routes, APIs, or schema touched — enough to orient, not a raw diff dump
- Scope boundaries: what this change deliberately does not cover

**Done when** the reader can answer “what did this deliver?” without opening the diff.

## 2. İnceleme

Carry forward `/code-review` under `## Standards` and `## Spec` — lightly cleaned, not reranked. End with the one-line summary from that skill (findings per axis, worst issue within each axis).

If no spec was available, say so under Spec. If review was skipped, say why — do not invent findings.

**Done when** both axes are reported or explicitly skipped with reason.

## 3. Nasıl test edilir

Tarayıcıda adım adım doğrulama — komut, terminal veya otomatik test çıktısı yok:

- Hangi URL'ye git
- Hangi tıklamalar / girişler / akış
- Her adımda ne görmeli

Değişiklik tarayıcıda test edilemiyorsa, bunu tek cümleyle söyle — komut önerme.

**Done when** okuyucu tarayıcıda tek başına doğrulayabilir veya neden edemeyeceğini anlar.

## Voice

- Turkish prose throughout.
- English UI labels from the owning spec stay English in backticks.
- Proportional length — a one-file fix gets short sections; a feature gets more detail in **Ne eklendi** and **Nasıl test edilir**, not in **İnceleme**.
