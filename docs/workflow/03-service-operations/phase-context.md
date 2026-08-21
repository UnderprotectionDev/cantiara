# Hizmet İşletimi ve Destek Sinyalleri

Sistem sağlık, hata, kuyruk ve yedek sinyallerini ölçer. Ciddi kesintide S1 zinciri kabul süresi içinde başlar ve kullanıcıya secret içermeyen bir destek referansı verilir.

Kurucu, hizmetin ayakta olup olmadığını ve bir kesintide nereye başvuracağını görür. İşletim sinyalleri ürün kaydının yerine geçmez; görünür güven üretir.

Bu feature hizmet işletimi ve destek sinyalini tamamlar. Ürün içi dikkat sinyalleri, Üretim Olayı öğrenimi ve hesap kapatma ayrı kalır.

## Tamamlanma Ölçütleri

- Sağlık, hata, kuyruk ve yedek sinyalleri ölçülür ve işletilebilir kalır.
- S1 zinciri kabul süresi içinde başlar; kullanıcıya secret içermeyen destek referansı verilir.

## Kapsam Sınırları

- Pager, on-call platformu veya müşteri destek yazılımı kurma.
- Destek referansına secret, oturum jetonu veya kişisel veri gömme.
- İşletim sinyalini ürün içi Bildirim Merkezi veya Üretim Olayı kaydı sayma.
