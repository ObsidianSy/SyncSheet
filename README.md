# SyncSheet — Gestão Financeira

SPA cliente-only para gestão financeira de pequenos negócios. A planilha Excel é o banco de dados: carregue → edite na interface → baixe. Nenhum dado sai do navegador.

## Stack

- Vite + React 18 + TypeScript (SWC)
- Tailwind CSS + shadcn/ui (Radix)
- React Router DOM v6
- React Hook Form + Zod
- TanStack Query
- Recharts (gráficos)
- xlsx-js-style (leitura) + ExcelJS (escrita preservando estilos/fórmulas)
- Vitest + Testing Library + Playwright

## Funcionalidades

- **Painel** com KPIs financeiros, de vendas e de estoque + gráfico mensal.
- **Clientes / Produtos / Movimentações / Vendas** com CRUD completo, busca, filtros e geração automática de códigos.
- **Fluxo de Caixa** com lançamentos manuais e automáticos.
- **Contas a Pagar / Receber** com detecção automática de vencidas.
- **DRE** com cálculo automático a partir das vendas pagas e contas quitadas.
- **Categorias** customizáveis para receitas e despesas.
- **Sincronização bidirecional**: marcar uma Conta a Receber como Recebida vira a venda original para Paga automaticamente (e vice-versa).
- **Alertas** contextuais no header (estoque baixo, contas vencidas).
- Datas sempre no fuso local — sem deslocamento UTC.

## Desenvolvimento

```bash
npm install
npm run dev          # http://localhost:8080
npm run lint
npm test
npm run build        # gera ./dist
npm run preview
```

## Deploy

O build é 100% estático (`./dist`). Pode ser servido por:

- Vercel / Netlify / Cloudflare Pages (push no GitHub → deploy automático)
- Nginx em VPS (`root /var/www/syncsheet/dist;` + `try_files $uri /index.html;`)
- Hostinger / EasyPanel (apontar para `dist/`)

## Estrutura

```
src/
├── components/    # AppLayout, WelcomeScreen + shadcn/ui
├── contexts/      # AppContext (estado global)
├── pages/         # Dashboard, Clientes, Produtos, ... DRE
├── types/         # Tipos do domínio
├── utils/
│   ├── excel.ts       # readExcel / writeExcel
│   ├── formatters.ts  # parseLocalDate, todayISO, etc.
│   └── sync.ts        # syncAll: regras bidirecionais Venda↔CR, CP↔Mov, DRE
└── App.tsx
```

## Licença

Proprietária — SyncSheet © 2026.
