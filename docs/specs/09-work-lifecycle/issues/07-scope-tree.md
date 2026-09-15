# 07 — Kapsam Ağacı

**What to build:** `Scope Tree` mevcut `Proje → Özellik → Kapsanan işler` ilişkisini açılıp kapanabilen salt okunur görünümde sunar. Durum, blokaj, ilgili kilometre taşı ve türetilen ilerleme ana kaynaklardan gelir. `Open source record` kaynağı açar. Ağaçta sürükleme kapsamı değiştirmez. Bir İş yalnız birincil Özelliğinin altında görünür.

**Blocked by:** 06 — Özellik kapsamı

**Status:** ready-for-agent

- [ ] Ağaç yeni parent–child, içerik kopyası, bağımsız durum veya manuel sıra üretmez.
- [ ] Sürükleme `Includes` yazmaz.
- [ ] İngilizce `Scope Tree` terim tablosuna aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Work Lifecycle seam'inde salt okunur ağaç ve sürükleme karşıtı. İş yaşam döngüsü kapsam paketi.
