# Changelog

Todas as mudanças relevantes deste projeto estão documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

---

## [Não lançado]

### Adicionado

#### Biblioteca
- Cadastro de livros com título, autor, gênero, capa (URL), ISBN, formato (físico/digital), idioma, local de compra e tags
- Status por livro: Quero ler, Lendo, Lido, Abandonado, Relendo
- Suporte a releituras com histórico de sessões anteriores (`readSessions`)
- Campo de trechos marcantes por livro (`quotes[]`), exibidos na aba Performance
- Scanner de ISBN via câmera (BarcodeScanner) para cadastro rápido
- Ordenação manual da lista "Quero ler" por drag-and-drop
- Filtros por status, gênero, formato, idioma, tag e busca por texto

#### Registros de leitura
- Registro de sessão informando a página atual — o app calcula as páginas lidas automaticamente
- Suporte a livros com páginas sem numeração (prefácio, índice) via `startPage` e `firstPageNum`
- Histórico paginado (100 registros por página)
- Exclusão de registro com confirmação de 10 segundos e opção de cancelar
- Ao excluir o último registro de um livro "Lido", o status reverte para "Lendo"
- Ao atingir a última página, o livro é marcado como "Lido" automaticamente
- Quando o total de páginas de um livro "Lido" é aumentado, um log de correção é gerado automaticamente para manter as métricas corretas

#### Performance
- Frase introdutória com o total histórico de páginas lidas
- Cards de métricas: páginas no ano, páginas no mês, livros concluídos, sequência atual e páginas lidas hoje (com destaque em cor diferenciada)
- Seletor de ano alinhado ao card "Hoje"
- Mapa de atividade anual (heatmap) com tooltip por dia
- Gráfico de barras mensal com linha de meta
- Gráfico de barras por ano (evolução histórica)
- Seção "Sua jornada" com visualização narrativa mês a mês
- Gráficos de rosca por gênero, local, formato e idioma
- Painel de conquistas do ano com trilha visual
- Painel de insight com o melhor mês do ano
- Painel "Meu próximo capítulo" com meta do mês
- Card de trechos marcantes com efeito typewriter ao tocar (pausa automática em vírgulas, pontos e entre palavras)

#### Conquistas
- Sistema de conquistas anuais e mensais com destravamento automático
- Confetti ao desbloquear uma conquista nova

#### Locais
- Cadastro de livrarias e plataformas favoritas com nome, URL, endereço, nota e tags

#### Configurações
- Definição de meta anual e mensal de páginas (com suporte a metas por mês específico)
- Exportação de dados em `.zip` com dois CSVs (`livros.csv` e `registros.csv`), separador `;` para compatibilidade com Excel PT-BR
- Importação do mesmo formato `.zip` ou CSV legado
- Reset completo dos dados

#### Interface geral
- Modo claro e escuro com persistência
- Navegação por abas com drag-and-drop para reordenar, persistido em `localStorage`
- Toasts de feedback com suporte a desfazer ação e contagem regressiva
- Ícone de filtro limpo (funil com ×) substituindo os botões "Todas" / "Todos" em toda a interface
- Layout responsivo com breakpoint em 640px

---

> Quando o primeiro deploy acontecer, esta seção será renomeada para a versão correspondente (ex: `[1.0.0] — YYYY-MM-DD`).
