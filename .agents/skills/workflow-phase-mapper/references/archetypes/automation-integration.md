# Otomasyon ve Entegrasyon Arketipleri

| Arketip | Sinyal | Yokla | Uydurma |
|---|---|---|---|
| Background, Jobs ve Operations | queue, job, retry, schedule | tetikleyici, kalıcı durum, retry/cancel, görünür sonuç | provider kurulum fazı |
| Integrations ve Developer Platform | API key, webhook, connector, SDK | yetkilendirme, payload/sözleşme, teslim, retry, sürüm açıkça varsa | public API veya portal |
| AI ve Automation | model, öneri, generation, agent | girdi kapsamı, çıktı durumu, insan kararı, güvenlik/fallback | scraping, chat veya agentic action |
| Workflow, Tasks ve Approvals | task, state machine, approval | talep, atama, karar, geçiş, escalation/rejection | çok aşamalı onay |
| Realtime Collaboration ve Offline Sync | presence, live edit, offline, conflict | oturum, yayılım, conflict, reconnect, merge sonucu | websocket/provider fazı |
| Communication ve Notification | email, SMS, push, inbox | domain olayı, alıcı/tercih, teslim, failure/retry | toast’tan bildirim merkezi |
| Support, Helpdesk ve Customer Success | ticket, case, SLA, support | intake, atama, durum, konuşma, SLA/escalation açıkça varsa | CRM veya chatbot |

Kesen otomasyon kendi yolculuk ve kabulünü taşıyorsa ayrı olabilir; feature’a özgü davranış sahipliğini ortak servis gerekçesiyle üzerine almaz.
