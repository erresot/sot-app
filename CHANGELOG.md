# CHANGELOG — SOT APP

## v64 (atual) — Relatório sem internet · fonte guardada · testes sem dados reais
- **Relatório (OrthoHub):** passa a ser guardado no celular em segundo plano, como os outros programas; abre sem internet desde a primeira vez (custo: ~870 KB baixados uma vez a cada versão).
- **Cópia da fonte:** junto com o app vai `sot-fonte-v64.zip` (código, testes, geração) para guardar no Drive.
- **Testes sem dados reais:** o internograma de 11/11 usado nos testes e os nomes/registros dos testes de identificação, agenda e mapa foram trocados por fictícios. Os testes de leitura de fotos reais continuam só no ambiente de trabalho (decisão do usuário).

## v63 — faixa de tarefas no card — faixa de tarefas no card
- Cada paciente da aba Leitos ganha a faixa **Visita · Evolução · Prescrição**: um toque marca, outro desmarca (vale para o dia; sincroniza entre aparelhos).
- **Evolução:** marcada sozinha quando a evolução é feita no app; pode ser marcada à mão quando o paciente foi evoluído direto no sistema do hospital. Na aba Evoluções, os marcados à mão aparecem em "Marcados como evoluídos (fora do app)" e saem de "falta evoluir".
- **Contadores e filtros** na aba Leitos: visitados / evoluídos / prescritos; "Falta visitar", "Falta evoluir", "Falta prescrever". O topo do app passa a mostrar também os prescritos.
- **Modo compacto:** quadradinhos V E P no lugar de "✓" e "E".
- A etiqueta "evoluído ✓" sai do card (a faixa já mostra).
- Teste novo `t_tarefas63.py` (dados fictícios).

## v62 — leitura do pós-operatório no internograma — leitura do pós-operatório no internograma
- **PO lido em mais formatos:** data sem ano — "1 PO … (23/11)" ou "… 21/11" no fim da linha —, "25d Po", "3 DPO", parêntese não fechado. "1/3 distal" no meio do texto não vira data. Cada linha da Causa é lida separadamente. No internograma de 24/11, 4 dos 15 operados ficavam sem PO; agora todos são lidos.
- **PO sem data** ("6 Po Revisão De Atq"): usa o número escrito e mostra aviso na conferência pedindo a data da cirurgia.
- **"Operado" só nesta internação:** "Pot" com data anterior à internação (ex.: cirurgia de 2021) não marca mais o paciente como pós-operatório (ferida operatória e dreno na visita e na folha).
- **Pré-op não continua depois de operado:** se o internograma já mostra POI/PO da cirurgia marcada, sai o alerta vermelho "CX HOJE: checar jejum e heparina" e a proposta cirúrgica (Hb > 10); a ficha mostra "✓ Operado" e avisa que o bloco de pré-op ainda está escrito.
- Teste novo `t_po62.py` (dados fictícios).

## v61 — tela de bloqueio na paleta do serviço — tela de bloqueio na paleta do serviço
- A tela da senha (abertura do app) passa para a paleta A: fundo azul-marinho, botão Entrar azul. Funcionamento da senha inalterado (testado: senha errada continua bloqueando).

## v60 — Descrição Cirúrgica nova (do artefato)
- `hub/desccir.html` substituído pela versão atualizada no artefato "Descrição Cirúrgica": **142 procedimentos** (eram 61; 81 novos, nenhum removido), vários procedimentos na mesma cirurgia, OPME com catálogo, material para exame, explante, estado neurovascular, controle de danos e verificação de coerência.
- Ajustes na integração: "tornozelo tornozelo" (tenorrafia do pé) corrigido; botões **Baixar .txt** e **Imprimir** continuam aparecendo dentro do app (o artefato os esconde em qualquer moldura).
- Rascunhos: a versão nova usa outra chave de armazenamento (`orthohub_descricao_v3`); os rascunhos da versão anterior ficam no aparelho, mas não aparecem na nova.
- Teste novo `t_desccir60.py`.
- Regra registrada: o SOT APP daqui é o oficial; artefatos e outras conversas são rascunho e teste (SPEC 1.1, CLAUDE.md).

## v59 — respiração e hemodinâmica na visita · paleta do serviço
- **Visita:** Respiratório ganha **IOT / ventilação mecânica**; campo novo **Hemodinâmica** (estável, sem DVA · em uso de DVA, com espaço para droga/dose). Os dois entram nos alertas da visita e no resumo.
- **Folha de visita impressa:** grupos "Respir." (ar amb. · O2 · IOT · dispneia) e "Hemodin." (estável s/ DVA · com DVA); a leitura da foto grava na visita.
- **Evolução:** "em IOT"; "hemodinamicamente estável sem drogas vasoativas"; "em uso de DVA (droga)" — troca a frase da evolução anterior ou acrescenta quando não existe.
- **Paleta A (tons do serviço):** cabeçalho azul-marinho #13365C, ações em azul #1F6FCE, destaques em ciano, fundo #EDF1F6; Evolução em ciano; verde/laranja/vermelho mantêm o significado. Modo escuro correspondente. Todos os programas do OrthoHub passam para o mesmo azul (claro e escuro). Barra do celular em marinho.
- **Leitura da folha — bolinhas (EVA e força):** um pingo de caneta no centro podia valer como marca. Agora a bolinha só conta quando há tinta também na "coroa" (X, ✓ e rabisco passam por ela; o pingo não); senão vira dúvida para confirmar. Testado com 7 sorteios de fotos simuladas, inclusive um caso que falhava antes.
- Teste novo `t_resp59.py`.

