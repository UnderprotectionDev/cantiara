# Veri ve Keşif Arketipleri

| Arketip | Sinyal | Yokla | Uydurma |
|---|---|---|---|
| Data Surfaces, Table ve Dashboard | tablo, dashboard, metrik, filtre | veri kapsamı, filtre/sıralama, drill-down, boş/hata durumu | bağımsız analytics backend |
| Search ve Discovery | sorgu, arama, browse, keşif | sorgu, filtre, sıralama, pagination, zero-result ve yetki | global arama veya indeks |
| Import, Export ve Data Operations | CSV, mapping, import/export, bulk | alma, eşleme, doğrulama, preview, kalıcılık ve hata raporu | her aşamayı veya formatı ayrı ana faz |
| Product Telemetry, Event Analytics ve Usage Insights | event, funnel, usage insight | event sözleşmesi, toplama, metrik kapsamı, görünür insight | gözlemlenebilirlik altyapısı |
| Search Indexing, Catalog Sync ve Derived Data | index, sync, materialized/derived data | kaynak değişimi, güncellik, rebuild, hata/recovery ve tüketici | küçük liste filtresinden ayrı indeks sistemi |

Görünür rapor, export ve telemetry aynı teknik pipeline’ı paylaşsa bile amaç/sonuç sözleşmeleri ayrı değerlendirilebilir.
