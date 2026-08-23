# 01 — DDL üretimi ve Neon disposable doğrulama

**What to build:** Kurucu kesin Veri Modeli Diyagramı Sürümünden tam PostgreSQL DDL önizler ve kopyalar. Kapalı invariant kümesi ve izinli extension matrisi geçmeden önizleme/kopya/`.sql` kapalıdır; kısmi SQL yoktur. Doğrulama üretimle aynı pinlenmiş major + matriste her çalışmada yeni Neon disposable veritabanında parse/apply edilir ve sonuçtan sonra atılır. `Statically Validated` bu atılabilir kontrolün geçtiği anlamına gelir; kullanıcının, staging'in veya production'ın veritabanına uygulanmışlık, `Çalıştırıldı` veya `Production-ready` değildir. Credential ve canlı hedef yoktur. Modelleme komutları bu seam'de yoktur.

**Blocked by:** None — can start immediately. Pinlenmiş Data Model Diyagram Sürümü 59'dan fixture olarak verilir.

**Status:** ready-for-agent

- [ ] DDL kaynak sürüm, model hash, generator sürümü ve uyarı manifestiyle birlikte durur.
- [ ] Bütün invariant ihlalleri tek raporda adlandırılmış öğe yoluyla gösterilir; ilk hatada gizleme yoktur.
- [ ] Neon disposable parse/apply+destroy olmadan `Statically Validated` verilmez; kullanıcı/staging/production DB'sine bağlanılmaz.
- [ ] `Statically Validated` uygulanmışlık iddiası değildir; disposable apply `Applied` / `Çalıştırıldı` / `Production-ready` durumu veya etiketi üretmez. Atılan doğrulama veritabanı kullanıcı hedefi sayılmaz.
- [ ] Matris dışı extension adlandırılmış reddedilir; `CREATE EXTENSION` üretilmez.
- [ ] Sunum-only düzen hash'i ve doğrulamayı düşürmez.
- [ ] Kabul kanıtı Schema Artifacts seam'inde: golden invariant, disposable yaşam, credential yokluğu. Erişilebilirlik **PostgreSQL DDL ve Migration Artefaktı önizleme/export'u**.
