# CHANGELOG — SOT APP

## v79 (atual) — Anamnese: avaliação direta
- Avaliação direta = paciente no PS da ortopedia: não exige mais a sala (saiu o aviso "falta o local do chamado") e, sem sala, o texto abre com "Avalio paciente no PS Ortopedia." (regra do usuário, 26/11/2026).
- Sala Amarela passa a levar para interconsulta, como a Vermelha; dá para voltar para avaliação direta ("Avalio paciente a pedido da equipe da Sala Amarela.").
- Teste novo `t_anam79`.

## v78 — Internação pelo dia da cirurgia; exame sem ambiguidade
- **Condutas · internação** (regras do serviço, 26/11/2026):
  - campo **Cirurgia** (nome) + Urgência + Data: "PROCEDIMENTO CIRÚRGICO (X) EM dd/mm/aaaa", "PROCEDIMENTO CIRÚRGICO DE URGÊNCIA (X)" (hoje) ou "… DE URGÊNCIA (X) EM dd/mm/aaaa"; sem nome = lacuna e "Falta preencher";
  - **hoje**: MANTER JEJUM + ANTICOAGULAÇÃO PROFILÁTICA SUSPENSA (CIRURGIA HOJE); **amanhã**: JEJUM A PARTIR DAS 23H + … SUSPENSA (CIRURGIA AMANHÃ); **depois de amanhã ou mais**: … HOJE; SUSPENDER EM <véspera> (VÉSPERA DA CIRURGIA); sem data: como antes;
  - **pré-operatórios**: Solicitar / Já pedidos (CHECAR) / Já saíram — só em "Já saíram" abre a caixa de laboratoriais, que sai na conduta como "LABS dd/mm/aaaa: …" (o mesmo texto da caixa do resultado; não repete no resultado);
  - **RCH** marcado só quando opera hoje ou amanhã (bolsa vence); **avaliação cardiológica, avaliação anestésica e UTI** como sugestões desmarcadas;
  - **"MANTER … ATÉ SEGUNDA ORDEM" só com imobilização escolhida** (antes escrevia "TALA" sem tala).
- **Condutas · laboratoriais:** sempre o motor de exames pela entrada única (`ler`), igual à evolução e ao mapa — antes, linha escrita ("HB … / LEUCO …") perdia exames e só sobrava o último. No resultado, botão **+ Laboratoriais** (a caixa só aparece quando há exames, com ×). Formato em todo lugar: **"LABS dd/mm/aaaa: …"** (sem data no texto colado: "LABS ___: …").
- **Exame físico:** "ADM reduzida" + "Dor à mobilização" = "Redução da amplitude de movimento por dor"; encurtamento e rotação externa (quadril × coxa): marcado num segmento sai do outro (vale o último toque); "TEC < 3 s" com s minúsculo no CAIXA ALTA.
- Teste novo `t_cir77`.

## v77 — Anamnese, Exame Físico e Condutas novos (feitos em conversas à parte, revisados e integrados)
- **Anamnese** (`hub/anamnese.html`, versão "v76" da conversa da anamnese): nada vem marcado; itens do modelo aparecem como SUGERIDO e só entram no texto quando tocados; "Perguntei: nega os não marcados"; modo Enfermaria (evolução curta); avisos com "ir ao campo"; datas sempre com ano e nunca no futuro. Detalhes: `anamnese-v76-orientacoes.md` (no pacote da conversa).
- **Novo Paciente** (`hub/novopac.html`), para ler o texto da Anamnese nova: "QUEDA DE ALTURA (APROXIMADAMENTE N M)", acidente motociclístico, arma branca, mordedura, trauma esportivo; "nega fratura" não vira diagnóstico; da Anamnese só sai diagnóstico de linha HD; alergia só quando o texto fala de alergia.
- **Exame Físico** (`hub/exame.html`): "Tudo normal" honesto com sinal de fratura; ADM sem graus; motor de coerência (vale o último toque); faixas Atenção/Confira (fora do texto); campo Idade (Ortolani/Barlow < 1 ano, Galeazzi < 18); dor à palpação numa frase só; sela = S2–S5. **Não guarda mais o exame** entre aberturas: a chave `exorto3` é apagada ao abrir (tira dado de paciente do aparelho). Mudanças de texto listadas nas notas da conversa (testes funcionais, sem graus, concordâncias, ponto final).
- **Condutas** (`hub/condutas.html` + página nova `hub/condutas-guia.html` "Como usar"): imobilização e opções por região; exames (RX com achado + lado; TC/USG/RM com local, data e laudo); exposta com marcador próprio e antibiótico uma vez só; desfechos Alta / Retorno / Internação / Internação por outra equipe; intermediário (interconsulta, reavaliação seriada, CROSS, origem, UBS); "Cuidados de coluna"; assinatura só no em tempo final com "DISCUTIDO COM DR X EM data"; avisos "Confira" que não bloqueiam. Guarda só `cd_plantao`, no mesmo formato (nada a converter).
- `sw.js`: `hub/condutas-guia.html` na lista RESTO.
- Testes: `t_hub77` (os 4 programas abrem no app, celular e computador, geram texto, sem erro; `exorto3` apagado). Conferidos também com os testes das conversas: Condutas 70 verificações, 0 falhas; Exame, cada botão sozinho (2.953), 0 violação.

