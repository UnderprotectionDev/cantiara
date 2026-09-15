# 02 — Kayıpsız JSON seçili kayıt dışa aktarma

**What to build:** JSON, kapalı katalogdaki seçili kayıtların kanonik yapılandırılmış round-trip biçimidir. Güncel alan değerleri, kararlı kimlikler, İş anahtar geçmişi, seçili kapsamdaki özel alan tanımları, köken ve iki ucu da seçilmiş ilişkiler taşınır; olağan kayıt geçmişi taşınmaz. Her çıktı açık şema sürümü taşır. Teknik Diyagram JSON'u export-only kalır. Seçili İşin Dış yürütme devirleri ve seçili Proje Sürümünün Erişim/Sonuç gözlemleri yalnız sahip içinde, secret yasağıyla gider. Çıktı canlı AB yerleşimini taşımaz.

**Blocked by:** 01 — Kapalı dünya önizlemesi, limit ve kaynak manifesti

**Status:** ready-for-agent

- [ ] Kapalı katalog aileleri JSON olarak çıkar. Pozitif aileler: Work (`Feature`, `Bug`, `Task`, `Research`, `Improvement`); Planning (Project Goal, Milestone); Decision and uncertainty (Decision, Risk, Assumption, Open Question); Input and person context (Feedback, Contact, Company); Product learning (Product Gap, User Research Session, Experiment/Validation); External knowledge (Source metadata only — captured historical body is not a trusted Source snapshot from an outside file); Release and operations (Project Release, Production Incident). Document is not in the general CSV catalog (single Markdown or first-party versioned Document JSON). Technical Diagram JSON is export-only. Not this round-trip: test envelope, External Surface, automation, GitHub-as-truth, Screen/Wall/Moodboard, Project/starter configuration.
- [ ] JSON açık şema sürümü taşır; ham değer kayıpsızdır (CSV kaçışı uygulanmaz).
- [ ] İlişki yalnız iki uç da seçildiyse çıkar; tek uçlu ilişki sessizce tamamlanmaz.
- [ ] Teknik Diyagram JSON'u varsa export-only işaretli ve import-create vaadi taşımaz; Dış yürütme/gözlem sahipli bileşenleri bağımsız tür olarak seçilemez.
- [ ] Kabul kanıtı Selected Export seam'inde katalog pozitifleri, yasak aile karşıtı, şema sürümü, secret yokluğu. ADR-0005 sözleşmesi bu ticket'tadır; 80 import 03/80'de.
