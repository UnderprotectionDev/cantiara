# 01 — Üretim Olayı kaydı (pager/S1 değil)

**What to build:** Kurucu Proje kapsamında `Production Incident` oluşturur. Zaman, etki, tespit, çözüm, kök neden ve öğrenim tutulur; durum `Open` / `Watching` / `Resolved`'dır. Olay Bug, GitHub PR, Proje Sürümü, Risk ve Karara bağlanır. Sistem pager, on-call, status sayfası veya güvenilirlik skoru açmaz. 85 S1 alarmı ve Sentry bu kaydı yazmaz. Olay otomatik Bug veya Risk üretmez.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Üretim Olayı Bug İş türünden ayrı ana kayıttır.
- [ ] Asgari bağlam tutulur: zaman, etki, nasıl fark edildiği, nasıl çözüldüğü; isteğe bağlı kök neden ve öğrenim. Durum `Open` / `Watching` / `Resolved` kimseyi sayfalamaz.
- [ ] İlişkiler kaynak yaşamını örtük değiştirmez.
- [ ] 85/Sentry double bu seam'e yazmaz; pager API'si yoktur; bu kayıt işletim S1 zinciri değildir.
- [ ] TTD/TTI/TTR ve trend dashboard yoktur.
- [ ] İngilizce etiketler terim sözlüğüne ilk gösterimde eklenir.
- [ ] Kabul kanıtı Production Incidents seam'inde: oluşturma, bağ, kapsam karşıtı. [Üretim olayı öğrenimi](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
