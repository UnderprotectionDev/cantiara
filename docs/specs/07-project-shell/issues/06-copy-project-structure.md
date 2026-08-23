# 06 — Proje yapısını kopyalama

**What to build:** Kurucu aşama, etkin alan, durum, hazır görünüm, bağlam kartı düzeni, özel alan tanımı, öncelik ölçütü tanımı ve boş duvar iskelet tanımını içeriksiz yeni Projeye önizleyerek kopyalar. Kayıtlar, geçmiş, ilişkiler, kartlar, İş şablonları, Planlı Test Senaryosu ve otomasyon kuralı gelmez. Kaynak Proje değişmez. Çalışma Alanı genelinde ortak alan kimliği oluşmaz.

**Blocked by:** 05 — Aşamalar, alanlar ve durum semantiği

**Status:** ready-for-agent

- [ ] Önizleme neyin gideceğini gösterir; onay içeriksiz yeni Proje üretir.
- [ ] Özel alan tanımları hedefte bağımsız kopyadır; ortak Workspace şema kimliği yoktur.
- [ ] İçerik, geçmiş, ilişki, şablon, test senaryosu ve otomasyon kopyalanmaz.
- [ ] İngilizce `Copy project structure` PRD terim sözlüğüne aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Project Shell seam'inde önizleme, içerik karşıtı, kaynak değişmezliği. İlk Proje yapı kopyası; içerikli fork yoktur ([kapsam dışı](../../../prd/19-out-of-scope.md)).
