# 02 — Şema değişiklik taslağı ve yıkıcı önizleme

**What to build:** Kurucu aynı Veri Modeli Diyagramının iki kesin sürümünü seçer. Taslak kapalı operasyon kataloğu, PRD faz sırası ve yıkıcı uyarılarla schema-only listedir; metin diff'i veya ORM migrate değildir. Silme ve daraltma gizlenmez; onay olmadan artefakt kesinleşmez. Kullanıcı Up SQL'ini düzenleyebilir; generator vs kullanıcı farkı ayrıdır ve düzenlenmiş metin yeniden statik doğrulanır. Backfill ve keyfî veri SQL'i taslağa giremez. Katalogun ifade edemediği fark üretimi durdurur.

**Blocked by:** 01 — DDL üretimi ve Neon disposable doğrulama

**Status:** ready-for-agent

- [ ] Kaynak ve hedef sürümler taslakta değişmez pinlenir.
- [ ] Kapalı operasyon kataloğu (ad + sınıf). Yıkıcı değil: `Create table`, `Rename table`, `Add column`, `Rename column`, `Widen column type` (`int2`→`int4`→`int8`, `float4`→`float8`, same-scale `numeric` precision increase, `varchar(n)`→ larger `varchar(m)`, `varchar(n)`→`text`), `Relax nullability`, `Tighten nullability` (existing-NULL warning), `Set or change default`, `Drop default`, `Add primary key`, `Add foreign key`, `Change referential action`, `Add unique constraint`, `Add check constraint`, `Add index`, `Drop index`, `Create enum type`, `Add enum value`, `Rename enum value`, `Create domain`, `Add domain constraint`. Olası yıkıcı: `Drop table`, `Drop column`, `Narrow column type`, `Drop primary key`, `Drop foreign key`, `Drop unique constraint`, `Drop check constraint`, `Drop enum type`, `Drop domain constraint`, `Drop domain`. Desteklenmiyor: `Free type conversion` (`USING`), `Drop enum value`, catalog-outside schema object (view/function/trigger/sequence ownership/partition/tablespace/role/grant/schema create/extension install), schema-outside data SQL.
- [ ] Değişmez faz sırası: 1 constraint drop (FK, then check, then unique, then PK, old names); 2 index drop; 3 table rename then column rename (temp names if needed); 4 enum/domain create, enum add/rename; 5 table create topological without FKs; 6 add column; 7 type/null/default change; 8 add PK/unique/check; 9 add index; 10 add FK including referential-action add half; 11 drop column; 12 drop table reverse topological; 13 drop enum type and domain.
- [ ] Yıkıcı sınıf operasyonlar ekstra onay ister; gizlenmez.
- [ ] Desteklenmeyen fark adlandırılmış engeldir; kısmi SQL yoktur.
- [ ] Kullanıcı düzenlemesi veri SQL'i kaçırmaz; yeniden doğrulama 01 hattını kullanır.
- [ ] Kabul kanıtı aynı seam'de: katalog altınları, yıkıcı önizleme, yasak SQL karşıtı.
