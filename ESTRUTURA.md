# SOT APP — o que fica onde

Mapa do repositório **erresot/sot-app** (publicado no GitHub Pages) para quem for atualizar o app.
Regra de ouro do projeto: **uma função usada em mais de um lugar é um "motor" único** (um arquivo `sot-*.js` na raiz).
Os programas só mudam a forma de acesso. Se uma regra muda (um nome na escala, um remédio, um formato de exame), muda **num arquivo só**.

---

## 1. Estrutura das pastas

```
sot-app/
├── index.html            ← o app (Enfermaria: Leitos, Pendências, Evoluções, Agenda, Ajustes + aba OrthoHub)
│                            ⚠ GERADO a partir de várias partes (js/app/*.js, css/) — não edite no GitHub:
│                              a próxima atualização desfaz a edição. Peça a mudança na conversa que gera os pacotes.
├── evo.html              ← atualizador de evolução
├── GUIA.html             ← guia de instalação (Google Cloud + GitHub Pages) — feito uma vez
├── ESTRUTURA.md          ← este arquivo
├── config.js             ← configuração da equipe (ID do Google, Doc do internograma, conta, pasta do Drive)
├── sw.js                 ← modo offline (lista de arquivos guardados no aparelho)
├── manifest.webmanifest, icon-192.png, icon-512.png   ← instalação como app (PWA)
│
├── sync.js               ← login Google, Drive, sincronização, fotos e backup
├── sot-escala.js         ← MOTOR · escala fixa do ambulatório (pessoa → dias → áreas)
├── sot-exames.js         ← MOTOR · exames laboratoriais (Exames Updater, Mapa, AMB Internação, Condutas)
├── sot-med.js            ← MOTOR · medicamentos (anticoagulantes, condutas pré-op)
├── sot-linha.js          ← MOTOR · linha do internograma (6 colunas)
├── sot-datas.js          ← MOTOR · datas (dd/mm/aaaa ⇄ aaaa-mm-dd)
├── campos.js             ← MOTOR · leitura de CMB / MUC / ALERGIA em textos
├── pessoa.js             ← MOTOR · identidade do paciente (quando juntar ou não dois registros)
│
└── hub/                  ← programas do OrthoHub (abrem dentro do app)
    ├── anamnese.html     ← Anamnese (PS)
    ├── exame.html        ← Exame Físico (PS)
    ├── condutas.html     ← Condutas (Pronto Socorro)
    ├── novopac.html      ← Novo Paciente · Internograma
    ├── retornos.html     ← Solicitador de Retornos
    ├── ambint.html       ← AMB Internação
    ├── evoamb.html       ← Evolução Ambulatorial
    ├── avaliacao.html    ← Solicitador de Avaliações
    ├── exames.html       ← Exames Updater
    ├── relatorio.html    ← Realizador de Relatórios (+ cid10.txt)
    ├── posop.html        ← Condutas Pós-Operatórias
    ├── desccir.html      ← Descrição Cirúrgica
    ├── mapa.html         ← Mapa Cirúrgico
    ├── sot-tema.css      ← tema visual comum do hub
    ├── fonts/            ← letras (IBM Plex) — não mexer
    └── ocr/              ← leitor de fotos (Tesseract, 12 MB) — não mexer
```

**Pode editar direto no GitHub:** os programas do `hub/` (ex.: `condutas.html`) e os motores `sot-*.js` da raiz.
**Não edite no GitHub:** `index.html` e `evo.html` (são gerados) e o número de versão do `sw.js`.

**Onde colocar arquivo novo:**
- programa do OrthoHub → `hub/`;
- motor compartilhado → raiz, com nome `sot-*.js`;
- documentação → raiz.

Os programas do `hub/` carregam os motores com `../sot-xxx.js`.

---

## 2. Como atualizar (GitHub, pelo navegador)

1. Entre em **github.com/erresot/sot-app**, logado na conta da equipe.
2. **Arquivo na raiz:** na página inicial do repositório, **Add file → Upload files** e arraste o arquivo.
3. **Arquivo do `hub/`:** entre primeiro na pasta `hub` e só então faça **Add file → Upload files**. Se subir na raiz, ele cria uma cópia solta que o app não usa.
   - Atalho: arrastar a **pasta** `hub` inteira (do pacote de atualização) na página inicial também funciona, porque o GitHub mantém o caminho.
4. **Commit changes**. Em 1–2 minutos o GitHub Pages publica.
5. No aparelho, feche e abra o app. O app busca a versão nova pela internet. Se continuar a antiga, recarregue a página (no PC, Ctrl+Shift+R).

Ao enviar um arquivo com o mesmo nome, ele **substitui** o anterior.

