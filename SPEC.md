# SOT APP — Especificação (SPEC)

> Documento técnico do app inteiro. Substitui o antigo `ESTRUTURA.md`.
> Versão descrita: **v75** (25/11/2026). Ao mudar o app, atualize este arquivo, o `PLANO.md` e o `CHANGELOG.md`.

---

## 1. Objetivo

Agilizar o trabalho diário do **Serviço de Ortopedia e Traumatologia (SOT) do HCFAMEMA (Marília-SP)**, reunindo num só app instalável:

- a **enfermaria**: internograma, visita beira-leito, pendências, evoluções, agenda cirúrgica e mapa cirúrgico;
- o **OrthoHub**: programas que geram textos no padrão do serviço para o pronto-socorro, o ambulatório e o centro cirúrgico.

O app **não substitui o prontuário**. Ele monta o texto, que o médico confere e cola no sistema do hospital.

## 1.1 Versão oficial
- **O SOT APP (fonte em `src/`, mantida na conversa que gera os pacotes) é a única versão oficial.**
- Artefatos, outras conversas e projetos são **rascunho e teste**. O que vier de lá é revisado criticamente e integrado aqui; nada daqui é substituído automaticamente por uma versão externa.

## 2. Usuários e contexto

- **Quem usa:** residentes de ortopedia do serviço, hoje **cerca de 4 usuários**, com tendência a crescer.
- **Onde:** no celular (principalmente) e no computador do hospital. Rede instável: o app precisa funcionar **sem internet**.
- **Conta:** os aparelhos entram com a **conta Google da equipe** (definida em `config.js`). Os dados compartilhados ficam no Drive dessa conta.
- **Acesso:** senha do app (só o hash PBKDF2 fica no código). Sessão de 15 min sem uso; depois pede a senha de novo.
- **Situação:** todos os programas estão **em uso e em teste diário** (procurando bugs no uso real).

## 3. Entradas e saídas

| Entrada | De onde vem | Usada em |
|---|---|---|
| Internograma | Google Doc "Internograma HCI" (`config.js → DOC_ID`) ou PDF exportado dele | Leitos, Pendências, folha de visita, Agenda |
| Agenda cirúrgica | Google Agenda da conta da equipe (só leitura) | Agenda, Mapa, AMB Internação |
| Marcações da visita | toques na ficha ou foto da folha de visita impressa | Visita, evolução |
| Fotos | câmera do aparelho (radiografias, pele, folha de visita, laudos) | Ficha do paciente |
| Textos colados | anamnese do PS, exames laboratoriais, evolução anterior | Novo Paciente, Exames Updater, evolução, Condutas |

| Saída | Para onde vai |
|---|---|
| Textos no padrão do serviço (evolução, condutas, retorno, relatório, descrição cirúrgica, pós-op, avaliação) | copiados e colados pelo médico no prontuário / WhatsApp |
| Linha nova do internograma | copiada para o Google Doc |
| Mapa cirúrgico | impressão, WhatsApp, arquivo no Drive |
| Folha de visita impressa | PDF A4 para imprimir |
| Estado compartilhado | Drive da equipe (pasta `config.js → PASTA`) |

## 4. Funções existentes

### 4.1 Enfermaria (`index.html`), com 5 abas

| Aba | O que faz | Situação |
|---|---|---|
| **Leitos** | Lista de pacientes do internograma (busca, modo normal/compacto, prontuário ao lado do nome: toque copia). Ficha: visita beira-leito por toques, fotos, pré-operatório, pedido de avaliação, notas. Folha de visita: imprimir e ler a foto. | Funciona. Leitura da folha: **falta teste real** (só testada com fotos simuladas). |
| **Pendências** | Tarefas do dia por paciente, marcáveis, sincronizadas. | Funciona |
| **Evoluções** | Atualizador de evolução diária embutido (`evo.html`): parte da evolução anterior + visita do dia. | Funciona |
| **Agenda** | Lê o Google Agenda, padroniza os eventos e confere com o internograma (dupla checagem). Abre o **Mapa Cirúrgico** do dia (`hub/mapa.html`). Pacientes da agenda fora do internograma. Alerta de "segurar alta". Laudos por OCR. AMB Internação. | Funciona |
| **Ajustes** | Importar internograma (Doc ou PDF), conferência da contagem, quem saiu do internograma (igual em todos os aparelhos), backup em arquivo, exemplo fictício, tema claro/escuro. | Funciona |

