# 04 — Tür kapsamlı Table

**What to build:** Kapalı tür × yüzey matrisindeki türler yoğun tabloda sıralanır, filtrelenir ve izinli alanlara inline yazılır. Belge/Wiki Table+hücre edit almaz; Ekran, diyagram ve Dosya Eki Smart Collection kaynağı da olmaz. Tek Table tek türdür. Çok satırlı yapıştırma eşleme önizler ve atomik uygulanır. Inline düzenleme toplu eylemin yerine geçmez.

**Blocked by:** 01 — Deterministik evrensel arama

**Status:** ready-for-agent

- [ ] Matris dışı türe Table dayatılmaz; izinli hücre yazımı aynı ana kayda gider. Kapalı tür × yüzey (PRD 08):

| Type family | Search + own index/detail | Table + cell edit | Smart Collection source |
| --- | --- | --- | --- |
| Work, Project Goal, Milestone, Project Release, Feedback, Contact, Company, User Research Session, Decision, Risk, Assumption, Open Question, Product Gap, Source, Planned Test Case, Test Handoff, Test Session, Test Gap, Test assessment, Production Incident | Yes | Yes | Yes |
| Document, Wiki Document | Yes | No | Yes, structured metadata, tags, and scope only |
| Screen, User Flow, Project Wall, Moodboard, Technical Diagram, File Attachment | Yes | No | No |
| Capture Inbox item, Draft, External Surface, GitHub external record | No; own surface | No | No |

Oturum Testi Table'da sahibinin satırındadır; tarihsel sonuç hücreden yazılmaz. `Save as Smart Collection` 34'ün oluşturma komutudur; bu Table üyeliği saklamaz.
- [ ] Yapıştırma kısmi başarı bırakmaz.
- [ ] Satır ayrı kayıt veya dış spreadsheet senkronu değildir.
- [ ] Kabul kanıtı seam’de matris ve atomik yapıştırma. Özel alan Lookup/Formula yokluğu 10’un aynı yolculuk matrisidir.
