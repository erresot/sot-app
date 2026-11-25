# PLANO — SOT APP

Situação em **24/11/2026 (v68)**. Prioridade combinada: **primeiro organizar o que já foi feito**, depois seguir com funções novas.

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
| 1 | ~~Código-fonte só existia aqui~~ — a partir da v64 vai um `sot-fonte-vN.zip` a cada versão, guardado no Drive pelo usuário. Repositório privado: possível no futuro. | Resolvido |
| 2 | GitHub não está ligado a esta conversa: não é possível publicar nem testar a versão publicada direto no navegador. | Médio |
| 3 | ~~Folha de visita sem teste real~~ — testada pessoalmente (preenchimento e leitura ok), 24/11/2026. | Resolvido |
| 4 | Duas conversas já geraram versões com o mesmo número (v53). | Médio (resolvido por regra; manter) |
| 5 | ~~`hub/relatorio.html` fora da lista offline~~ — incluído na v64. | Resolvido |
| 6 | ~~Testes desatualizados `t_amb14.py` e `t_jose.py`~~ — movidos para `tests/legado/` (23/11/2026). | Resolvido |
| 7 | `ESTRUTURA.md` antigo (substituído pelo `SPEC.md`) ainda está no repositório. | Baixo |
| 8 | Anamnese, Exame Físico e Condutas não se comunicam (cada um gera o texto sozinho). | Planejado |
| 9 | ~~Importação pelo PDF misturava as colunas (nome junto com diagnóstico)~~ — corrigido na v57: as bordas das colunas são lidas do próprio PDF. | Resolvido |
| 10 | ~~Exemplo do `hub/mapa.html` com dados que pareciam reais~~ — trocado por exemplo fictício na v58. | Resolvido |
| 11 | Descrição Cirúrgica — SIGTAP: 35 sem código, 63 "a confirmar", 2 pares com o mesmo código. | Baixo — o serviço **não usa SIGTAP** até o momento |
| 12 | Descrição Cirúrgica — pontos clínicos a decidir: antibiótico "postergado" em revisões/periprotéticas sem infecção; cefazolina em cirurgia de mão sem implante; procedimentos sem incisão omitem antissepsia e time-out (halo); pseudartrose com tipoia como padrão; lateralidade obrigatória na coluna; kit C1-C2 como "parafuso pedicular". | Médio — aguardar decisões futuras |
| 13 | ~~Descrição Cirúrgica — rascunhos da versão anterior~~ — rascunhos são trabalhados fora do app oficial e integrados depois. | Resolvido por regra |
| 14 | ~~Descrição Cirúrgica — correções feitas só no app~~ — o app é o oficial; o artefato é rascunho. Ao trazer novidades de rascunhos, integrar sem desfazer as correções daqui. | Resolvido por regra |

## 3. Próximas etapas sugeridas (em ordem)

**Fase A — organizar o que foi feito (prioridade atual)**
1. Revisar e aprovar `SPEC.md`, `CLAUDE.md`, `PLANO.md`, `CHANGELOG.md`; apagar `ESTRUTURA.md` do GitHub.
2. ~~Guardar a fonte~~ — zip da fonte a cada versão (v64).
3. ~~`relatorio.html` offline~~ — feito (v64).
4. Revisão programa a programa do OrthoHub — **aguardar** (virão novos projetos).

**Fase B — validar no mundo real**
5. ~~Teste real da folha de visita~~ — feito pessoalmente, leitura ok.
6. Ligar o GitHub a esta conversa (se possível) para publicar e testar a versão online.