Outros comportamentos:
- **Atualizador de Internograma (v67, `hub/atualizador.html`, protótipo):** lê `S.pacientes[].bruto` do app (Doc: linhas por quebra; PDF: " / "), calcula para o dia escolhido só os números (DIH pela data de internação quando há; contadores da Causa pelo `sot-contadores.js`, procurando a data até 2 linhas abaixo), cabeçalho pela `contagem()`, e lista o que só a pessoa resolve. Referência sem data = "números em dia até ontem/hoje/anteontem" (escolha na tela). Só leitura do internograma. **v68:** "Criar cópia atualizada" — `SYNC.copiarInternograma` (Drive files.copy) + `SYNC.docLer`/`docAlterar` (Docs API, writeControl pela revisão lida) trocam só os números na cópia, pintados; `docAlterar` recusa `CFG.DOC_ID`. **v69:** fonte = Doc exportado na hora (`SYNC.exportarDoc` + `parseTabelaHTML`, sem aplicar no app); fallback = importado. "Comparar lado a lado" lê os dois documentos (`SYNC.docLer`) e compara palavra por palavra, marcando mudança que não é número. Cabeçalho: só data e números. Referência sugerida pela data do cabeçalho. "Ensaio" = só leitura. **v70:** registro repetido (ex.: ala + ALTAS) → números listados uma vez e trocados em todas as linhas do registro (trocas sem repetição); aviso com as seções (ala + ALTAS = normal até a alta ser certa). O Atualizador nunca tira nem move pacientes. **v71:** usa o mesmo leitor da enfermaria (`parseTabelaHTML`/`classificar`/`dihResolver`) e o mesmo motor de contadores (`SOTCONT`); data de internação aceita os rótulos Dih/DI/D.I./Data de internação/Internação/Internou (`RE_DIH_DATA`); data entre parênteses no fim da linha vale mesmo após 90 caracteres. **v72 — leitura por bloco (`SOTCONT.analisar`/`atualizarLinhas`):** contador sem data na linha procura no bloco (até linha vazia, "-", outro contador, rótulo ou Pot/Po/Pós-op; máx. 12 linhas; PO não atravessa trauma/fratura) — vale como a da linha (±10, nota de atraso); "N d" sem data no bloco usa o mecanismo da 1ª coluna (±1 na linha do trauma; exata se a data está sozinha abaixo); data de internação nunca. Conferência, Atualizador e Agenda usam o mesmo motor. **v73:** motor também lê "Dih N" (`lerDih`) e o cabeçalho (`cabecalho`, tolerante; data sem barra só com leitura única perto de hoje). Identificação nome/idade/cidade por `lerIdent` (Doc e PDF). Defesas: bordas horizontais do PDF separam fichas; `defesaFicha` avisa mistura (2 registros/Dih/datas/leitos) e ficha com poucos dados — nunca separa nem descarta sozinho. PDF sem texto → aviso, nada trocado. `conferenciaIG()` = todos os avisos agrupados (faixa dos leitos, Ajustes, Atualizador). **v74:** `dihResolver` — sem Dih escrito, a data solta da 1ª coluna é a internação (`dihFonte = 'solta'`, conferência pede confirmação); `dataTrauma` = data do mecanismo / "Em dd/mm" / data solta quando a internação está escrita. Rótulo = leito · seção · nome. Usa as permissões que o app já tem (drive.readonly para copiar; drive.file para editar a cópia que ele criou).
- **Contadores pela data (v66, `sot-contadores.js`):** um motor para PO/POI/N d. Conferência (aviso "Contador: …"), mapa e linha de dados no dia da cirurgia (`31-mapa.js`), painel da Agenda. Com data → pela data; sem data → +dias desde o internograma e dúvida.
- **Pedido de exames (v66, `js/app/26-exames-pedido.js`):** "dd/mm Solicitar" (pedir na véspera, rotina) e "Solicitado dd/mm" (coleta no dia seguinte). Pendência só para "pedir na rotina hoje"; o resto é aviso.
- **Programação pós-op (v65, `js/app/25-posop-prog.js`):** lida do Orienta/Condutas de quem tem PO contável. Pendência automática só para "alta prevista hoje" e "saiu da UTI + alta ao sair da UTI"; carga, ATB, anticoagulante (até ~data), imobilização, retorno e curativo são só informação na ficha. Alta que passou: etiqueta cinza + "não vale mais" (lápide `§alta|…` em `S.pendDel`, sincronizada). Saída da UTI pelo histórico de lugares (`S.idents[id].hist`), por 3 dias.
- **Faixa de tarefas do card (v63):** Visita · Evolução · Prescrição, um toque marca/desmarca no dia (`S.v[id]._ok`, `_evo`, `_presc`; sincroniza campo a campo). Evolução feita no app aparece marcada sozinha e não é desmarcada pela faixa; a marcação à mão serve para quem evoluiu no sistema do hospital. Contadores (visitados/evoluídos/prescritos) e filtros "Falta visitar / evoluir / prescrever" na aba Leitos; no modo compacto, quadradinhos V E P. No dia seguinte tudo começa desmarcado.
- **Visão em tela larga** (≥ 1100 px): lista e ficha lado a lado.
- **Atalhos de teclado:** `/` busca · `1–5` abas · `↓/J` `↑/K` navegar · `V` visita · `E` evolução · `Esc` fecha · `?` ajuda.
- **Sincronização:** tudo é salvo primeiro no aparelho e enviado ao Drive quando há rede. A visita é mesclada **campo a campo** pelo horário de cada marcação (dois residentes podem editar o mesmo paciente).
- **Backup diário** no Drive, com retenção (14 dias: o mais novo de cada dia; antes disso: um por mês).