## v76 — Contagem do cabeçalho na regra do serviço
- Regra (definida pelo usuário, 25/11/2026): **HC** = pacientes da ortopedia no HC; **IC** = interconsultas (outra prestadora), à parte; **Hm** = todos do Materno Infantil, **RN conta**. Cabeçalho **sem** "N Altas" → as altas entram no HC; **com** "N Altas" → o HC fica sem elas.
- A contagem passou para o motor (`SOTCONT.contarIG`) e é a mesma no Atualizador e na conferência da enfermaria. Mesmo registro em 2 linhas (ala + ALTAS) conta 1 paciente.
- Antes: as duas tiravam as altas do HC num cabeçalho sem "N Altas" (no Doc de 25/11 escreveriam 16 HC em vez de 19), e o Atualizador contava 2 vezes quem estava na ala e em ALTAS.
- Paciente manual (PS, CC) continua entrando na contagem, como antes.
- Teste novo `t_cont76`; `t_leitura56` atualizado para a regra.
- **Testes mais rápidos** (só a bateria de testes; o app não muda): a espera fixa (`wait_for_timeout`) termina assim que a página sossega (sem fetch, sem timer curto pendente, tela parada há 200 ms), no máximo o tempo pedido — `SOT_ESPERA_FIXA=1` volta ao modo antigo; os testes mais longos começam primeiro (`tests/.tempos.json`); limite por teste 300 s. `t_sw` e `t_checagem55` (mexem em `dist/`) rodam sozinhos no fim — antes derrubavam testes vizinhos com 404; `t_sinc2` e `t_ocr` deixaram de depender do relógio da máquina; depois de escolher arquivo (PDF/foto) a espera continua inteira. Bateria completa: 445 s → 345 s. O resto é processador (2 núcleos) e o teste de OCR (~100 s).

## v75 — Siglas de cirurgia na conferência da Agenda
- A conferência Agenda × internograma reconhece as siglas e terminações do serviço: **ATQ/ATJ/ATO, PTQ/PTJ, PPQ, RMS, manipulação, biópsia, -ectomia (discectomia…), -plastia, -otomia, reconstrução de LCA**. Antes, "ATQ A DIREITA EM 25/11", "RMS DE PTQ…", "MANIPULAÇÃO DE OMBRO…" e "DISCECTOMIA L5-S1 EM 27/11" davam alarme falso ("cirurgia não está escrita no internograma").
- Conferido no internograma real (só leitura): mudaram exatamente esses 4 alarmes falsos para "confere"; nenhuma outra conferência mudou.

