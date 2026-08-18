# Workspace ve Yönetişim Arketipleri

| Arketip | Sinyal | Yokla | Uydurma |
|---|---|---|---|
| Admin, Settings ve Workspace | workspace, yönetici, ayar, üyelik | üyelik/rol, çalışma alanı ayarı, davet, sahiplik aktarımı açıkça varsa | enterprise rol matrisi |
| Enterprise Identity, Security ve Compliance | SSO, SCIM, MFA, policy, compliance | kimlik eşleme, provision/deprovision, policy enforcement, audit sonucu | organization, SSO veya compliance standardı |
| Localization, Accessibility ve Regionalization | locale, dil, timezone, a11y, bölge | içerik/format fallback’i, klavye/ekran okuyucu davranışı, bölgesel kurallar | çeviri yönetim sistemi |
| Audit, Privacy ve Data Governance | audit log, consent, retention, export/delete | olay kaydı, erişim, saklama, veri talebi, yasal kısıt açıkça varsa | GDPR akışı veya admin yüzeyi |

Auth provider seçimi ürün rolü veya workspace kapsamı üretmez. Terminoloji kaynağı teknik/politika davranışının otoritesi değildir.