### 4.2 OrthoHub (`hub/`), com 12 programas

| Grupo | Programa | Arquivo | O que faz |
|---|---|---|---|
| Pronto-socorro | Anamnese | `anamnese.html` | História por toques: chamado, mecanismo, evolução, dor no boneco 3D |
| | Exame Físico | `exame.html` | Exame por segmento: "tudo normal" e marcar só o alterado |
| | Condutas (PS) | `condutas.html` | Conduta inicial, "em tempo" intermediário e final, completo; procedimentos, imobilização, retorno, alta/internação |
| | Novo Paciente | `novopac.html` | Linha nova do internograma a partir da anamnese colada, foto/print (OCR) ou digitação |
| Ambulatório e documentos | Solicitador de Retornos | `retornos.html` | Dia do ambulatório, assistente, setor e data → texto para a recepção |
| | AMB Internação | `ambint.html` → `evo.html?modo=amb` | Evolução do ambulatório pré-operatório; acha o paciente na Agenda pelo prontuário e manda os dados para o mapa |
| | Evolução Ambulatorial | `evoamb.html` → `evo.html` | Mesmo atualizador de evolução do app |
| | Solicitador de Avaliações | `avaliacao.html` | Pedido de avaliação anestésica/cardiológica (internados: vem preenchido da ficha) |
| | Exames Updater | `exames.html` | Formata exames laboratoriais em linha |
| | Realizador de Relatórios | `relatorio.html` (+ `cid10.txt`) | Relatório de ortopedia com busca de CID-10 |
| Centro cirúrgico | Condutas Pós-Operatórias | `posop.html` | Programação pós-cirúrgica: região no boneco 3D, modelo do serviço, retorno, assinatura |
| | Descrição Cirúrgica | `desccir.html` | 142 procedimentos com variações e passo a passo; vários procedimentos por cirurgia, OPME, material para exame, explante, neurovascular, controle de danos e verificação de coerência. |