## v74 — Data de internação solta, seção CC, copiar linhas dos ambulatoriais, aviso da Agenda — Data de internação solta na 1ª coluna
- Sem "Dih dd/mm" e sem "Dih N" escritos, a **data sozinha da 1ª coluna é a data de internação** (formato do serviço; ex.: "Sala Amarela / Qpa 17/11 / 24/11 / 1150"). A conferência pede para confirmar ("DIH pela data solta…").
- **Data do trauma** separada da de internação: "Qpa 17/11" e "Em 04/11/2026" = trauma; com "DI 23/10" escrito, a data sozinha (22/10) é a do trauma. A ficha deixa de mostrar a data de internação como data do mecanismo.
- Nos PDFs reais de 15–23/11 isso não ocorre (todos tinham "Dih N"); no Doc de 24/11 afeta só o 1150.
- **Seção CC:** quem está abaixo da faixa CC fica no grupo CC (mesmo com local "UTI?"); linha colada pelo gerador (1ª linha "Dih dd/mm/aaaa", local em branco) é lida certo (DIH 0); "DIH" numa linha e a data na de baixo = internação; marcadores "*VAI OPERAR*", "*AMB INTERNAÇÃO*" reconhecidos.
- **Agenda → "📋 Copiar as N linhas dos ambulatoriais":** um botão no dia copia as linhas de todos os ambulatoriais do dia (uma tabela com N linhas, na ordem do horário) para colar de uma vez no internograma. Cada linha é a mesma do "Copiar linha" (texto não mudou).
- **Aviso da Agenda mais claro:** "não está no internograma" (parecia que o paciente tinha sumido) virou "**cirurgia não está escrita no internograma**"; data diferente mostra a data do internograma ("internograma: 24/11 · 27/11 se não possível").
- "**SE N POSSÍVEL, SEXTA 27/11**" logo abaixo de uma cirurgia = data alternativa dessa cirurgia. A conferência da Agenda considera também datas de até 3 dias atrás ("limpeza em 24/11" agendada para 25/11 = data diferente). Pendências não mudam.
- Testes novos `t_dih74.py`, `t_ambcopia74.py`, `t_agenda74.py`.

## v73 — Leitura do internograma: cabeçalho, formatos, defesas e conferência única — Leitura do internograma: cabeçalho, formatos, defesas e conferência única
- **"Dih N" no motor comum** (`SOTCONT.lerDih/escreverDih`): leitor do Doc, do PDF e Atualizador usam a mesma regra ("Dih 12", "Di: 8", "DIH:1", "dih1").
- **Cabeçalho tolerante** (`SOTCONT.cabecalho`): data sem uma barra ("1711/2026" → 17/11/2026, com aviso; só aceita se houver UMA leitura perto de hoje), ponto/hífen, "20hc"/"HC", "Alta"/"Altas", sem a parte das altas, caracteres invisíveis. No Atualizador, troca só a data e os números. A conferência avisa quando o cabeçalho está com data de ontem ("ainda não atualizado hoje?").
- **PDF em branco** (salvo como imagem, ex.: "Microsoft Print to PDF"): aviso claro, nada é trocado, e o caminho certo (Google Doc / baixar PDF pelo Docs).
- **Formatos de identificação** (`lerIdent`, uma regra só para o Doc e o PDF): nome em várias linhas, vírgulas ("Castro, 35,"), idade grudada ("Mira 51 Anos"), tudo numa linha em maiúsculas ("… 45 ANOS MARÍLIA", "… 8A POMPEIA"), "·", cidade depois do Dih/registro, cidade em 2 linhas ("Campos Novos / Paulista"). Corrige: cidade cortada no PDF ("Marili"), classificação lida como cidade ("Rádio").
- **Ficha abreviada** "NOME / registro / leito" (coluna do nome): registro e leito reconhecidos (avisa "leito escrito na coluna do nome").
- **Defesas contra mistura de pacientes:** (1) PDF: as **bordas horizontais** da tabela separam as fichas (sublinhado curto não conta); (2) **assinatura de mistura** (2 registros / 2 "Dih" / 2 datas de internação / 2 leitos na mesma ficha) → **avisa, nunca separa no chute**; (3) ficha com poucos dados → avisa (nunca descarta: pode ser paciente real).
- **Conferência única** (`conferenciaIG`): cabeçalho e contagem, fichas para conferir, paciente em mais de um lugar, contadores, DIH e dados faltando — a mesma lista na faixa da tela de leitos, em Ajustes e no Atualizador (no Atualizador, na data do próprio Doc).
- **Validação local nos PDFs reais de 15–23/11 (fora do repositório):** 193 → 194 fichas (a ficha abreviada de 22/11 separada pela borda), nenhuma perdida; cabeçalho de 17/11 passou a ser lido; ficha mista de 20/11 avisada; 13 cidades corrigidas; demais campos idênticos.
- Teste novo `t_v73.py` (16 conferências, PDF fictício gerado por `fixtures/gera_ig73.py`).