### Modo offline (`sw.js`)
- O `sw.js` tem a lista `ESSENCIAL`: os arquivos guardados no aparelho para funcionar sem internet.
- **Motor novo na raiz:** acrescente o nome dele em `ESSENCIAL` e suba o `sw.js` junto.
- **Programa novo no `hub/`:** acrescente na lista `RESTO`.
- `C_OCR` e `C_FONTES` não mudam (leitor de fotos e letras).

---

## 3. Escala do ambulatório → `sot-escala.js`

**Fonte única** da escala fixa. Ao mudar um nome, um dia ou uma área, edite **só aqui**.

| Dia | Assistentes |
|---|---|
| 2ª | Fernando Salgado (pé e tornozelo) · José Marcondes, Emílio Murade (coluna) · Amilton Moreira Fernandes, Maysa Romanini, Equipe Pediátrica (pediátrica) |
| 3ª | Eduardo Jacob, Equipe Mão (mão) · Marcos Vinicius (ombro e cotovelo) |
| 4ª | Rodrigo Antoniassi, Adriano Garcia, Marcus Silveira, Equipe Quadril (quadril) |
| 5ª | Marcos Laraya, Ewerton Gonzalez, Equipe Joelho (joelho) · Ricardo Toma, Ederson Kida, Equipe Tumor (tumor) |
| 6ª | Gustavo Reinas (coluna e trauma) · Rogério Freitas, Ederson Kida (trauma) |

**Formato — uma linha por pessoa (ou equipe):**
`{ id: 'gustavo', n: 'Dr. Gustavo Reinas', amb: [ { d: 5, areas: ['Coluna', 'Trauma'] } ] }`
- `id` — identificador fixo. **Nunca mude** (escolhas salvas nos aparelhos usam o id). Pessoa nova = id novo.
- `amb` — um item por dia de ambulatório (d=1 segunda … d=5 sexta). Quem atende em dois dias tem dois itens (ex.: Ederson Kida).
- `areas` — escritas normalmente ("Pé e tornozelo"); cada programa põe em maiúsculas quando precisa.
- Equipe leva `eq: 1`. Equipes existentes: Pediátrica, Mão, Quadril, Joelho, Tumor. (Não existe "Equipe Coluna": coluna tem ambulatório na segunda e na sexta, com pessoas diferentes.)

**A área só descreve.** Ela ajuda a achar o nome e sugerir o dia, mas nunca impede nada: assistentes também atendem casos gerais e pronto-socorro.

**Retorno fora do dia do assistente** (ex.: chefe pede outro dia em que também está no ambulatório) é permitido:
- **Solicitador de Retornos:** botão "Assistente de outro dia (exceção)" + alerta amarelo na tela. O texto do paciente continua o padrão.
- **Condutas (PS):** alerta e `(FORA DO DIA DO ASSISTENTE)` no texto, com opção de desligar.

**Quem usa (todos leem deste arquivo):** Condutas (PS), Solicitador de Retornos, Novo Paciente e Condutas Pós-Operatórias.
- O Pós-Op guarda só o que é dele: as regiões do boneco que sugerem cada assistente (`POS_REG`, por id).
- O Mapa Cirúrgico não usa escala.

**O que é padronizado e o que não é:**
- O **plantonista do PS** ("DISCUTIDO COM" / "ASS DR") muda todo dia e **não** tem escala.
- O padrão é só o **dia do ambulatório** de cada assistente.

---

## 4. Condutas (Pronto Socorro) → `hub/condutas.html`

### Tipos de registro
| Tipo | Sai como |
|---|---|
| Conduta inicial | `#CONDUTA` + solicitações, medicação e "REAVALIAR APÓS" |
| Em tempo intermediário | `# EM TEMPO #` + visto + realizado + `CD:` com SOLICITO / AGUARDO (o atendimento continua) |
| Em tempo final | `# EM TEMPO #` + visto + realizado + `CD:` com a conduta final |
| Completo | `#CONDUTA` + `# EM TEMPO #` + conduta final num texto só (plantão corrido). Assinatura uma vez, no fim |

### Regras do serviço já embutidas
- **Retorno:**
  - o dia sai do ASS/"Discutido com" pela escala do ambulatório;
  - se o paciente tem **dono**, o dono tem prioridade;
  - dia diferente do dia do ASS → `(FORA DO DIA DO ASSISTENTE)`;
  - o botão **"Mandar para o dia da equipe"** acrescenta `DISCUTIR COM EQUIPE ___`;
  - a data nunca cai hoje nem no passado;
  - sai junto o texto para o paciente: "… às 7 horas. Ambulatório Mário Covas".
