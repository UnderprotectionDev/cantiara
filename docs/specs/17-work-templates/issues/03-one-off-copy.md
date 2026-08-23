# 03 — Şablona dönüşmeden tek seferlik kopya

**What to build:** Kurucu mevcut İşi aynı Projede şablona dönüştürmeden kopyalar. Oluşturmadan önce kopyalanacak alanlar gösterilir. Yeni İş yeni anahtar ve varsayılan başlangıç durumuyla açılır. Başlık, tür, açıklama, tarih olmayan seçili özel alanlar ve hafif kontrol listesi kopyalanabilir. Geçmiş, ilişki, kapanış, durum, planlama üyeliği ve bütün mutlak tarihler kopyalanmaz.

**Blocked by:** 01 — İş şablonu tanımı

**Status:** ready-for-agent

- [ ] `Duplicate Work` kaynağı şablona çevirmez; aynı Projede yeni bağımsız İş açar.
- [ ] Önizleme kopyalanacak alanları gösterir; onay olmadan yazma yoktur.
- [ ] Yeni anahtar ve Proje varsayılan başlangıç durumu kullanılır.
- [ ] Tarih türündeki özel alan değerleri dahil hiçbir mutlak tarih, geçmiş, ilişki, kapanış sonucu, mevcut durum veya planlama üyeliği kopyalanmaz.
- [ ] Kabul kanıtı Work Templates seam'inde: kopya kimliği, dışlanan yaşam döngüsü alanları, şablon oluşmama.