## v72 — Leitura por bloco (motor comum: enfermaria, Atualizador, Agenda, mapa) — Leitura por bloco (motor comum: enfermaria, Atualizador, Agenda, mapa)
- **O contador sem data procura a data no seu bloco**: as linhas de baixo até linha vazia, "-", outro contador, rótulo (Ap:, Muc:, Ass…) ou "Pot/Po/Pós-op" (outro item). Ex.: "25 D Fx Acetábulo… / Fx Púbico… 30/10/2026", "33 D Fratura Luxação Cervical / … / Acidente Automobilístico 22/10/2026", lista longa de fraturas terminando em "Queda… (24/09)".
- O bloco é uma coisa só: a data do bloco vale como a da própria linha (trava ±10) e o app **avisa quando o número escrito está atrasado** ("escrito 19, pela data seria 20").
- **PO nunca pega a data de trauma/fratura** (a data da cirurgia é outra).
- **"N d" sem data no bloco usa a data do trauma da 1ª coluna**, com trava estrita: ±1 se a data está na linha do trauma; **exata** se a data está sozinha na linha de baixo (pode ser a de internação). A data de internação ("Dih/DI…") nunca entra.
- "Pó" (com acento) é PO; "Qda"/"Qpa" contam como trauma.
- Conferência da enfermaria e Agenda usam a mesma leitura; o rótulo da data de internação passou a morar no motor (um lugar só). O Atualizador não tem mais peça própria de juntar linhas.
- **Validação local nos internogramas reais de 16–23/11 (fora do repositório):** contadores pela data 178 → 235 de 258, nenhum perdido; 3 casos em que a equipe corrigiu no dia seguinte exatamente para a data do bloco. No Doc de 24/11: 28 → 31 de 33.
- Testes novos: `t_bloco72.py` (31 casos), `t_atualizador72.py` (sistema).

## v71 — Leitura refinada (vale para a enfermaria e o Atualizador) — Leitura refinada (vale para a enfermaria e o Atualizador)
- **Data de internação com qualquer rótulo:** "DI 23/10", "Di", "D.I.", "Data de internação:", "Internação", "Internou em" (antes só "Dih dd/mm"). Ex.: leito com "DI 23/10" passa a contar o DIH pela data.
- **Data no fim de linha longa:** "34 Po Rms … Quadril Esquerdo (21/10/2026)" agora conta pela data (antes só olhava 90 caracteres). A trava de ±10 dias continua.
- **Atualizador:** avisa quando há uma data solta na 1ª coluna que não bate com o "Dih N" escrito ("essa data é a da internação?").
- Teste novo `t_leitura71.py`.

## v70 — Atualizador: paciente repetido · seção visível — Atualizador: paciente repetido · seção sempre visível
- **Mesmo paciente em 2 lugares** (ex.: na ala e em ALTAS, mesmo registro): os números são trocados em **todas** as linhas dele (nunca a mesma troca duas vezes) e aparece o aviso em "Para você resolver" com as seções. Ala + ALTAS é o normal até a alta ser certa (aí sai da ala). **O Atualizador não tira nem move pacientes: só atualiza números.**
- Cada paciente aparece como **leito · seção · nome** (a seção vem do leitor do app).
- Mensagem de erro corrigida: o ensaio não dizia mais "a cópia foi criada" quando nenhuma cópia foi criada.
- CLAUDE.md: regra fixa para conferir o internograma real (só pelo leitor do app, duas vias, dizer a fonte).
- Teste novo `t_atualizador70.py`.

