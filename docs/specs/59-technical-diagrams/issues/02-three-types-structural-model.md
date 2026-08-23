# 02 — Üç tür ve kanonik yapısal model

**What to build:** Kurucu `Technical Architecture`, `Data Model` ve `Technical Sequence` ana kayıtlarını Proje kapsamında oluşturur. Kanonik içerik veritabanındaki türlenmiş düğüm, alan, bağlantı ve kısıtlardır; koordinat görünüm üstverisidir. Mimari kapalı öğe kataloğunu, Veri Modeli PostgreSQL fiziksel semantiğini (Tasarlanan şema; canlı DB yok), Sıra ise kanonik adım ve katılımcı modelini (lifeline/mesaj/control group) kullanır. Generic flowchart, Kullanıcı Akışı, İş durumu geçişi, log/runtime trace, Üretim Olayı zaman çizelgesi, Wireframe ve Prisma senkronu bu model değildir. Şema SQL üretimi 60'tadır.

**Blocked by:** 01 — Dört otorite kipi ve değişmez kimlik

**Status:** ready-for-agent

- [ ] Üç tür bağımsız Teknik Diyagramdır; BPMN/org/Gantt kataloğa girmez.
- [ ] Yapısal model PostgreSQL'de kanoniktir (ADR-0021); Mermaid/SQL/DBML ikinci canlı kaynak olmaz.
- [ ] Veri Modeli canlı veritabanına bağlanmaz ve ORM dosyası yazmaz; modelleme 60'a kopyalanmaz.
- [ ] Mimari kapalı düğüm kataloğu: `Component`, `Service`, `Datastore`, `Queue/Event Bus`, `External System`, `Boundary` ve desteklenen türlenmiş bağlantılar. Kutu-çizgi resmi kanonik model değildir. Mimari öğe ortak servis kataloğu veya CMDB ana kaydı değildir.
- [ ] Teknik Sıra adımlar ve katılımcıları kanonik yapısal modelde tutar; Kullanıcı Akışı, İş durumu geçişi, log izleme, runtime trace veya Üretim Olayı zaman çizelgesi değildir.
- [ ] Sıra lifeline isteğe bağlı kesin Mimari düğümü ve Diyagram Sürümüne bağlanır; kaynak yeni sürüme geçince bağ sessizce taşınmaz.
- [ ] Kabul kanıtı aynı seam'de: üç tür oluşturma, canvas/outline E2E, DSL'in kanonik olmaması. Erişilebilirlik **Teknik Diyagram yapılandırılmış outline'ı**.
