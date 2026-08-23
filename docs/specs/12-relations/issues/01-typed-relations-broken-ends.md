# 01 — Türlenmiş ilişkiler ve kırık uç

**What to build:** Ana kayıtlar kapalı katalogdaki türle, yön ve izinli uçlarla bağlanır. Kullanıcı yeni tür icat etmez. İlişki karşı ucu otomatik kapatmaz; durum yazmaz (uzman kural başka feature’da). Çözülemeyen uç ortak kırık referans sunumunu kullanır; gövde ve yetkisiz başlık sızmaz. En az `Related` ve `Origin`/`Derived` genel UI’si bu ticket’tadır; Kanıt rolü ve GitHub PR UI’si yoktur.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Katalog dışı tür reddedilir; iki uç, yön ve anlam saklanır. Kapalı katalog (İngilizce UI; PRD 02 tablosu):

| Type | Allowed ends | Cardinality |
| --- | --- | --- |
| `Related` | any two main records (plus exact Diagram Version ↔ Work/Decision/Project Release; Migration Artifact ↔ GitHub external/Test Session/Project Release) | many-to-many |
| `Origin` / `Derived` | Source, Document, Capture, Feedback, Technical Diagram, Work, Test Session, User Research Session, or Test Gap → produced main record | many origins; owned component is not an independent end |
| `Evidence` / `Provides evidence` | exact Source/Document/Diagram version, Feedback, User Research Session, Experiment/Validation, Session Test, or File Attachment version → Work/Decision/Risk/Assumption/Question/Test/Project Release or its Access/Result observation | many-to-many |
| `Contributes to Goal` / `In Goal` | Work, Milestone, or Project Release → Project Goal | many-to-many |
| `Blocks` / `Blocked by` | Work, Decision, or Open Question → Work | many-to-many; `Active`/`Resolved` |
| `Includes` / `Included in` | Feature → Work | at most one primary Feature |
| `Contributes to Milestone` / `In Milestone` | Work → Milestone | many-to-many |
| `Primary spec` | Work/Feature → exact Document version | at most one current |
| `Supersedes` / `Superseded by` | same specialist type: Decision, Experiment/Validation, or exact Session Test | directed, acyclic |
| `Implements` / `Implemented by` | Work/PR/Project Release → Decision or spec | many-to-many |
| `Belongs to Company` | Contact → Company | at most one current Company |
| `Participant` | User Research Session/Feedback → Contact | zero or one Contact |
| `Required for completion` / `Contextual` | Work ↔ GitHub PR | many-to-many |

- [ ] `Related` köken veya kanıt yerine geçmez; önizlemesiz yazılmaz.
- [ ] Kırık uç nedeni kapalı kümedendir; içerik/önizleme yok; yetkisiz adda sızıntı yok; `Open source record` yalnız Arşiv/Trash hedeflerinde durur, kalıcı silinen/redakte/erişimsizde gizlenir.
- [ ] Kırık hedefin içeriği arama, Akıllı Koleksiyon, hesaplanmış sayı veya export’a girmez; dikkat sinyali veya takip İşi üretmez.
- [ ] Sahipli bileşen kökeni bağımsız uç değildir; hedef `Köken konumu` taşır, benzer öğeye sessiz kaymaz.
- [ ] İngilizce `Related`, `Origin`, `Derived` ve kırık-neden etiketleri terim tablosuna aynı değişiklikle eklenir.
- [ ] Kabul kanıtı Relations seam'inde katalog, sızıntı karşıtı, otomatik kapanmama. [Arama ve ilişki](../../../prd/16-product-acceptance.md#uctan-uca-kabul-yolculuklari).
