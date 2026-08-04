# PRD Quality Review — BuJo Digital (CC 2026-07-22, reorg por collection)

> Gate de revisão (subagente). Rito: update do PRD reorganizando a Seção 5 no modelo **núcleo + collections + plataforma**. Contexto: PRD pessoal médio-alto, chain-top (alimenta bmad-ux → [ARCH] → [CE]/épicos). Foco solicitado: disciplina capacidade×implementação, clareza/testabilidade dos FRs novos, cobertura de NFR transversal, consistência pós-renumeração, ambiguidades/`[ASSUMPTION]`.

## Veredicto do gate

**APROVADO COM RESSALVAS.**

O PRD está decision-ready e downstream-usable: o modelo mental (núcleo não-gateável + collections opcionais) é uma tese coerente, os guardrails de IA (FR-13.1, FR-2.4, FR-12.3) são testáveis e fortes, a taxonomia de collections dá vocabulário estável, e os três NFRs novos (7/8/9) fecham as frentes transversais pedidas (segurança de IA, privacidade, resiliência). Nada aqui trava o green-light. As ressalvas são duas e ambas devem ser saneadas **antes de [ARCH] consumir o par PRD+addendum**: (1) o **addendum** ainda referencia números **antigos** de FR que agora resolvem para features completamente diferentes — hazard de desvio real; (2) **FR-3** (e nomes de artefato de manifest espalhados em FR-1/2/6/13) vaza implementação para o corpo do PRD, duplicando o que já está no addendum. Fora isso, um punhado de vaguezas pontuais (FR-6.6) e a ausência de um Índice de Assumptions.

---

## 1. Disciplina capacidade × implementação — thin (é o ponto mais fraco)

O rito foi bem-intencionado: quase todo FR novo carrega uma nota `(… → addendum.)` deferindo o tech-how, e o addendum de fato recebe o detalhe. Mas em vários pontos o **corpo do FR já contém a implementação** que a nota promete deferir — ou seja, o conteúdo está **duplicado** nos dois documentos, que é exatamente o anti-padrão que o rito quer evitar.

Ofensor principal — **FR-3 (Plataforma de Automação/Captura)**: descreve API, não capacidade.
- FR-3.2 e FR-3.3 especificam **verbo + rota + shape de payload** literais (`POST /api/capture` com `{type, text, value?}`; `GET /api/summary/today`). Isso é design de API, não capacidade. A capacidade é "automação externa captura itens e busca um resumo do dia por uma credencial escopada e revogável". Endpoints/payload já estão no addendum (linha 79) — pura duplicação.
- FR-3.1 nomeia `JWT de sessão`, "sem refresh", "via admin" — mecânica de credencial (já no addendum, linha 78).
- FR-3.4 "rate limiting e logging" é NFR/implementação.

Vazamentos espalhados (nomes de artefato de código no corpo do PRD):
- `manifest`/`registro estático (dados puros)`, `rotas (lazy)`, campos reservados `dashboardCard`/`settingsSchema`, e a **DoD estrutural** de organização de pastas (FR-1.3) — tudo replicado no addendum (linha 72).
- capability `ai_available` (FR-2.2), `settingsSchema` (FR-2.1, FR-11.3), `dashboardCard` (FR-6.5), `serie_ref` + split "backend/front" (FR-13.4).
- FR-6.3 eleva a **decisão de reuso de componente** ("Hoje e Dashboard compartilham o mesmo componente") a requisito — testável só por code review, não por comportamento (ver §2).
- NFR-7 nomeia `statement_timeout`, role read-only, allowlist — aceitável num NFR de segurança, mas é a fronteira.

Não é um bloqueio de gate (as capacidades subjacentes são legítimas e claras), mas polui a fonte de verdade e cria dois lugares para manter a mesma decisão. Vazamentos legítimos como fronteira de capacidade (constraint de 1 nível de aninhamento em FR-14.2; "par sis/dia atômico" em FR-12.1) estão OK — descrevem *o quê*, não *como*.

### Findings
- **high** FR-3 descreve API em vez de capacidade (§5, FR-3.1–3.4) — verbos HTTP, rotas e shape de payload no corpo do PRD, já duplicados no addendum (linha 79). *Fix:* reescrever FR-3 como capacidade ("captura externa via credencial escopada/revogável; resumo agregado do dia numa chamada") e mover endpoints/payload/JWT/admin inteiramente para o addendum.
- **medium** Nomes de artefato de manifest/código no corpo (FR-1.3, FR-2.1/2.2, FR-6.5, FR-11.3, FR-13.4) — `manifest`, `dashboardCard`, `settingsSchema`, `ai_available`, `serie_ref`, "registro estático (dados puros)", DoD de pastas. *Fix:* no corpo, referir a capacidade ("cada collection ativa contribui um card"; "credencial de IA global"); deixar os identificadores de código só no addendum.
- **low** NFR-7 mistura mecanismo (statement_timeout / role read-only / allowlist) com a propriedade. *Fix:* enunciar a propriedade ("IA nunca gera nem executa query; leitura de relatório é defesa-em-profundidade") e manter o mecanismo no addendum (já está lá, linha 84).

