# 03 — İki katmanlı sonuç ve normalizasyon

**What to build:** Ham sonuç geriye dönük yazılmadan saklanır. Normalize değer yalnız `Passed` / `Failed` / `Blocked` / `Skipped` / `Inconclusive` / `Not reported` (wire: `passed` / `failed` / `blocked` / `skipped` / `inconclusive` / `not_reported`). Katalog dışı ham ifade `not_reported` olur; ham ile `normalized_result` çelişkisi `result_conflict` reddidir. Karışık alt sonuçlardan oturum geçti/kaldı hükmü hesaplanmaz. Serbest not Test Oturumu olmaz. Yeni oturum `Unreviewed` ile başlar; bu ticket inceleme UI'si açmaz.

**Blocked by:** 01 — test-report/1 ve üç giriş tek model

**Status:** ready-for-agent

- [ ] Ham ve normalize ayrı tutulur; katalog dışı `not_reported`'dır.
- [ ] Çelişki `result_conflict` ile reddedilir; sessiz düzeltme yoktur.
- [ ] Oturum rollup geçti/kaldı yoktur; serbest not oturum değildir.
- [ ] İngilizce UI `Passed`, `Failed`, `Blocked`, `Skipped`, `Inconclusive`, `Not reported`, `Unreviewed` kullanır.
- [ ] Kabul kanıtı aynı seam'de: alias kataloğu, çelişki, grill 4. İnceleme 57'dedir.
