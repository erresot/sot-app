# PLANO — SOT APP

Situação em **23/11/2026 (v58)**. Prioridade combinada: **primeiro organizar o que já foi feito**, depois seguir com funções novas.

## 1. O que já está pronto

- **Enfermaria:** importação do internograma (Google Doc e PDF), lista de leitos com busca, modo compacto e prontuário; ficha com visita beira-leito por toques, fotos, pré-operatório, avaliação e notas; pendências; evoluções; agenda com dupla checagem e mapa cirúrgico; segurar alta; laudos por OCR; quem saiu do internograma (igual em todos os aparelhos); backup.
- **Sincronização:** Drive com tempo-limite e nova tentativa, envio em fila, mescla campo a campo, backup diário com retenção, armazenamento que passa para IndexedDB quando o aparelho enche.
- **Folha de visita impressa:** impressão A4 com todo o internograma de cada paciente + leitura da foto + tela de revisão (testada com fotos simuladas).
- **OrthoHub:** os 12 programas funcionando e em uso diário.
- **Escala única** (`sot-escala.js`) lida por Condutas, Retornos, Novo Paciente e Pós-Op; retorno fora do dia com alerta.
- **Interface:** tema único, ícones, tela larga lado a lado, atalhos de teclado.
- **Testes automatizados:** ~40 arquivos de teste.

## 2. Problemas encontrados

| # | Problema | Impacto |
|---|---|---|
| 1 | O código-fonte (`src/`, `build.py`, `tests/`) **não está no GitHub**: lá só existe o app gerado. Se esta área de trabalho se perder, a fonte se perde. | Alto |
| 2 | GitHub não está ligado a esta conversa: não é possível publicar nem testar a versão publicada direto no navegador. | Médio |
| 3 | Folha de visita: **sem teste real** (papel, caneta, câmera, luz do hospital). Os limites de leitura podem precisar de ajuste. | Médio |
| 4 | Duas conversas já geraram versões com o mesmo número (v53). | Médio (resolvido por regra; manter) |
| 5 | `hub/relatorio.html` não está na lista `RESTO` do `sw.js`: só funciona sem internet depois de aberto uma vez com internet. | Baixo |
| 6 | ~~Testes desatualizados `t_amb14.py` e `t_jose.py`~~ — movidos para `tests/legado/` (23/11/2026). | Resolvido |
| 7 | `ESTRUTURA.md` antigo (substituído pelo `SPEC.md`) ainda está no repositório. | Baixo |
| 8 | Anamnese, Exame Físico e Condutas não se comunicam (cada um gera o texto sozinho). | Planejado |
| 9 | ~~Importação pelo PDF misturava as colunas (nome junto com diagnóstico)~~ — corrigido na v57: as bordas das colunas são lidas do próprio PDF. | Resolvido |
| 10 | ~~Exemplo do `hub/mapa.html` com dados que pareciam reais~~ — trocado por exemplo fictício na v58. | Resolvido |

## 3. Próximas etapas sugeridas (em ordem)

**Fase A — organizar o que foi feito (prioridade atual)**
1. Revisar e aprovar `SPEC.md`, `CLAUDE.md`, `PLANO.md`, `CHANGELOG.md`; apagar `ESTRUTURA.md` do GitHub.
2. Guardar a fonte com segurança: decidir onde (pasta `fonte/` no próprio repositório, repositório privado separado, ou zip da fonte a cada versão).
3. Corrigir o pequeno: `relatorio.html` no `RESTO` do `sw.js`.
4. Revisão programa a programa do OrthoHub (um por etapa): conferir textos, padrões visuais e bugs relatados no uso diário; registrar no `CHANGELOG.md`.

**Fase B — validar no mundo real**
5. Teste real da folha de visita: imprimir, preencher à caneta, fotografar no hospital, ajustar a leitura.
6. Ligar o GitHub a esta conversa (se possível) para publicar e testar a versão online.

**Etapas combinadas em 23/11/2026 (nesta ordem, uma por vez)**
- ✅ v57: leitura do internograma mais tolerante (nome/idade/cidade com vírgula; data de internação solta; cabeçalho sem altas; PDF com as bordas reais das colunas).
- Respiratório (+ IOT) e hemodinâmica (estável sem DVA / em uso de DVA) na visita, na folha e na evolução.
- Faixa de tarefas no card (Visita · Evolução · **Prescrição** com um toque), contadores e filtros — protótipo aprovado.
- Exames de 48 h: data lida do internograma; alerta "pedir exames hoje / exames hoje / atrasados"; intervalo por paciente (48 h padrão).
- Paleta **A** (marinho do serviço) no app e no OrthoHub — protótipo aprovado.

**Fase C — funções novas**
7. Encadear Anamnese → Exame Físico → Condutas (o atendimento do PS num fluxo só).
8. Outras ideias que surgirem no uso: entram aqui antes de serem feitas.