---

## 2. Clareza e testabilidade dos FRs novos — adequate (forte na maioria, dois furos)

A maioria dos FRs novos tem consequência testável explícita, e alguns são exemplares:
- **FR-1.3** — "app **pixel-idêntico** antes/depois" + DoD estrutural = critério de aceite objetivo. (Ótimo, apesar do sabor de implementação.)
- **FR-1.4/1.5** — desativar preserva dados; reativar restaura; default all-off para convidado. Testável.
- **FR-2.1–2.4** — chave criptografada, capability derivada, elemento inativo (não oculto) que linka à config, dado de saúde nunca a provedor de treino. Testável.
- **FR-12.3** — "**nunca salvar direto**", badge de confiança por campo, confirmação explícita, `null` em vez de adivinhar. Excelente, à prova de ambiguidade.
- **FR-13.1** — guardrail (nunca sugere/preenche/gera número/gera query). Testável e central.
- **FR-13.7/13.8** — fronteira de privacidade e badge "dado lido por IA" distinto da tag "função de IA". Claro.
- Refinos **FR-4.14/4.15/4.16** — nítidos e com guardas explícitas ("proibido 7º estado"; "sem tocar o schema"; estados terminais). Muito bons para stories a jusante.

Furos:
- **FR-6.6** — "indicadores de uso do sistema (**consistência de uso**, percentual de hábitos agregado, **e outros**)". "consistência de uso" não tem definição de cálculo e "e outros" é aberto. Um engenheiro/designer de analytics não sabe o que computar. Isso é done-ness ambígua que pode travar a spec da home (bmad-ux) e o [CE].
- **FR-6.3** — "compartilham o mesmo componente" enuncia implementação como requisito; o requisito real é comportamental ("Hoje e Dashboard manipulam as tasks do dia de forma idêntica; diferem só pelo entorno"). Reescrever em termos de comportamento observável.
- **FR-10.5** — "campos semanais e livres com **visualização própria**" é subespecificado, mas defere ao addendum/UX; aceitável como está.

### Findings
- **medium** FR-6.6 métricas vagas (§5, FR-6.6) — "consistência de uso" sem fórmula e "e outros" indefinido; trava a done-ness da home/analytics. *Fix:* nomear as métricas do MVP com sua definição (ex.: "% de dias com Daily Log preenchido nos últimos N dias") e marcar o resto como refino de story.
- **medium** FR-6.3 requisito enunciado como implementação (§5, FR-6.3) — "mesmo componente" é decisão de arquitetura. *Fix:* enunciar o comportamento compartilhado observável; mover a decisão de reuso para [ARCH].

---

## 3. Cobertura de NFR transversal — strong

Os três NFRs novos endereçam exatamente as frentes pedidas e não são boilerplate — têm âncora de produto:
- **NFR-7 (segurança de IA):** IA nunca gera/executa query; só specs validadas server-side contra catálogo/allowlist; defesa em profundidade. Casado com FR-13.1/FR-13.4.
- **NFR-8 (privacidade de dado sensível):** chave criptografada em repouso; dado de saúde nunca a provedor que treina (Gemini free tier proibido); crop + strip de EXIF nas fotos de PA. Casado com FR-2.4/FR-12.8.
- **NFR-9 (resiliência de integração):** fonte externa indisponível nunca quebra o núcleo; degradação graciosa com "última sincronização". Casado com FR-11.4.

Lacunas menores (não bloqueiam):
- **Rate limiting/abuso** aparece só em FR-3.4, sem NFR correspondente; ficaria melhor como propriedade transversal agora que o Épico 10 traz mais usuários.
- **Auditabilidade/retenção** da evidência de PA (foto original + JSON bruto guardados, FR-12.5) intersecta NFR-8 mas não está enunciada como política de retenção/apagamento — relevante para LGPD (FR-15.6). Vale uma linha.

### Findings
- **low** Sem NFR de rate limiting/abuso (§6) — só existe em FR-3.4. *Fix:* promover a NFR transversal (throttling nos endpoints de automação) dado o multiusuário do Épico 10.
- **low** Retenção da evidência de PA não enunciada como política (§6 / FR-12.5) — foto + JSON bruto persistidos sem regra de retenção/apagamento; cruza com LGPD (FR-15.6). *Fix:* uma linha de política de retenção/apagamento em NFR-8 ou FR-12.

---

## 4. Consistência pós-renumeração — thin (o achado mais acionável do gate)

**Corpo do PRD:** as referências cruzadas do corpo resolvem corretamente para a **nova** numeração — verifiquei FR-6.6→FR-8.3/FR-7.10, FR-13→FR-11.5/FR-2/FR-12.8, FR-15.5→FR-1.4/1.5/6.4, FR-15.6→FR-12.8/FR-2.4/FR-1.6, FR-10.7 ("antigas FR-4.1/FR-4.2", explicitamente rotuladas). Nenhum número antigo solto no corpo. **Anexo A** faz roundtrip: o de-para é completo e as contagens batem (Motor BuJo 13→13, Hábitos 10→10, Medicamentos 4→4, Gestão de Usuários 4→4), com os novos FRs listados. Bom.