O **Mapa Cirúrgico** (`hub/mapa.html`) não aparece na lista do OrthoHub: abre pela aba **Agenda**, no dia escolhido.

### 4.3 O que está pela metade

- **Folha de visita impressa:** leitura testada só com fotos simuladas; falta a calibração com folha, caneta e câmera reais.
- **Anamnese → Exame Físico → Condutas:** cada um gera seu texto sozinho; o encadeamento (um alimentar o outro) está só planejado.

## 5. Regras do serviço embutidas no código

### 5.1 Escala do ambulatório → `sot-escala.js` (fonte única)

| Dia | Assistentes (área) |
|---|---|
| Seg | Fernando Salgado (pé e tornozelo) · José Marcondes, Emílio Murade (coluna) · Amilton Moreira Fernandes, Maysa Romanini, **Equipe Pediátrica** (pediátrica) |
| Ter | Eduardo Jacob, **Equipe Mão** (mão) · Marcos Vinicius (ombro e cotovelo) |
| Qua | Rodrigo Antoniassi, Adriano Garcia, Marcus Silveira, **Equipe Quadril** (quadril) |
| Qui | Marcos Laraya, Ewerton Gonzalez, **Equipe Joelho** (joelho) · Ricardo Toma, Ederson Kida, **Equipe Tumor** (tumor) |
| Sex | Gustavo Reinas (coluna e trauma) · Rogério Freitas, Ederson Kida (trauma) |

- Formato: uma linha por pessoa: `{ id, n, eq?, amb: [{ d: 1..5, areas: [...] }] }`. **O `id` nunca muda** (escolhas salvas nos aparelhos usam o id).
- **A área só descreve:** ajuda a achar o nome e sugerir o dia, nunca bloqueia (assistentes também atendem casos gerais e PS).
- Não existe "Equipe Coluna" (coluna tem ambulatório na segunda e na sexta, com pessoas diferentes).
- **Retorno fora do dia do assistente** é permitido:
  - Retornos: botão "Assistente de outro dia (exceção)" + alerta amarelo; o texto da recepção continua o padrão.
  - Condutas: alerta + `(FORA DO DIA DO ASSISTENTE)` no texto, desligável.
- A data do retorno **nunca** cai hoje nem no passado.
- O **plantonista do PS** muda todo dia e não tem escala; o padrão é só o dia do ambulatório.
- Usam este arquivo: Condutas, Retornos, Novo Paciente, Pós-Op. Se ele não carregar, cada programa avisa na tela.

### 5.2 Condutas (PS) → `hub/condutas.html`

| Tipo de registro | Sai como |
|---|---|
| Conduta inicial | `#CONDUTA` + solicitações, medicação e "REAVALIAR APÓS" |
| Em tempo intermediário | `# EM TEMPO #` + visto + realizado + `CD:` com SOLICITO / AGUARDO |
| Em tempo final | `# EM TEMPO #` + visto + realizado + `CD:` com a conduta final |
| Completo | `#CONDUTA` + `# EM TEMPO #` + conduta final num texto só; assinatura uma vez |

