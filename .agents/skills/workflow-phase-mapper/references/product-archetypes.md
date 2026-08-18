# Ürün Arketipi Yönlendirme İndeksi

Arketipler faz, alt faz, `phaseKind` veya önkoşul üretmez. Yalnız yetkili ürün kaynağında sinyal bulunduğunda ilgili modülü oku; kaynakta olmayan davranışı yoklama listesinden ekleme. Hata, yetki veya toparlanma yoklamasını iç davranış envanterinde tut; bunları mekanik alt-faz alanlarına dönüştürme.

Her modülde:

- **Sinyal** hangi kaynak dilinin modülü açtığını;
- **Yokla** gözden kaçabilecek kaynak davranışlarını;
- **Uydurma** sinyalden çıkarılamayacak kapsamı belirtir.

| Tematik modül | İçerdiği arketipler | Ne zaman oku |
|---|---|---|
| [content-community.md](archetypes/content-community.md) | Content/Publishing, Social/Community, Library/Collection, Reviews/Trust, Documents/Files/Media, Knowledge Base/Docs/Learning | İçerik, topluluk, koleksiyon, dosya veya öğrenme yüzeyi varsa |
| [commerce-operations.md](archetypes/commerce-operations.md) | Commerce/Billing, Fulfillment/Inventory/Logistics, Subscription/Entitlements/Usage, Marketplace/Listings/Seller, Finance/Accounting/Ledger | Para, sipariş, stok, abonelik, pazar veya ledger davranışı varsa |
| [workspace-governance.md](archetypes/workspace-governance.md) | Admin/Settings/Workspace, Enterprise Identity/Security/Compliance, Localization/Accessibility/Regionalization, Audit/Privacy/Data Governance | Workspace yönetimi, güvenlik, bölgesellik veya yönetişim varsa |
| [data-discovery.md](archetypes/data-discovery.md) | Data Surfaces/Table/Dashboard, Search/Discovery, Import/Export/Data Ops, Product Telemetry/Analytics, Search Indexing/Catalog Sync/Derived Data | Tablo, dashboard, arama, veri hareketi, analitik veya türetilmiş veri varsa |
| [automation-integration.md](archetypes/automation-integration.md) | Background Jobs/Ops, Integrations/Developer Platform, AI/Automation, Workflow/Tasks/Approvals, Realtime/Offline, Communication/Notification, Support/Helpdesk/Success | Asenkron, dış sistem, AI, onay, canlı eşleme, bildirim veya destek varsa |
| [growth-engagement.md](archetypes/growth-engagement.md) | Forms/Onboarding/Funnel, Experimentation/Flags/Rollout, Personalization/Feed/Recommendation | Dönüşüm, deney/yayılım veya kişiselleştirme varsa |
| [scheduling-business.md](archetypes/scheduling-business.md) | Location/Maps/Booking, CRM/Sales/Account, Calendar/Scheduling/Availability | Konum, rezervasyon, satış hesabı veya takvim varsa |

Toplam 33 arketip vardır. Aynı kaynak birden fazla modülü açabilir; yalnız sinyalli satırları uygula. Modül yoklamasından sonra adayları Bağımsız Feature Kapısı, anti-merge ve ilgili kesen/gözlenebilir sistem kapısıyla değerlendir.