**Addendum:** aqui está o defeito. A **metade original (pré-CC)** do addendum ainda cita números **antigos** que a renumeração reaproveitou para features **diferentes**. Como os números 1/2/3/4/6 foram reciclados, cada referência stale agora resolve para o FR errado:
- Linha 16: "FR-3.1 (métricas de saúde dinâmicas)" → hoje FR-3.1 é **Plataforma de Automação**; deveria ser **FR-8.1**. "FR-2 (hábitos dinâmicos)" → hoje FR-2 é **Config de IA (BYO key)**; deveria ser **FR-7**.
- Linha 27: "Medicamentos (FR-3.4)" → hoje é parte da Plataforma; deveria ser **FR-9.1**.
- Linha 41: "fase posterior (FR-6)" → hoje FR-6 é **Home/Dashboard/Hoje**; deveria ser **FR-15**.
- Linha 49: "requisitos do PRD (FR-2)" (hábitos) → deveria ser **FR-7**.
- Linha 60: "recorrência de tarefas (FR-1.11)"/"(FR-1.12)" → deveriam ser **FR-4.11/FR-4.12**.

A metade nova ("Adendo CC 2026-07-22") usa os números **novos** corretamente (FR-1, FR-3, FR-13, FR-10, FR-11, FR-12, FR-2, FR-14). Ou seja, o addendum é **internamente inconsistente**: a seção nova certa, a seção velha stale. Como [ARCH] lê o addendum como fonte de contexto técnico, "FR-2 (hábitos dinâmicos)" o mandaria para o FR de IA — desvio silencioso. O próprio addendum não reconciliado é a prova de que o hazard de reciclagem de números já se materializou neste mesmo rito.

### Findings
- **high** Addendum referencia números antigos de FR que agora resolvem para outra feature (addendum linhas 16, 27, 41, 49, 60) — FR-2/FR-3.1/FR-3.4/FR-6/FR-1.11/FR-1.12 stale; sob a nova numeração apontam para features erradas. Desvio silencioso para [ARCH]. *Fix:* atualizar as refs do addendum via Anexo A (FR-2→FR-7, FR-3.1→FR-8.1, FR-3.4→FR-9.1, FR-6→FR-15, FR-1.11/1.12→FR-4.11/4.12).
- **low** Colisão de numeração é um risco vivo para todo doc a jusante (epics.md, decision logs, UX) que cite números antigos — o PRD reconhece e provê o Anexo A, mas convém um sweep. *Fix:* passar Anexo A no epics.md/UX antes do [CE], já que os números 1–6 mudaram de dono.

---

## 5. Ambiguidades / `[ASSUMPTION]` que travam a jusante — adequate

`[ASSUMPTION]` presentes e razoáveis, todos inline: UJ-7 (campos de saúde exemplares), FR-13.3 (definição de "conceitos" a confirmar na onda), FR-15.3 (sem espaço compartilhado no MVP), NFR-2 (`< 2s`). Nenhum é bloqueante — os que importam ("conceitos", granularidade da flag em FR-1.6, cidadania de custom em FR-14.8) estão explicitamente marcados como decisão de onda/story, que é a postura certa.

Ambiguidade que pode travar (já contada em §2): **FR-6.6** ("consistência de uso", "e outros"). Fora dela, as vaguezas restantes têm dono e prazo (onda/UX/[CE]).

Gap mecânico: **não há Índice de Assumptions** ao fim do PRD — os `[ASSUMPTION]` vivem só inline. Para um PRD chain-top, um índice ajuda o [CE] a fechar pendências sem varrer o documento. Baixo, mas vale.

### Findings
- **low** Sem Índice de Assumptions (§ fim do PRD) — 4 `[ASSUMPTION]` inline não coletados. *Fix:* apêndice com os 4 e seu dono/onda de resolução.

---

## Notas mecânicas

- **Continuidade de IDs:** contígua e única no corpo pós-renumeração; Anexo A roundtrip OK. O reaproveitamento dos números 1–6 para features novas é a fonte de risco (ver §4) — mitigado no corpo, não no addendum.
- **Glossário:** não há glossário formal, mas os nomes de domínio (collection, coded/custom, núcleo, cardápio, Modelo de Relatório, `contexto_ia`) são usados de forma consistente. Aceitável para o porte.
- **UX-DR16:** tratado com precisão — FR-6.1 revoga a cláusula de entrada, FR-6.2 preserva "captura a um toque". Sem contradição. UX-DR19/DR20 referenciados de forma coerente.
- **Sequência de Build (§7.1):** usa nomes de módulo, não números de FR — sem refs stale ali.
- **§7.2:** delega sequência ao proposal (autoridade única) e mantém o PRD nas capacidades — separação correta de responsabilidades.