- Retorno: dia pelo assistente ("dono" do paciente tem prioridade); "Mandar para o dia da equipe" acrescenta `DISCUTIR COM EQUIPE ___`; texto do paciente "… às 7 horas. Ambulatório Mário Covas".
- "RETORNAR AO PS SE NECESSÁRIO" + sinais de alarme em toda saída do paciente.
- **Anticoagulação profilática** destacada quando há imobilização de membro inferior ou "sem carga" (a dose fica na prescrição).
- **Fratura exposta:** antibiótico pelo **padrão da equipe** (`const ATB12`, `const ATB3`), não pelo protocolo da CCIH.
- Sutura no padrão do serviço; **lacunas `___`** para o que não pode ser presumido (o app conta as que sobraram ao copiar); "SEM INTERCORRÊNCIAS" nunca sai sozinho.
- Neurovascular pré e pós só em reduções e tração, pela região.
- Onde mudar: `const REG`, `IMOB`, `SOL`, `AGU`, `AMBS`, `PARA`, `REGRAS`, `LUX`, `NV`, `NV_PROCS`, `PROCS`, `PRE`, `function itemsFor`.

### 5.3 Condutas Pós-Operatórias → `hub/posop.html`

- Modelos por procedimento (`TEMPLATES`), modelos próprios do usuário salvos no aparelho.
- Regiões do boneco que sugerem o assistente: `POS_REG` (por id da escala).
- Rodapé: data da última atualização das condutas (hoje: 23/11/2026).

### 5.4 Leitura do internograma (Google Doc)

| Coluna | Formato padrão | Também aceito |
|---|---|---|
| 1 · Local/mecanismo/DIH/leito | `Dih 12/11/2026` em linha própria; leito `1250` | data solta (`22/11/26`, `21/11`) = internação **só se bater com o "Dih N"** (±1 dia); senão é data do trauma |
| 2 · Nome/idade/origem/DIH/registro | nome · `55a` · cidade · `Dih 11` · registro | `Nome, 77A, Cidade` / `Nome, 35, Cidade` na mesma célula (ou quebrado depois da vírgula) |

| 3 · Causa (cirurgias) | `N PO <procedimento> (dd/mm/aaaa)`, uma cirurgia por linha, a mais recente em cima; `POI` no dia | `(23/11)` ou `23/11` no fim da linha (sem ano); `25d Po`, `3 DPO`; parêntese não fechado; `Pot …` = cirurgia antiga |

- PO (v62): calculado pela **data** da cirurgia mais recente; o número escrito só serve para conferir ("internograma escreve 33 PO, pela data é 37º"). PO **sem data** usa o número escrito e avisa "PO sem data". Data sem ano só vale entre parênteses ou no fim da linha (nunca "1/3 distal").
- Operado (v62): tem PO contável, ou "Pot" com data **desta internação** (Pot sem data legível também conta). "Pot planalto 2021" num paciente internado por outra fratura não abre ferida operatória/dreno na visita.
- Pré-op (v62): se o PO mais recente é do dia da cirurgia marcada ou depois, o alerta "CX HOJE: checar jejum/heparina" sai e a ficha mostra "✓ Operado — o bloco de pré-op ainda está escrito no internograma".
- **Contagem do cabeçalho (definida pelo usuário, 25/11/2026):** HC = ortopedia no HC; IC = interconsultas, à parte; Hm = todos do Materno Infantil (RN conta). Cabeçalho sem "N Altas" → altas dentro do HC; com "N Altas" → HC sem elas. Cada registro conta uma vez. Regra única em `SOTCONT.contarIG` (Atualizador e conferência).
- **Convenção oficial de contagem (definida pelo usuário, 24/11/2026):** o dia do evento é o dia **0**. Internou hoje → **DIH 0** (amanhã DIH 1). Fraturou hoje → **0d** (amanhã 1d). Operou hoje → **POI** (amanhã 1 PO). Ou seja, contador = diferença de datas. "+1" em relação à data é erro de contagem, não outra convenção.
- **Exames — convenção:** "dd/mm: resultados" = resultado do dia; "dd/mm: solicitado" = pedido para a rotina daquele dia (colhe dd/mm às 5–6h); "dd/mm Solicitar" = deve ser pedido na véspera. A data é sempre o **dia da coleta**. Datas aparecem como dd/mm ou dd/mm/aa(aa).
- DIH: data escrita → data solta que bate com o "Dih N" → só o "Dih N" (avisa "data de internação não escrita").
- Conferência (Ajustes): cada paciente lista o que não foi lido com segurança (sem idade, nome com números, registro, DIH/PO divergentes, possível mistura de pacientes).

