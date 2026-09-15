# 05 — Mermaid dönüşümü: İçe aktarılmış bağımsız kopya

**What to build:** Kurucu Belge içindeki kesin fenced Mermaid bloğunda `Convert to Technical Diagram` açar. Önizleme kaynak Belge/sürüm, blok konumu, hedef tür, parse edilemeyen veya kaybolacak satırlar, köken ilişkisi ve bloğun bağımsız mı kalacağını gösterir. Onay yeni kimlikli `Imported Independent Copy`, köken ve seçilen blok sonucunu tek atomik işlemde yazar; hata hiçbir kısmi kayıt bırakmaz ve güvenli yeniden deneme ikinci diyagram üretmez. Dönüşüm bloğu varsayılan silmez ve canlı round-trip kurmaz.

**Blocked by:** 01 — Dört otorite kipi ve değişmez kimlik; 02 — Üç tür ve kanonik yapısal model

**Status:** ready-for-agent

- [ ] Dönüşüm yalnız açık eylemdir; Belge içi Mermaid bağımsız Teknik Diyagram olmaz.
- [ ] Önizleme kayıp ve otorite etkisini gösterir; geçersiz öğe düzeltilir veya kapsam dışı bırakılır. Önizleme özgün bloğun bağımsız Mermaid mi kalacağını yoksa canlı Teknik Diyagram referansına mı dönüşeceğini içerir.
- [ ] Commit atomik ve idempotent'tir (ADR-0004); sonuç kipi `Imported Independent Copy`'dir.
- [ ] Kaynak blok eşit otorite veya senkron kaynağı değildir. Varsayılan bağımsız içerik kalır; canlı referans 04 kartıdır, round-trip değildir. Silme veya referansa dönüştürme yalnız önizlemede seçildiyse olur.
- [ ] Kabul kanıtı Technical Diagrams seam'inde: kayıp önizlemesi, atomiklik, retry, round-trip yokluğu. Erişilebilirlik **Mermaid'den Teknik Diyagram dönüşümü**.
