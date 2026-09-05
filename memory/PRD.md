# CrediFlux — Gestão de Empréstimos Pessoais

## Problema
Criar um app para gerenciar clientes de empréstimo de dinheiro, com nome, datas de pagamento, forma de cobrança e atualização quando efetuarem pagamento.

## Escolhas do usuário
- Auth: JWT (email/senha), acesso privado
- Campos completos do cliente
- Cobrança: à vista OU parcelada, configurável por cliente
- Alertas visuais no app (sem envio externo)
- Tema: azul e preto (dark)

## Arquitetura
- Backend: FastAPI + Motor (Mongo async), bcrypt + PyJWT em httpOnly cookies (samesite=none, secure)
- Frontend: React 19 + React Router + Shadcn UI + Tailwind + Sonner (toasts)
- DB: `users`, `clients` (com `installments` embutidas), `login_attempts` (brute-force)

## Implementado (2026-02)
- Login/Logout/Me com httpOnly cookies + lockout de 5 tentativas / 15min
- CRUD de clientes com regeneração automática do cronograma quando termos mudam (preservando parcelas pagas)
- Registro e reversão de pagamentos (PIX, dinheiro, transferência, cartão, outro)
- Cálculo de status por cliente: `pago`, `pendente`, `a_vencer` (≤3 dias), `atrasado`
- Dashboard: total emprestado, recebido, saldo pendente, contagem de atrasados e a vencer
- Banner de alertas + filtro rápido por status
- Detalhes do cliente com linha do tempo de parcelas
- Link direto para WhatsApp a partir do telefone
- Design "Performance Financial Command Center" (azul & preto, glassmorphism, JetBrains Mono para números)

## Personas
- Titular (admin único): Janinne — gerencia todos os empréstimos

## Backlog (P1/P2)
- P1: Notificações por email (Resend) ou WhatsApp (Twilio) para pagamentos próximos/atrasados
- P1: Exportar relatório (CSV/PDF) de recebimentos por período
- P2: Gráfico de fluxo (Recharts) — entradas × saídas mensais
- P2: Múltiplos usuários / equipe
- P2: Recibo digital compartilhável por link após pagamento
- P2: Histórico de alterações por cliente (audit log)

## Credenciais de teste
Ver `/app/memory/test_credentials.md`