### 5.5 Visita beira-leito → `js/app/12-visita.js`

Campos (`CAMPOS`), cada um com quando aparece (`when`: operado, membro, coluna…): queixas, dor (EVA), consciência, respiratório (ar ambiente · dispneia · O2 · IOT), hemodinâmica (estável sem DVA · em uso de DVA), acompanhante, dieta/jejum, diurese, evacuação, febre, ferida operatória, dreno, imobilização/tração, neurovascular, amplitude de movimento, edema, panturrilha, mobilização, lesão por pressão, pré-op, exame neurológico, esfíncteres, força por nível (coluna).

## 6. Fora do escopo

- Prescrever ou substituir o prontuário do hospital: o app só **gera texto** para o médico conferir.
- Guardar dados de paciente fora do **aparelho** e do **Drive da conta da equipe** (o repositório no GitHub é público e só tem código).
- Escala do plantão do PS (só a escala fixa do ambulatório).
- Uso por outras especialidades.

## 7. Requisitos técnicos

- **Plataforma:** HTML + CSS + JavaScript puro, sem framework e sem servidor próprio. Hospedado no **GitHub Pages** (`erresot.github.io/sot-app`).
- **PWA:** instalável; `sw.js` guarda os arquivos no aparelho.
  - `ESSENCIAL`: guardados na instalação (app + motores).
  - `RESTO`: programas do hub, guardados em seguida.
  - `C_OCR` / `C_FONTES`: leitor de fotos (12 MB) e letras, que não mudam entre versões.
  - Bibliotecas externas: three.js e pdf.js (cdnjs), guardadas no aparelho.
- **Versão:** `var V = 'sot-vNN'` no `sw.js`. O aparelho só baixa a versão nova se o número mudar. **Todo pacote novo tem número novo.**
- **Armazenamento no aparelho:**
  - estado do app: `localStorage['sot-app-v1']`; se encher, passa para IndexedDB;
  - fotos: IndexedDB `sot-fotos`;
  - programas do hub: chaves próprias (`pos-op-*`, `cd_plantao`, `ig-draft`, `ig-list`, `np-prefill`, `exorto3`, `mapaSOT.*`, `sot-ambint`, `examesUpdater.*`).
- **Google:** login OAuth (`CLIENT_ID`); escopos Drive (`drive.file`, `drive.readonly`) e Agenda (`calendar.readonly`).
- **Drive (pasta `config.js → PASTA`):** subpastas `pacientes/` (um JSON por paciente), `fotos/`, `folhas/`, `backups/`; arquivos `mapa-AAAA-MM-DD.json`, `amb-<prontuário>.json`, `internograma-hist.json`, `folha-<id>.json`. Cada arquivo é achado pelo nome; o mais novo vale.
- **Rede:** cada pedido tem tempo-limite (30 s; envio 120 s) e nova tentativa em erro temporário; envios em paralelo e em fila.
- **Segurança:** senha só como hash; programas do hub só abrem depois da senha; nenhum dado de paciente no código.
- **Fontes:** IBM Plex (local, `hub/fonts/`). Ícones: SVG próprios (`ico()`).
- **Cores (paleta A):** marinho #13365C (cabeçalho), azul #1F6FCE (ações), ciano #2CB5DC, fundo #EDF1F6; Evolução em ciano; verde = visitado/normal, laranja/vermelho = alerta. No app: bloco "PALETA A" no fim do `css/app.css`; no OrthoHub: fim do `hub/sot-tema.css` (troca a cor de destaque de todos os programas).