**Etapas combinadas em 23/11/2026 (nesta ordem, uma por vez)**
- ✅ v57: leitura do internograma mais tolerante (nome/idade/cidade com vírgula; data de internação solta; cabeçalho sem altas; PDF com as bordas reais das colunas).
- ✅ v59: Respiratório (+ IOT) e hemodinâmica (estável sem DVA / em uso de DVA) na visita, na folha e na evolução.
- ✅ v63: Faixa de tarefas no card (Visita · Evolução · **Prescrição** com um toque), contadores, filtros e V E P no compacto.
- Exames: data do último exame lida do internograma; "pedir hoje na rotina / na urgência / atrasado"; intervalo por paciente (24 h, 48 h padrão, 72 h, semanal, **sem exames de rotina**). Em discussão: horário de corte, pacotes (rotina e pré-op), regras fixas, valores que pedem urgência.
- ✅ v59: Paleta **A** (marinho do serviço) no app e no OrthoHub.
- ✅ v60: Descrição Cirúrgica nova (artefato, 142 procedimentos) integrada e revisada — pendências 11 a 14.
- ✅ v62: leitura do pós-operatório no internograma (PO sem ano/sem data, "Pot" antigo, pré-op depois de operado).
- **Aprovado (próxima etapa):** usar a programação pós-op escrita no Orienta — "COBRAR RX POI" vira pendência, "ALTA N PO" vira aviso no dia, "SEM CARGA"/"ATB N dias" na ficha.

**Fase C — funções novas**
7. Encadear Anamnese → Exame Físico → Condutas — **aguardar** decisões futuras.
8. Outras ideias que surgirem no uso: entram aqui antes de serem feitas.
- ✅ v66 (parcial): **Regra de exames:** rotina = pedido hoje, colhido amanhã às 6h; urgência = colhido hoje. No internograma, "dd/mm: labs" = resultado; "dd/mm Solicitar" = deve ser pedido na rotina do dia anterior. App: na véspera, "pedir hoje na rotina"; no dia sem resultado, "atrasado: pedir na urgência?". Contadores pela data: conferir e avisar (quem atualiza é humano).
- ✅ v66: **Motor único de contadores pela data:** PO, POI→1 PO, dias de fratura/queda/déficit, DIH calculados para uma data-alvo. Usado em 3 lugares: (1) conferência do internograma de hoje (avisa quando o número escrito à mão está errado); (2) **mapa cirúrgico e linha de dados: o texto já sai com o número do dia da cirurgia** (ex.: mapa de 25/11 → "16 Po", "26 D Fx"), na tela, na impressão e no "Copiar"; some a etiqueta separada "· Nº PO"; (3) cards da Agenda. Com data → conta pela data; sem data → soma os dias entre o internograma e a data-alvo e marca "?" para conferir.
- ✅ v65: **Pós-op → pendências** — "alta dia X" e "alta quando sair da UTI"; marcador de transferência (leito/seção mudou de UTI para enfermaria) = pronto para alta e para passar à seção ALTAS.
- **Leitura do internograma (a fazer, aprovar):** (a) data de internação grudada no chip do Google Docs ("24/11/2026 📄 Arquivo") não é reconhecida; (b) ficha abreviada ("NOME · idade · COLO · SEXTA") juntada com o paciente de cima no PDF; (c) nome, idade e cidade emendados em maiúsculas na seção Altas, no PDF.
- ✅ v68: Atualizador cria **cópia atualizada** (só números, pintados) e **compara lado a lado**. "Aplicar no oficial": a conta do app só lê o internograma (não tem edição) — só se um dia ganhar permissão; decisão do usuário.
- ✅ v67: **Atualizador de Internograma (protótipo)** no OrthoHub — testar no uso real. Próximos passos a decidir: aplicar as correções direto no Doc (Apps Script ou app), memória do app para contadores sem data, PDF: separar fichas juntadas, aviso de PDF sem texto.
- **Atualização da manhã (ideia):** texto corrigido dos contadores pela data (simulação de 24→25/11 achou 3 contadores já errados), conferência de leitos, avisos de "alta no N PO" vencida e de pacientes da seção Altas.
9. Fotos de programação POI para treinar as Condutas Pós-Operatórias — **futuro** (o usuário reenvia).
10. ~~Tirar dados reais dos testes antigos~~ — feito na v64; fotos reais do teste de OCR ficam só no ambiente de trabalho (decisão do usuário).
