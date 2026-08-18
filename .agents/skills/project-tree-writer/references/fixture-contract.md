# Directory Fixture Contract

Her regression senaryosu `fixtures/<id>/` altında bulunur:

```text
<id>/
  case.json
  sources/
  expected/
    structure.md | response.md
```

Inactive invocation case'i expected output taşımaz.

`case.json` alanları:

- `version`: `3`;
- `id`, `description`;
- `invocation`: `explicit` veya `implicit`;
- `user_input`;
- `expected_activation`;
- `expected_mode`: `none`, `structure` veya `question`;
- question case'lerinde output'un bold karar başlığını taşıyan `question_axis`;
- `source_dir` ve active case için `output_file`;
- optional `target_root`; verilmezse `.` kullanılır ve structure output doğrudan bu
  root'un `structure.md` dosyasıdır;
- optional `required_paths`, `forbidden_paths`;
- generic klasör için exact tree path → source file veren `generic_path_evidence`;
- grouped workspace leaf'leri için `package_roots`; ayrıca her export subpath'ini
  (`.`, `./contract` gibi) kaynak leaf manifestine ve package-relative görünür source
  tree path'ine bağlayan `package_exports`; manifestin `dist` build target'ı tree'ye
  zorlanmaz;
- Nx app-scoped project'leri için `nx_feature_roots`;
- optional exact `route_feature_map`;
- primary JS/TS route sınırları için `route_roots` ve izinli `route_entry_paths`;
- optional semantic `properties`.

Tree beklentileri full path graph'ı üzerinde kontrol edilir. Generic klasör istisnası
substring değil exact path ve var olan source evidence dosyası taşımalıdır.

Fixture kaynakları gerçek proje sinyallerini küçük ama anlamlı dosyalarla temsil eder.
Framework veya monorepo kararı yalnız fixture açıklamasında değil `sources/` içinde
görünmelidir.

Invocation metadata runtime politikasını taşır: `explicit` input bağımsız tam
`$project-tree-writer` belirtecini içerir ve aktive olur; daha uzun bir adın substring'i
çağrı değildir. `implicit` input belirteci içermez, aktive olmaz ve expected output
taşımaz.