### 7.1 Código-fonte, geração e testes

- O que está no GitHub é o **app gerado** (`dist/`). A fonte fica em `src/`:
  - `src/index.html` tem marcadores `{{arquivo|arquivo}}`;
  - `build.py N` junta tudo em `dist/index.html` e `dist/evo.html` e carimba a versão `N` no `sw.js`.
- `check.sh`: confere a sintaxe de todos os scripts gerados (node).
- `tests/`: testes automatizados com Playwright (Chromium) e Drive simulado (`harness.py`), usando data fixa `SOT_DATA=2026-11-16`.
  - `tests/rodar.py` (v64): sem argumentos roda só os testes ligados ao que mudou desde o último "tudo ok" (funções de cada arquivo alterado; programas do OrthoHub pelo nome) + 2 testes básicos; documentação sozinha não roda teste. `--tudo` = regressão completa em paralelo (~7 min), obrigatória antes de gerar uma versão. `--lista` mostra a escolha e o motivo.
- **Cópia da fonte (v64):** a cada versão vai também um `sot-fonte-vN.zip` (src, tests, build.py, check.sh, LEIAME) para o usuário guardar no Drive. Os testes da fonte usam só dados fictícios; os 8 testes de leitura de **fotos reais** (OCR do ambulatório e laudos: `t_amb15`, `t_amb48`, `t_ambint`, `t_amb_ocr`, `t_ocr`, `t_pre44`, `t_v36`, `t_v41`) e as fotos ficam só no ambiente de trabalho e não entram no zip.
- **Publicação (desde 24/11/2026):** o Claude publica direto no repositório (`main`) quando o usuário pede "publica"; antes, o usuário subia o zip. Sempre conferir depois que o GitHub ficou igual ao `dist/`.
- **Não editar no GitHub:** `index.html`, `evo.html` (gerados) e o número de versão do `sw.js`. **Pode editar direto:** programas do `hub/` e motores `sot-*.js`.

## 8. Critérios de aceite (para qualquer versão nova)

1. `check.sh` sem erro de sintaxe.
2. Todos os testes passam (testes antigos ficam em `tests/legado/` e não rodam).
3. O app abre **sem internet** depois de instalado.
4. Nenhum erro no console ao abrir o app e cada programa do hub.
5. Textos gerados idênticos ao padrão do serviço nos casos testados (mudança de texto = combinada antes).
6. Escolhas e dados salvos nos aparelhos continuam valendo depois da atualização (ids e chaves não mudam sem conversão).
7. Número de versão novo no `sw.js`, maior que todos os anteriores.
8. Nenhum dado real de paciente em código, teste ou documentação.
9. `SPEC.md`, `PLANO.md` e `CHANGELOG.md` atualizados.

## 9. Mapa do código

### 9.1 Raiz

| Arquivo | Conteúdo |
|---|---|
| `index.html` | App da enfermaria (gerado) |
| `evo.html` | Atualizador de evolução + modo AMB Internação (gerado; inclui `amb/`) |
| `GUIA.html` | Guia de instalação e de uso (folha de visita etc.) |
| `config.js` | Configuração da equipe: `CLIENT_ID`, `DOC_ID`, `CONTA`, `PASTA` |
| `sw.js` | Modo offline e número da versão |
| `manifest.webmanifest`, `icon-*.png` | Instalação como app |
| `sync.js` | Login Google, Drive, sincronização, fotos, backup, mapa/AMB/folha/histórico no Drive |
| `sot-escala.js` | **Motor** · escala do ambulatório |
| `sot-exames.js` | **Motor** · exames laboratoriais (formatação e leitura) |
| `sot-med.js` | **Motor** · medicamentos (anticoagulantes, condutas pré-op) |
| `sot-linha.js` | **Motor** · linha do internograma (6 colunas) |
| `sot-datas.js` | **Motor** · datas (dd/mm/aaaa ⇄ aaaa-mm-dd) |
| `campos.js` | **Motor** · leitura de CMB / MUC / ALERGIA em textos |
| `pessoa.js` | **Motor** · identidade do paciente (quando juntar dois registros) |
| `SPEC.md`, `PLANO.md`, `CHANGELOG.md`, `CLAUDE.md` | Documentação |

