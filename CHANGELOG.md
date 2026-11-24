# CHANGELOG — SOT APP

## v58 (atual) — exemplo do Mapa Cirúrgico fictício
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
