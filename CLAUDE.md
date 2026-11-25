# CLAUDE.md — regras para trabalhar no SOT APP

## Objetivo
App web instalável (PWA) do Serviço de Ortopedia do HCFAMEMA: enfermaria (internograma, visita, pendências, evoluções, agenda, mapa) + OrthoHub (textos no padrão do serviço para PS, ambulatório e centro cirúrgico). Usado no plantão por ~4 residentes, no celular, com rede instável. Detalhes: `SPEC.md`.

## Antes de mudar qualquer coisa
1. Ler `SPEC.md` (o que existe e as regras do serviço) e `PLANO.md` (o que está combinado).
2. Confirmar com o usuário o que vai mudar, se não estiver claro.

## Regras de trabalho
- **Uma etapa por vez.** Terminar, testar e mostrar antes de começar a próxima.
- **Não apagar funções, campos, programas ou textos sem perguntar.** Isso vale também para "limpar" código que parece sem uso.
- **Não usar dados reais de pacientes** em código, testes, exemplos ou documentação. Só dados fictícios (o repositório é público).
- **Não mudar o texto gerado** (padrão do serviço) sem combinar; o médico cola esse texto no prontuário.
- **Não mudar `id`s nem chaves de armazenamento** sem converter o que já está salvo nos aparelhos.
- **O SOT APP daqui é o oficial.** Artefatos, outras conversas e projetos são rascunho/teste: o que vier de lá é revisado e integrado aqui (nunca substitui sem revisão). Pacotes completos só saem daqui.
- Responder e documentar em **português**.

## Padrões técnicos
- HTML + CSS + JavaScript puro, sem framework, sem servidor. Hospedagem: GitHub Pages.
- Fonte em `src/`; `python3 build.py N` gera `dist/` e carimba a versão `N`; `./check.sh` confere a sintaxe.
- `index.html` e `evo.html` são **gerados**: editar as partes em `src/js/`, `src/css/`, `src/amb/`.
- Regra usada em mais de um lugar → **motor** `sot-*.js` na raiz, lido por todos (nunca copiar).
- Arquivo novo na raiz → `ESSENCIAL` do `sw.js`; programa novo do hub → `RESTO` do `sw.js` e `HUB` em `21-orthohub.js`.
- Tudo salvo primeiro no aparelho; Drive depois. Funcionar sem internet.
- Interface: tema do app (IBM Plex, ícones SVG `ico()`), alvos de toque ≥ 44 px, claro e escuro.
- Toda versão nova: número novo no `sw.js` (maior que todos), testes (`tests/`, com `SOT_DATA=2026-11-16`) e zip `sot-fonte-vN.zip` (Drive).
- **Publicar** (desde 24/11/2026): só quando o usuário pedir "publica". O Claude envia `dist/` direto ao repositório `erresot/sot-app` (branch `main`, GitHub Pages) e confere que o GitHub ficou idêntico ao `dist/`. O zip `sot-app-atualizacao-vN.zip` é opcional.

## Conferir o internograma real (regra fixa, desde 24/11/2026)
- **Seção, leito, registro, DIH e contadores de paciente real: só pelo leitor do app** (`parseTabelaHTML` + `classificar`, ou `S.pacientes` / `__lista` do Atualizador). **Nunca** por leitura improvisada da tabela (script próprio de seções): foi assim que "ALTAS" virou "Hm" por engano.
- Antes de afirmar algo sobre um paciente real, conferir por **duas vias** (leitor do app × texto do Doc). Se não baterem, dizer que não bateram — não escolher uma.
- Ao relatar, dizer **de onde veio** a informação (leitor do app / Doc) e mostrar **leito · seção**.
- Inspeções no internograma real são **só leitura**. Criar cópia no Drive só com autorização do usuário.

## Ao terminar uma etapa
- Escrever teste novo para o que mudou; durante o trabalho `python3 tests/rodar.py` (só o que mudou); antes de gerar a versão `python3 tests/rodar.py --tudo`.
- Atualizar `CHANGELOG.md`, `PLANO.md` e, se mudou comportamento, `SPEC.md`.
- Dizer ao usuário o que mudou, o que foi testado e o que ficou pendente.
