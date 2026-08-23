# 01 — Her kurucu bağlamından palet komutları

**What to build:** Kurucu Komut Paletini uygulamanın yetkili her yerinden klavyeyle açar. Palet içerik arama, `Switch Project`, `Create` ve desteklenen ortak eylemleri taşır. Her komutun görünür menü karşılığı ve kısayol ipucu vardır; kapsam, hedef ve etkilenecek seçim sayısı komut çalışmadan görünür. Palet Evrensel Arama değildir ve `Search` diye adlandırılmaz.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Palet kurucu yüzeylerinin her yerinden klavyeyle açılır; p95 görünür olma ≤ 150 ms, p99 ≤ 300 ms.
- [ ] Arama, Proje geçişi ve kayıt oluşturma yalnız yetkili kapsamı gösterir.
- [ ] Her palet komutunun görünür karşılığı vardır; kısayollar sabittir ve yeniden eşlenmez.
- [ ] Çalıştırmadan önce kapsam, hedef ve seçim sayısı görünür; geri alınabilir komut Mutation Contract’ı kullanır.
- [ ] İngilizce `Command Palette`, `Switch Project`, `Create` PRD terim sözlüğüne aynı değişiklikle eklenir; palet başlığı `Search` değildir.
- [ ] Kabul kanıtı Command Palette seam'inde açma, yetkili arama/geçiş/oluşturma, bütçe. [Komut Paleti](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
