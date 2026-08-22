# Kayıt Keşfi

Kurucu yetkili ana kayıtları deterministik tam metin sırası, görünür eşleşme bağlamı ve desteklenen filtrelerle bulur. Belge ve Dosya Ekleri de aynı arama ve dizin gerçeğine girer; ayrı belge kütüphanesi oluşmaz. Kanban, Takvim, Roadmap, Kapsam Ağacı, Akıllı Koleksiyon ve Bildirim Merkezi içinden kaynak bağlamını kaybetmeden geçici kayıt önizlemesi açar.

Arama tahmini sıralamaz. Kurucu neden o kaydın geldiğini eşleşme bağlamından görür; Taslak, yakalama ve dış yüzey kopyası sonuçta yoktur. Önizleme paneli kopya veya kalıcı çalışma durumu oluşturmaz. Tür dizini, tablo veya koleksiyon kurmadan kaydı yerinde bulur.

Bu feature kaydı bulmayı, önizlemeyi, tür dizinlerini ve tablo görünümünü tamamlar. Komut Paleti, Akıllı Koleksiyon ve belge hiyerarşisi ayrı kalır.

## Alt Fazlar

### Evrensel arama

Yetkili ana kayıtlar deterministik tam metin sırası ve görünür eşleşme bağlamıyla bulunur. Belge gövdesi ve Dosya Eki üstverisi aynı yetkili kümede taranır. Geçici kayıtlar, taslaklar ve dış kopyalar arama gerçeğine girmez. Secret, paylaşım token'ı ve bağlantı parolası dizinlenmez.

Anlamsal veya AI sıralama yoktur. Taslak, Yakalama öğesi veya Dış yüzey snapshot'ı dizinlenmez.

Arama, Komut Paleti veya tür dizini ile tek yüzey sayılmaz. Belge klasör ağacı bu aramanın yerine geçmez.

### Bağlam içi kayıt önizleme

Desteklenen yüzeylerden geçici kayıt önizlemesi kaynak bağlamını kaybetmeden açılır. Panel kopya kayıt veya kalıcı çalışma durumu oluşturmaz.

Kurucu bir kartı tam sayfaya gitmeden okur; kapayınca yüzeydeki yeri korunur.

Önizleme ikinci kayıt veya düzenleme oturumu değildir. Panel açık bırakılıp kalıcı yerleşim kaydedilmez. Bütün kayıt türleri için zorunlu yan panel dayatılmaz.

### Hazır tür dizinleri

Desteklenen ana kayıt türleri sıfır kurulumla kapsam, arşiv ve görünür alanlarına göre gezilir. Belge ve Dosya Eki dizinleri kapsam, tür, klasör ve desteklenen üstveriyle aynı hazır yüzeyi kullanır.

Dizin, ana menü başına tek tablo veya ayrı sahiplik kapsamı değildir. Kurulum gerektiren görünüm hazır dizinin yerini tutmaz. Arşiv kayıtları dizinden düşürülmez veya silinmiş sayılmaz.

### Tür kapsamlı tablo görünümü

Desteklenen kayıt alanları yoğun tabloda sıralanır, filtrelenir ve aynı ana kayda inline yazılır.

Tablo satırı ayrı kayıt veya dış spreadsheet senkronu değildir. Inline düzenleme toplu eylemin yerine geçmez. Türü desteklenmeyen kayıtlara tablo dayatılmaz.

## Tamamlanma Ölçütleri

- Yetkili ana kayıtlar, Belge ve Dosya Eki üstverisi deterministik tam metin sırası ve görünür eşleşme bağlamıyla bulunur.
- Geçici kayıtlar, taslaklar, dış kopyalar ve secret arama gerçeğine girmez.
- Desteklenen yüzeylerden geçici kayıt önizlemesi kaynak bağlamını kaybetmeden açılır.
- Panel kopya kayıt veya kalıcı çalışma durumu oluşturmaz.
- Desteklenen ana kayıt türleri sıfır kurulumla kapsam, arşiv ve görünür alanlarına göre gezilir.
- Desteklenen kayıt alanları yoğun tabloda sıralanır, filtrelenir ve aynı ana kayda inline yazılır.

## Kapsam Sınırları

- Anlamsal/AI sıralama veya gizli kişiselleştirme.
- Taslak, Yakalama öğesi veya Dış yüzey snapshot'ını dizinleme.
- Secret, paylaşım token'ı veya bağlantı parolasını arama gerçeğine alma.
- Aramayı Komut Paleti ile tek yüzey sayma.
- Belge hiyerarşisini evrensel aramanın yerine koyma.
- Önizlemeyi ikinci kayıt veya düzenleme oturumu sayma.
- Paneli açık bırakıp kalıcı yerleşim kaydetme.
- Bütün kayıt türleri için zorunlu yan panel dayatma.
- Dizini ana menü başına tek tablo veya ayrı sahiplik kapsamı sayma.
- Kurulum gerektiren görünümü hazır dizin yerine koyma.
- Arşiv kayıtlarını dizinden düşürme veya silinmiş sayma.
- Tablo satırını ayrı kayıt veya dış spreadsheet senkronu sayma.
- Inline düzenlemeyi toplu eylemin yerine koyma.
- Türü desteklenmeyen kayıtlara tablo dayatma.
