# GitHub bağlantısını kararlı kimlik ve daraltılmış izinlerle kur

## Bağlam

Repository sahibi veya adı değişebilir ve eski bir ad başka repository tarafından yeniden kullanılabilir. GitHub Release, tag ve commit bağlamı için gereken `Contents: read` izni teknik olarak kaynak dosyalarını da okuyabilir.

## Karar

Kullanıcı kimliği ve ürün oturumu Better Auth üzerinden GitHub login OAuth'u ile, repository yetkisi ise ayrı GitHub App installation'ı ile kurulur. Bağlantı GitHub'ın kararlı repository kimliğiyle eşlenir; ad veya sahip kimlik sayılmaz. GitHub App yalnız seçilmiş repository'lerde salt okunur Metadata, Issues, Pull Requests, Checks, Commit Statuses ve gerekli Contents izinlerini ister. Uygulama endpoint izin listesi dosya içeriği, tree, blob, arşiv, diff ve tam log çağrılarını yasaklar. Login OAuth'unun kaldırılması installation'ı; installation'ın kaldırılması login kimliğini veya ürün oturumunu iptal etmez. Hesap kapatma ikisini de iptal eder.

## Sonuçlar

- Yeniden yetkilendirme geçmişi yalnız kararlı kimlik eşleşince sürdürebilir.
- Contents izninin gerekçesi kullanıcıya açıkça gösterilir.
- İzin listesinin aşılmadığı test ve gözlemlemeyle kanıtlanır.

## İlgili belgeler

- [Mühendislik ve sürümler](../prd/12-github-and-project-releases.md)