## v69 — Atualizador lê o Doc direto · compara os dois documentos de verdade — Atualizador lê o Doc direto · compara os dois documentos de verdade
- **Lê o internograma direto do Google Doc** na hora (o mesmo leitor do app), em vez do importado no app — o que ele calcula e o que ele troca vêm do mesmo lugar. Sem internet/sem login: usa o importado e avisa.
- **Comparar lado a lado de verdade:** lê o original e a cópia no Google e mostra, trecho por trecho, o que mudou (só o que mudou / tudo). Avisa em vermelho se mudou algo que não é número. Dica do "Ferramentas → Comparar documentos" do Google Docs.
- **Cabeçalho:** troca só a data e os números; a escrita fica como está ("20hc", "2 Alta").
- **De onde partir:** sugere "em dia até" pela data do cabeçalho do Doc (você confirma ou troca).
- **🔎 Ensaio:** confere no Doc quantas trocas entrariam e quais ficariam à mão — sem criar nem mudar nada.
- Acha os textos mesmo com espaços duplos / Shift+Enter no Doc; só troca quando o texto aparece uma única vez na célula.
- Testes: `t_atualizador69.py` (novo); Docs simulado agora aplica as trocas na cópia.

## v68 — Atualizador: cópia atualizada no Drive · comparar lado a lado — Atualizador: cópia atualizada no Drive · comparar lado a lado
- **📄 Criar cópia atualizada no Drive:** o Atualizador faz uma cópia idêntica do internograma (Drive da conta do app) e troca **só os números** na cópia, pintando cada troca (amarelo = pela data · laranja = confira). Mostra o link e o que não achou ("troque à mão"). O app nunca altera o internograma que ele lê (trava no código).
- **↔ Comparar lado a lado:** para cada paciente, original (número antigo riscado) × atualizado (número novo marcado), com links para abrir o original e a cópia.
- Pode precisar ligar a "Google Docs API" no projeto do Google do app (configuração única) — o app avisa se for o caso.
- Teste novo `t_copia68.py` (Google Docs simulado, dados fictícios).

## v67 — Atualizador de Internograma (protótipo) · correções da v66 — Atualizador de Internograma (protótipo) · correções da v66
- **Novo no OrthoHub: Atualizador de Internograma (protótipo).** Lê o internograma já importado no app e mostra, paciente por paciente, **só os números** que mudam hoje (DIH, dias de fratura/queda/déficit, PO, POI → 1 PO) — pela data quando existe; sem data, "+1 dia" marcado para conferir —, o **cabeçalho já contado** e uma lista "para você resolver" (seção Altas, alta prevista hoje, chip "Arquivo" esquecido, exames do dia). Botões "Copiar" e "feito". Não altera o Google Docs.
- **Contadores (correção da v66):** a data só vale se estiver logo depois do contador e der um número plausível (acabou o "672º PO" vindo da linha vizinha no PDF); aceita "12-11-2026".
- **Exames (correção da v66):** a data é o **dia da coleta** — "25/11: solicitado" = colhe 25/11. "Solicitado" sem data vira só informação (urgência hoje ou rotina amanhã?).
- Convenção oficial registrada no SPEC: dia do evento = 0 (DIH 0, 0d, POI).
- Testes novos `t_atualizador67.py`; `t_cont66.py` atualizado.

## v66 — contadores pela data · pedido de exames
- **Motor único de contadores** (`sot-contadores.js`): "N PO", "POI", "N d" (fratura, queda, déficit) calculados pela data da própria linha; sem data, soma os dias e marca para conferir.
- **Conferência do internograma:** novo aviso quando o número escrito à mão não bate com a data (ex.: "51d queda … 27/09" → pela data são 58 dias). No internograma real de 24/11 achou exatamente os contadores errados.
- **Mapa cirúrgico e linha de dados:** Dx e cirurgias prévias já saem com o número do **dia da cirurgia** (mapa de 25/11: "15 Po … (09/11)" → "16 Po"; "POI" → "1 PO"; "25 D Fx" sem data → "26 D Fx" com "?" para conferir). A etiqueta "· N d / · Nº PO" só aparece quando o texto não tem contador próprio (ex.: ambulatoriais) — nunca dois números.
- **Agenda:** painel "Dados do internograma" mostra os contadores e o DIH no dia da cirurgia.
- **Exames** (rotina = colhe amanhã às 6h; urgência = hoje): "26/11 Solicitar" → no dia 25, pendência "Pedir exames na rotina hoje (colhe 26/11 às 6h)"; no dia 26 sem resultado → aviso. "Solicitado 23/11" sem resultado de 24/11 → aviso "resultado não lançado". Ficha mostra o último exame. Sem regra geral de 48 h por enquanto (fica para o Painel da manhã).
- Teste novo `t_cont66.py` (dados fictícios).

