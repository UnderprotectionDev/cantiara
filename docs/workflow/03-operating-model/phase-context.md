# Çalışma Modeli ve Operasyon

Kurucu online-only web ve macOS paketinde yazar; bağlantı kesilince ürün yazmayı kuyruğa almaz. Üretim verisi, yedek ve özel içerik Avrupa Birliği veri bölgesinde kalır. Hizmet alarmı ve operasyonel yedek kurucunun işlettiği sözleşmedir.

Çalışma modeli ikinci bir yerel doğruluk kaynağı açmaz. Kesinti fail-closed yaşanır; AB dışına otomatik failover yoktur. Bu feature çalışma modeli ve operasyonu tamamlar. Çöp Kutusu, hesap kapatma ve Üretim Olayı öğrenimi ayrıdır.

## Alt Fazlar

### Online-only çalışma

Belge okuma, kayıt oluşturma ve planlama değişikliği aktif internet bağlantısı ister. Bağlantı kesildiğinde kurucu son başarılı kayıt zamanını ve yazılmamış değişiklik riskini görür.

Yeniden bağlanma bekleyen yazmayı gizlice tamamlamaz. Yerel çalışma kuyruğu, offline cache veya otomatik eşitleme oluşmaz.

Bu alt faz çevrimdışı ürün, senkron çatışması veya cihaz-yerel veritabanı kurmaz.

### Avrupa Birliği veri bölgesi

Birincil üretim verisi ve operasyonel yedekler Avrupa Birliği veri bölgesinde tutulur. Özel veri, bağlantıyla sınırlı içerik, yedek ve loglar otomatik failover sırasında AB dışına çıkmaz.

AB kesintisi fail-closed kesinti olarak yaşanır. Daha önce onaylanmış herkese açık statik içerik, özel bağımlılıkları açmadan mevcut dağıtım noktasından sunulmaya devam edebilir.

Bölge değiştirmek ayrı taşıma kararıdır. Çıkış paketi canlı yerleşimi taşımaz.

### Operasyonel yedek ve kurtarma

Hizmet `RPO ≤ 5 dakika` ve `RTO ≤ 8 saat` hedeflerini karşılar. Geri yükleme veritabanı ile özgün nesnelerin kesin manifestini tek mantıksal birim sayar.

Restore sonrası geri döndürülemez güvenlik olay günlüğündeki silme, redaksiyon, yüzey/token iptali ve anahtar rotasyonu yeniden uygulanır. Replay bitene kadar dış erişim fail-closed kalır.

Bu alt faz kullanıcıya dönük restore-point, Çöp Kutusu veya Çalışma Alanı çıkış paketi değildir.

### Hizmet işletimi ve alarm

Kurucu hizmet operatörüdür. Sağlık, hata oranı, kuyruk gecikmesi ve yedek başarısızlığı için yapılandırılmış metrik ve alarm bulunur. Kullanıcı hatada secret içermeyen destek referansı görür.

S1 alarmı otomatik tespitten en fazla beş dakika içinde üretilir; güvenliyse fail-closed sınırlama insan beklemeden başlar. İlk ürün 7/24 insan nöbeti vadetmez.

Bu alt faz pager, müşteri destek kuyruğu veya Üretim Olayı kaydı değildir.

## Tamamlanma Ölçütleri

- Bağlantı kesildiğinde offline kuyruk oluşmaz; kullanıcı son başarılı kayıt zamanını ve yazılmamış değişiklik riskini görür.
- Üretim, yedek ve özel içerik Avrupa Birliği veri bölgesi sözleşmesinde kalır; AB kesintisi fail-closed yaşanır.
- Operasyonel yedek RPO ve RTO hedeflerini karşılar; restore güvenlik olaylarını yeniden uygular.
- S1 alarmı tespitten en fazla beş dakika içinde üretilir; kullanıcı secret içermeyen destek referansı görür.

## Kapsam Sınırları

- İstemci kabuğunu yerel-first veya offline-first ürüne dönüştürme.
- AB dışına otomatik failover veya bölgeyi sessizce taşıma.
- Operasyonel yedeği çıkış paketi, Çöp Kutusu veya ürün içi restore sayma.
- Alarmı pager, 7/24 nöbet veya Üretim Olayı öğrenimine çevirme.
