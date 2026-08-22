# Odak Dönemi

Kurucu seçili İşlerle çalışmak için 1–8 haftalık geçici pencere açar. Başlangıç ve kapanış kapsamı ayrı tarihsel snapshot olarak durur; güncel İşlerin yerine geçmez.

Pencere kalıcı kapsam grubu, Kilometre Taşı veya Proje Sürümü değildir. Bir İş aynı anda en fazla bir etkin dönemde bulunur. Kullanım zorunlu değildir. Dönem üyeliği İş durumunu veya proje aşamasını değiştirmez. İsteğe bağlı salt-okunur `Bağımlılıklar` görünümü dönem kapsamındaki mevcut blokaj ilişkilerinden türetilir; yeni ilişki, ikinci planlama verisi veya kritik yol üretmez.

Bu feature Odak Dönemini tamamlar. Günlük Odak, Roadmap ve öncelik oturumu ayrıdır.

## Tamamlanma Ölçütleri

- Dönem amaç ve tarih taşır; kapanışta kapsam snapshot'ı ve isteğe bağlı değerlendirme bırakır.
- Açık İşler toplu kararla sonraki döneme, Backlog'a veya vazgeçmeye gider; otomatik rollover yoktur.
- Dönem üyeliği İş durumunu veya proje aşamasını değiştirmez.
- `Bağımlılıklar` görünümü mevcut blokaj ilişkilerini okur; yeni ilişki üretmez.

## Kapsam Sınırları

- Odak Dönemini sprint, velocity veya zorunlu kadans sayma.
- Kilometre Taşı veya Proje Sürümü yerine kullanma.
- Açık İşleri kurala bağlayıp sonraki döneme sessizce taşıma.
- `Bağımlılıklar` görünümünü ayrı planlama gerçeği veya kritik yol sayma.
