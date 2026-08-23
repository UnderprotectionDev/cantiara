# 01 — Kapalı dünya önizlemesi, limit ve kaynak manifesti

**What to build:** Kurucu seçili kayıt dışa aktarmasını kapalı dünya önizlemesiyle görür: kayıt türü, kapsam, alanlar, ilişkiler, kayıp ve gizlenenler onaydan önce listelenir. Her çıktı şema sürümü, kapsam, filtre, görünür alan ve üretim zamanını taşıyan kaynak manifesti içerir. İşlem başına tek kayıt ailesi, tek seçili kapsam, en fazla 10.000 satır veya 25 MB. Secret, paylaşım token'ı ve bağlantı parolası önizleme ve çıktıda yoktur. Bu ticket JSON/CSV baytlarını 02/03'te üretir; burada sözleşme ve reddir.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Önizleme seçilmeyen ilişki, alan, kayıt ve secret'ı kapsama almaz; onaydan önce Çalışma Alanı değişmez.
- [ ] Manifest şema sürümü, kapsam, filtre/görünür alan, üretim zamanını taşır; canlı senkron veya ikinci doğruluk kaynağı oluşturmaz.
- [ ] 10.000 satır veya 25 MB (hangisi önce) aşımı ve eşzamanlı kapasite aşımı görünür reddedilir; sessiz uzun iş yoktur.
- [ ] Secret, paylaşım token'ı, bağlantı parolası önizleme ve üretilen artifact'ta yoktur.
- [ ] İngilizce UI `Export` kullanır; tek Belge Markdown/PDF ve `Workspace Exit Package` bu yüzeyde yoktur.
- [ ] Önizlemesiz gizli alan veya secret yazılmaz; onaydan önce artifact üretilmez.
- [ ] Çıktı canlı Çalışma Alanı verisinin AB yerleşimini taşımaz; indirme bölge taşıması değildir.
- [ ] Hesap kapanma dondurması bu seam'i kapatmaz: seçili Markdown/JSON/CSV, 84'ün dondurulmuş kümesinde 82'ye ek kullanılabilir kalır ([Hesap kapatma](../../../prd/03-account-platform-operations.md#hesap-kapatma); PRD 13 "export durur" cümlesi uygulanmaz).
- [ ] Kabul kanıtı Selected Export seam'inde önizleme, manifest, limit, secret yokluğu, 31/82 yokluğu, yerleşim değişmemesi. Kanıt [Taşınabilirlik](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari) yolculuğunun seçili-export dilimidir.