- **"RETORNAR AO PS SE NECESSÁRIO" + sinais de alarme:** fixos em toda saída do paciente (alta, conservador, encaminhamento).
- **ANTICOAGULAÇÃO PROFILÁTICA:** ligada e em destaque quando há imobilização de membro inferior ou "sem carga". A dose fica na prescrição.
- **Fratura exposta:** o antibiótico segue o **padrão da equipe**, não o protocolo da CCIH (que é material de consulta):
  - Gustilo I e II: `EV EM PS: VAT + CEFALOTINA 2 G 6/6H`
  - Gustilo III: `EV EM PS: VAT + GENTAMICINA 240 MG DILUIR EM SF DE 250 ML 1 VEZ AO DIA + CLINDAMICINA 600 MG DILUIR EM SF DE 100 ML DE 6/6 HORAS`
- **VAT** = prescrição da vacina antitetânica. Sem tabelas; a decisão fica com a enfermagem e a vigilância.
- **Sutura** no padrão do serviço: `LIMPEZA EXAUSTIVA DE FCC COM SF 0,9% + ASSEPSIA + ANTISSEPSIA + ANESTESIA COM LIDOCAÍNA S/V + SUTURA DE FCC COM NYLON 3,0`. Volume, tamanho, local, pontos e curativo só entram se forem preenchidos.
- **Lacunas `___`:** o que não pode ser presumido sai em branco até ser preenchido. Ao copiar, o app avisa quantas lacunas sobraram.
  - Exemplos: controle radiográfico, nº de tentativas, drogas da sedação, neurovascular.
  - "SEM INTERCORRÊNCIAS" nunca sai sozinho.
- **Neurovascular pré e pós** só nas **reduções (luxação e fratura) e na tração**. O que examinar sai pela região marcada (ombro → região deltoidea e pulso radial; joelho → pulsos e nervo fibular). Sem consentimento escrito.
- **Laboratoriais colados** saem formatados pelo motor `sot-exames.js`.

### Onde mudar cada coisa dentro de `condutas.html`
Abra o arquivo no GitHub (✏️) e procure, com Ctrl+F, pelo nome entre crases:

| Para mudar… | Procure |
|---|---|
| Antibiótico da exposta (padrão da equipe) | `const ATB12` e `const ATB3` |
| Achados de imagem e quadro clínico por região | `const REG` (listas `ach` e `clin`) |
| Tipos de imobilização | `const IMOB` |
| Chips "Solicito" e "Aguardo" do intermediário | `const SOL` e `const AGU` |
| Ambulatórios (gesso, curativo, áreas) | `const AMBS` |
| Motivos do retorno ("PARA +") | `const PARA` |
| Regras de Ottawa / C-spine | `const REGRAS` |
| Articulações luxadas, manobras e imobilização habitual | `const LUX` |
| O que examinar no neurovascular, por região | `const NV` |
| Em quais procedimentos sai o neurovascular | `const NV_PROCS` |
| Texto técnico de cada procedimento | `const PROCS` (cada um tem `txt:`) |
| Itens de cada desfecho (alta, internação…) | `function itemsFor` |
| Modelos prontos (botões do topo) | `const PRE` |

Depois de editar: **Commit changes** e teste em um paciente fictício antes de usar no plantão.

---

## 5. Folha de visita impressa (Enfermaria)
- **Leitos → 🖨 Imprimir folha de visita:** gera folhas A4 deitadas com todo o internograma de cada paciente e caixas para marcar à caneta.
- **📷 Ler foto da folha:** o app lê as marcas da foto e lança na visita beira-leito de cada leito, com tela de revisão antes de salvar. Código: `js/app/48-folha.js`.
- O **prontuário** aparece ao lado do nome nas listas (toque para copiar).

---

## 6. Dados de paciente
- **O repositório é público e não guarda nenhum dado de paciente:** só código.
- **Dados da visita, fotos e evoluções:** ficam no aparelho e no Drive da conta da equipe (pasta definida em `config.js`).
- **O Condutas não guarda nada do paciente.** Guarda apenas o nome do plantonista por 14 horas, naquele navegador, para não ser digitado a cada paciente.

---

## 7. Versões e pacotes
- Cada pacote de atualização tem um número (`sot-vNN` no `sw.js`). O aparelho só baixa a versão nova se o número mudar.
- **Os pacotes completos saem de uma conversa só.** Outra conversa que mexer num programa entrega só aquele arquivo (ex.: `condutas.html`), que é encaixado no próximo pacote.

## 8. Próximas etapas combinadas
- Memória do atendimento no Condutas (encadear inicial → intermediário → final): quando juntar **Anamnese + Exame Físico + Condutas**.
