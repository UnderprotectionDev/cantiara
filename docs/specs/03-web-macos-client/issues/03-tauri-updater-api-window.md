# 03 — Tauri Updater ve 30 günlük API penceresi

**What to build:** Tauri Updater yalnız imzası doğrulanan çıktıyı uygular; değiştirilmiş veya geçersiz imzalı paketi reddeder ve önceki çalışan sürümü bozmaz. Otomatik rollback yoktur; bir önceki imzalı installer indirilebilir tutulur. Backend güncel ve bir önceki imzalı masaüstü API sözleşmesini 30 gün destekler; süre dışındaki istemci güvenli olmayan yazmadan önce `Update required` ile durur.

**Blocked by:** 02 — İmzalı noterli macOS paketi

**Status:** ready-for-agent

- [ ] Geçerli imzalı güncelleme uygulanır; geçersiz veya değiştirilmiş imza reddedilir ve önceki sürüm çalışır kalır.
- [ ] Otomatik rollback yoktur; önceki imzalı installer manuel kurtarma smoke’undan geçer.
- [ ] Yayımdan sonra 30 gün current + previous masaüstü API kabul edilir; pencere dışındaki istemci yazmadan önce açık güncelleme hatasıyla durur.
- [ ] İngilizce `Update required` PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Client Shell seam'inde imza double, reject-without-break, 30 gün içi yazma, 30 gün dışı durma. [Platform kabulü](../../../prd/16-product-acceptance.md#platform-kabulu) updater ve sözleşme maddeleri.
