# PageByPage

> Não é sobre quantidade. É sobre constância.

Rastreador de leitura pessoal, 100% client-side. Sem backend, sem cadastro, sem nuvem — tudo fica no seu navegador.

## O que faz

- Registra sessões de leitura página a página
- Acompanha metas anuais e mensais de páginas
- Gera um mapa de atividade (estilo heatmap) e gráficos de evolução
- Exibe trechos marcantes dos livros com efeito typewriter
- Gerencia lista de próximas leituras com ordenação manual
- Suporta releituras com histórico de sessões anteriores
- Exporta e importa dados via `.zip` com CSVs (compatível com Excel PT-BR)

## Stack

- **React 19** + **TypeScript** + **Vite**
- **CSS Modules** para estilos locais, tokens globais em `src/index.css`
- **Chart.js** via `react-chartjs-2` para gráficos
- **JSZip** para exportação/importação de dados
- Persistência local via `localStorage` (chave `pagebypage_v1`)

## Rodando localmente

```bash
npm install
npm run dev
```

Outros comandos:

```bash
npm run build    # build de produção (type-check + vite build)
npm run lint     # ESLint
npm run preview  # preview do build de produção
```

## Dados e privacidade

Nenhum dado sai do dispositivo. Tudo é salvo no `localStorage` do navegador. Para fazer backup, use a função de exportação disponível em **Configurações** — ela gera um arquivo `.zip` com dois CSVs (`livros.csv` e `registros.csv`).
