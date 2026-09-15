# 01 — Deterministik evrensel arama

**What to build:** `Search` yetkili ana kayıtları, Belge gövdesini ve Dosya Eki üstverisini deterministik tam metin sırası ve görünür eşleşme bağlamıyla bulur. Sıra PRD’deki kapalı eşitlik-bozucu tablodur; AI, tıklama veya anlamsal model yoktur. Rozetler tür, durum, kapanış sonucu ve kapsamı gösterir. Canlı filtreleme geçici kalır.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Aynı sorgu aynı yetkili kümede tekrarlanabilir sıra üretir; öğrenen sinyal yoktur. Kapalı eşitlik-bozucu sıra:

| Step | Signal |
| --- | --- |
| 1 | Title and key match before body match |
| 2 | Records in the founder’s open Project before other Projects |
| 3 | Active records; then closed; archived only with explicit archive filter |
| 4 | `Completed` close result before `Abandoned` |
| 5 | More recently modified first |
| 6 | Stable internal id |
- [ ] Eşleşme bağlamı, vurgu ve sayı erişilen indeksten gelir; yetkisiz içerik sızmaz.
- [ ] İngilizce UI `Search` kullanır; Komut Paleti bu yüzey değildir.
- [ ] Kabul kanıtı Record Discovery seam’inde sıra tablosu ve yetki ayrımı. Kanıt [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğudur.
