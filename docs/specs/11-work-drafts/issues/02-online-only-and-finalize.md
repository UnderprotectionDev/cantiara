# 02 — Online-only risk ve tek İşe kesinleşme

**What to build:** Bağlantı kesilince son başarılı otomatik kayıt zamanı ve yazılmamış risk görünür; yerel kuyruk yoktur. `Create` tam olarak bir İş üretir ve Taslağı kaldırır. Aynı formdan ikinci İş kesinleşmez. Yeniden bağlanma gizli replay yapmaz.

**Blocked by:** 01 — Otomatik Taslak ve ana kayıt olmaması

**Status:** ready-for-agent

- [ ] Kesilmede `Last saved` ve unsaved risk Client Shell kuralıyla görünür; kuyruk satırı yoktur.
- [ ] Yeniden bağlanma yazılmamış tuş vuruşunu gizlice replay etmez; kurucu neyin kalacağını seçer.
- [ ] `Create` Work Lifecycle oluşturmasını bir kez çağırır ve Taslağı tüketir.
- [ ] Tüketilmiş Taslak yeniden Create edilemez.
- [ ] Kabul kanıtı Work Drafts seam'inde disconnect, tek finalize, çift-Create karşıtı. Taslak yolculuğunun kurtarma paketi.