## v58 — exemplo do Mapa Cirúrgico fictício
- O exemplo embutido no `hub/mapa.html` (aparece fora do app ou em "Restaurar exemplo") tinha dados que pareciam de pacientes reais. Trocado por 10 pacientes fictícios no mesmo formato (nomes, prontuários, leitos e detalhes clínicos identificáveis alterados).
- Prontuário de exemplo num comentário do `amb/amb.js` trocado por número fictício.
- Nenhuma mudança de funcionamento.

## v57 — leitura do internograma mais tolerante a formatação
- **"Nome, 77A, Cidade"** na mesma célula (também "Nome, 35, Cidade" e com quebra de linha depois da vírgula): nome, idade e origem separados. Antes aparecia "Sem idade" + "Nome incompleto ou com números".
- **Data de internação solta** na 1ª coluna ("22/11/26", "21/11"): passa a valer como data de internação **só quando bate com o "Dih N" escrito** (±1 dia). Se não bater, nada muda.
- **Só "Dih N", sem data:** o card mostra o DIH escrito (andando com a data do internograma) e o aviso vira "Data de internação não escrita no internograma (só DIH N)".
- Formato padrão ("Dih dd/mm/aaaa", idade em linha própria): sem mudança. Teste novo `t_ig57`.
- **PDF:** bordas das colunas lidas das linhas da própria tabela no PDF (antes: posições fixas de um modelo antigo — com a largura das colunas mudada, a Causa caía dentro do Nome). Sem as 7 bordas, usa as posições antigas.
- **Cabeçalho** aceito também **sem** "/ N Altas" (antes a data do internograma e a contagem se perdiam). Sem altas no cabeçalho, a conferência compara HC/IC/Hm com os lidos que não são alta.
- Mais formatos de nome: "Nome 52a , Cidade", "Nome , 37 A", "DIH:" vazio; no PDF, "Nome, 35, Cidade, Dih 2, registro" numa linha só. Data "05/11 (Pnm)" aceita (conferida com o DIH).
- Conferido com o internograma real de 23/11/2026 (só aqui, fora dos testes): no PDF, nome, idade e registro dos 26 pacientes batem com o Doc.
- Testes com dados **fictícios**: `t_ig57` (anonimizado) e `t_leitura56` (PDF gerado por `tests/fixtures/gera_ig56.py`).


## v56 — documentação criada
- Criados `SPEC.md` (especificação técnica do app inteiro, substitui o `ESTRUTURA.md`), `CLAUDE.md` (regras de trabalho), `PLANO.md` (situação e próximas etapas) e este `CHANGELOG.md`.
- Nenhuma mudança de código nesta etapa.
- Testes antigos `t_amb14` e `t_jose` (só exibiam resultados, sem conferir) movidos para `tests/legado/`: a bateria inteira passa sem exceções.

---

## Histórico anterior (resumo, reconstruído a partir do código e das entregas)

- **v56** — Proteção caso `sot-escala.js` não carregue (Retornos e Pós-Op avisam na tela); teste de casos de borda (`t_checagem55`).
- **v55** — Escala única `sot-escala.js` (uma linha por pessoa, `id` fixo; Equipe Mão e Equipe Tumor; sem Equipe Coluna; Gustavo Reinas coluna e trauma). Retornos, Novo Paciente e Pós-Op passam a ler dela. Retornos: assistente de outro dia com alerta. Condutas (PS) novo integrado.
- **v54** — Prontuário ao lado do nome nas listas (toque copia). Nomes completos dos assistentes. Condutas Pós-Operatórias atualizadas (23/11/2026).
- **v52–v53** — Folha de visita impressa: impressão A4 com o internograma de cada paciente, leitura da foto, revisão e gravação na visita. Novos campos da visita: amplitude de movimento e esfíncteres.
- **v51** — Nova camada visual (IBM Plex, ícones SVG), busca e modo compacto por aba, tela larga lado a lado, atalhos de teclado, avisos recolhíveis, aba "Internograma" renomeada para "Ajustes". Armazenamento em IndexedDB quando o aparelho enche. Retenção de backups. "Quem saiu do internograma" igual em todos os aparelhos.
- **v49–v50** — Sincronização mais rápida e tolerante (tempo-limite, novas tentativas, envio em paralelo, fila de fotos); correção do "Sair" que não terminava; limpeza do Drive.
- **Até v48** — Construção do app: internograma, visita, pendências, evoluções, agenda, mapa cirúrgico, AMB Internação, OrthoHub e motores compartilhados.
