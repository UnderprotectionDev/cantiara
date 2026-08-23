# 03 — Sequential triage

**What to build:** `Sequential triage` tek yakalamaya odaklanır ve yalnız üç çıkıştan biri açıkça çözülünce sıradakine ilerler. Kayda bakmak, alan düzenlemek veya öneriyi kapatmak ilerleme sayılmaz. Önceki öğeye dönmek ve listeye çıkmak açıktır. Yeni kuyruk, SLA veya otomatik çözüm yoktur.

**Blocked by:** 02 — Üç triage çıkışı

**Status:** ready-for-agent

- [ ] Mod tek öğeye odaklanır; ilerleme yalnız Convert / Attach / Delete sonrası olur.
- [ ] Görüntüleme, alan düzeni ve öneri kapatma sıradaki öğeyi açmaz.
- [ ] Geri ve listeye çıkış çalışır; SLA veya otomatik çözüm yoktur.
- [ ] UI etiketi `Sequential triage` (sözlükte mevcut) kullanılır.
- [ ] Kabul kanıtı Capture Inbox seam'inde ilerleme karşıtları ve geri/liste. Yakalama yolculuğunun sıralı mod paketi.
