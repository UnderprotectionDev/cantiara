# Workflow Phase Mapper Bakım Bağlamı

Bu dosya yalnız skill paketini geliştirenler içindir; runtime girdisi veya hedef
projenin terminoloji kaynağı değildir. Runtime'daki `CONTEXT.md`, yalnız kullanıcı
tarafından sağlanan hedef proje dosyasını anlatır.

## Tek doğruluk kaynakları

| Sözleşme | Kanonik yüzey | Uygulayan/doğrulayan yüzey |
|---|---|---|
| Kaynak otoritesi ve faz sınırları | `references/decomposition-grammar.md` | `decomposition-decision-model.json`, decomposition fixture/testleri |
| Önkoşul ve sıra | `references/prerequisite-sequencing.md` | `scripts/preview_contract.py`, preview testleri |
| Görünür preview/final biçimi | `references/output-templates.md` | template, prepare/publish scriptleri, contract testleri |
| Preview → açık onay → publish yaşam döngüsü | `SKILL.md` | `prepare_preview.py`, `publish_phase_contexts.py`, publish testleri |
| Hata ve kalite adları | `references/failure-taxonomy.md`, `references/workflow-quality.md` | davranış fixture'ları ve package testleri |
| Regresyon yönlendirmesi | `references/regression-cases.md` | deterministik ve izole forward test araçları |
| Çağrı tercihi | `SKILL.md` frontmatter | `agents/openai.yaml`, package contract testi |

Runtime tanımlarını burada yeniden açıklama. Bir kavram değişirse kanonik referansı
ve onu uygulayan araç/test yüzeylerini birlikte güncelle.

## Bakım kapısı

1. Değişikliği sınır, görünür çıktı, yaşam döngüsü, sahiplik veya invocation
   sözleşmelerinden biriyle ilişkilendir ve kanonik yüzeyi belirle.
2. Belge, metadata, yürütülebilir araç, template ve fixture/test tüketicilerinin
   hangilerinin etkilendiğini çıkar; aynı davranışın ikinci açıklamasını ekleme.
3. Deterministik testleri ve skill doğrulamasını çalıştır. Ayrıştırma davranışı
   değiştiyse izole ham-kaynak forward case'lerini de çalıştır.

**Tamamlanma ölçütü:** Etkilenen bütün yüzeyler aynı sözleşmeyi taşır; preview ile
açık onay arasındaki durak, revizyon bağı, marker’sız sahiplikte fail-closed davranış
ve temiz görünür çıktı korunur; ilgili regresyonlar geçer.