### 9.2 Fonte do `index.html` (`src/js/`, na ordem em que entram)

| Arquivo | Parte |
|---|---|
| `00-senha-config.js`, `01-bloqueio-senha.js` | Hash da senha e tela de bloqueio |
| `02-ponte-evolucao.js` | Leitor do PDF do internograma (colunas) e ponte com a evolução |
| `03-leitor-internograma.js` | Leitura do internograma, histórico de quem saiu, resumo da visita, tema |
| `app/05-erros-versao.js` | Versão na tela, aviso de atualização, registro de erros |
| `app/09-topo.js` | Ícones SVG (`ico`) e cabeçalho |
| `app/10-estado.js` | Estado `S`, gravação local, troca para IndexedDB |
| `app/11-evolucoes.js` | Evoluções por paciente |
| `app/12-visita.js` | Campos da visita (`CAMPOS`) |
| `app/13-import-pdf.js` | Importação do PDF |
| `app/14-telas.js` | Abas, listas, busca, modo compacto, prontuário |
| `app/20-ficha.js` | Ficha do paciente, painel lateral, notas |
| `app/21-orthohub.js` | Lista e abertura dos programas do hub (`HUB`), tema do hub |
| `app/22-exames-ref.js` | Valores de referência dos exames (fora da faixa em vermelho) |
| `app/23-visita-versoes-sair.js` | Carimbo por campo, versões da evolução, botão Sair |
| `app/24-preop-avaliacao.js` | Checklist pré-operatório e pedido de avaliação |
| `app/30-agenda.js` | Agenda (Google Agenda) e dupla checagem |
| `app/31-mapa.js` | Mapa cirúrgico na Agenda, POI, pendências |
| `app/32-segurar-alta-laudos.js` | Segurar alta, laudos (OCR), RX POI |
| `app/33-agenda-ambulatorial.js` | Pacientes da agenda fora do internograma, aviso de quem saiu |
| `app/34-ambint.js` | Ligação com o AMB Internação |
| `app/40-tela-evolucao.js` | Tela de evolução embutida |
| `app/41-eventos.js` | Cliques, busca, atalhos de teclado |
| `app/42-fotos.js` | Fotos e legendas |
| `app/43-internograma-doc.js` | Internograma direto do Google Doc |
| `app/44-backup.js` | Backup em arquivo |
| `app/45-exemplo.js` | Exemplo fictício |
| `app/46-toque.js`, `app/47-rolagem.js` | Ajustes de toque e rolagem |
| `app/48-folha.js` | Folha de visita: impressão, leitura da foto, revisão |
| `app/90-init.js`, `99-final.js` | Início |
| `css/base.css`, `css/app.css` | Estilo do app e da folha impressa |
| `amb/amb.html`, `amb/amb.css`, `amb/amb.js` | Painel do AMB Internação (entra no `evo.html`) |

### 9.3 `hub/`

Programas da tabela 4.2, mais `mapa.html` (Mapa Cirúrgico), `sot-tema.css` (tema comum), `cid10.txt` (lista de CID), `fonts/` e `ocr/` (leitor de fotos Tesseract) — **não mexer** em `fonts/` e `ocr/`.

### 9.4 Onde colocar coisa nova

- Programa do OrthoHub → `hub/` + entrada em `HUB` (`21-orthohub.js`) + `RESTO` (`sw.js`).
- Regra usada em mais de um lugar → motor `sot-*.js` na raiz + `ESSENCIAL` (`sw.js`).
- Parte nova do app → `src/js/app/NN-nome.js` + marcador no `src/index.html`.
