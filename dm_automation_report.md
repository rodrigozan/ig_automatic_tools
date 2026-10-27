# Relatório de Análise e Melhoria: Automação de DMs (Instagram)

## 1. Diagnóstico Atual
A automação de DMs do `ig-automatic-tools` possui uma arquitetura **reativa e frágil**. Ela depende exclusivamente de webhooks do Meta e de buscas simples no banco de dados, o que a torna suscetível a falhas silenciosas.

### Pontos Críticos Identificados:
- **Dependência Passiva:** Se o webhook do Meta falhar ou a permissão `instagram_manage_messages` não estiver aprovada, a automação não inicia.
- **Gestão de Tokens Simplista:** Não há validação prévia do token; o sistema tenta enviar e reage ao erro, resultando em falhas de entrega.
- **Fila de Espera Básica:** O processamento de mensagens em fila é feito via scan de banco de dados, o que não é escalável e pode causar colisões.
- **Janelas de Resposta Rígidas:** A expiração de conversas é linear, sem mecanismos de retentativa inteligente.

---

## 2. Comparativo: ig-automatic-tools vs. ChatbotX
O **ChatbotX** utiliza um conceito de **Connections Lifecycle**, tratando a conta não como um registro no banco, mas como uma conexão ativa e monitorada.

| Recurso | ig-automatic-tools | ChatbotX | Impacto |
| :--- | :--- | :--- | :--- |
| **Trigger** | Webhook $\rightarrow$ DB $\rightarrow$ API | Connection Registry $\rightarrow$ Flow $\rightarrow$ API | Maior estabilidade no ChatbotX |
| **Tokens** | Recuperação direta do DB | Camada de credenciais com validação | Menos erros de "Token Invalid" |
| **Fluxo** | Lógica hardcoded no serviço | Motor de passos (Flow-based) | Maior flexibilidade no ChatbotX |
| **Infra** | Scripts de fila simples | Arquitetura de pacotes modular | Melhor escalabilidade no ChatbotX |

---

## 3. Plano de Implementação para Robustez
Para elevar o `ig-automatic-tools` ao nível profissional, propõe-se as seguintes melhorias:

### A. Camada de Connection Manager
- **Validação Ativa:** Implementar check de token (`/me`) antes de disparos críticos.
- **Sincronização de IDs:** Mapeamento robusto de `webhookId` para `igUserId` via `altIgUserIds`.
- **Gestão de Status:** Marcar contas automaticamente como `disconnected` ao detectar tokens expirados.

### B. Infraestrutura de Mensageria
- **Implementação de Worker:** Substituir o scan de DB por uma fila real (ex: Redis/BullMQ).
- **Exponential Backoff:** Retentativas automáticas em caso de erro 429 (Too Many Requests) ou 500.
- **Controle de Rate Limit:** Gestão rigorosa de envios por hora para evitar bloqueios da conta.

### C. Requisitos de Conformidade (Meta)
- **App Review:** Aprovação obrigatória das permissões `instagram_manage_messages` e `instagram_manage_comments`.
- **Configuração de Webhook:** Validação de SSL e subscrição correta dos campos de eventos.

---

## 4. Análise de Risco (Publicações Automáticas)
A implementação destas melhorias **não quebra** a automação de publicações, pois utilizam permissões distintas (`instagram_content_publish`).

**Medidas de Segurança para Evitar Instabilidade:**
1. **Isolamento de Tokens:** Manter a compatibilidade de leitura do token para que o módulo de posts não pare de funcionar.
2. **Controle de Spam:** O limite de DMs deve ser rigoroso para evitar que o Instagram aplique restrições à conta que afetem a visibilidade dos posts.
3. **Deploy Gradual:** Implementar a nova lógica em um serviço isolado (`dm_v2`) e testar em contas secundárias.