## v65 — programação pós-operatória
- O app lê a programação escrita no Orienta/Condutas de quem tem cirurgia contável (POI / N PO).
- **Vira pendência só o que é tarefa:** "Alta prevista hoje" (quando "alta no N PO" ou "alta dia dd/mm" cai hoje) e, quando a programação diz "alta ao sair da UTI" e o paciente saiu da UTI, "Saiu da UTI: alta pela programação — passar para ALTAS". "Cobrar RX POI" continua como antes (regra geral).
- **Só informação na ficha** (bloco "📋 Programação pós-op"): carga, antibiótico, anticoagulante (com "até ~dd/mm" quando há "N dias"), imobilização, retorno, curativo. Frases de discussão não entram.
- **Alta que passou do dia:** sem alerta; etiqueta cinza "alta prevista passou?" e, na ficha, "a programação ainda vale?" com o botão **não vale mais** (some para aquele paciente, em todos os aparelhos).
- **Saiu da UTI:** etiqueta "↪ saiu da UTI" no card por 3 dias (até o paciente ir para a seção ALTAS), com de onde → para onde na ficha.
- Teste novo `t_posop65.py` (dados fictícios); conferido também no internograma real de 24/11 (só leitura).

## v64 — Relatório sem internet · fonte guardada · testes sem dados reais
- **Relatório (OrthoHub):** passa a ser guardado no celular em segundo plano, como os outros programas; abre sem internet desde a primeira vez (custo: ~870 KB baixados uma vez a cada versão).
- **Cópia da fonte:** junto com o app vai `sot-fonte-v64.zip` (código, testes, geração) para guardar no Drive.
- **Testes sem dados reais:** o internograma de 11/11 usado nos testes e os nomes/registros dos testes de identificação, agenda e mapa foram trocados por fictícios. Os testes de leitura de fotos reais continuam só no ambiente de trabalho (decisão do usuário).

## v63 — faixa de tarefas no card
- Cada paciente da aba Leitos ganha a faixa **Visita · Evolução · Prescrição**: um toque marca, outro desmarca (vale para o dia; sincroniza entre aparelhos).
- **Evolução:** marcada sozinha quando a evolução é feita no app; pode ser marcada à mão quando o paciente foi evoluído direto no sistema do hospital. Na aba Evoluções, os marcados à mão aparecem em "Marcados como evoluídos (fora do app)" e saem de "falta evoluir".
- **Contadores e filtros** na aba Leitos: visitados / evoluídos / prescritos; "Falta visitar", "Falta evoluir", "Falta prescrever". O topo do app passa a mostrar também os prescritos.
- **Modo compacto:** quadradinhos V E P no lugar de "✓" e "E".
- A etiqueta "evoluído ✓" sai do card (a faixa já mostra).
- Teste novo `t_tarefas63.py` (dados fictícios).

## v62 — leitura do pós-operatório no internograma
- **PO lido em mais formatos:** data sem ano — "1 PO … (23/11)" ou "… 21/11" no fim da linha —, "25d Po", "3 DPO", parêntese não fechado. "1/3 distal" no meio do texto não vira data. Cada linha da Causa é lida separadamente. No internograma de 24/11, 4 dos 15 operados ficavam sem PO; agora todos são lidos.
- **PO sem data** ("6 Po Revisão De Atq"): usa o número escrito e mostra aviso na conferência pedindo a data da cirurgia.
- **"Operado" só nesta internação:** "Pot" com data anterior à internação (ex.: cirurgia de 2021) não marca mais o paciente como pós-operatório (ferida operatória e dreno na visita e na folha).
- **Pré-op não continua depois de operado:** se o internograma já mostra POI/PO da cirurgia marcada, sai o alerta vermelho "CX HOJE: checar jejum e heparina" e a proposta cirúrgica (Hb > 10); a ficha mostra "✓ Operado" e avisa que o bloco de pré-op ainda está escrito.
- Teste novo `t_po62.py` (dados fictícios).

## v61 — tela de bloqueio na paleta do serviço
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
