# Norte — Prioridades pessoais

## Aplicação online
- Preview operacional: https://id-preview--59ac8cb3-6e49-4083-9f72-bfd5a1c7be85.lovable.app
- Produção solicitada: https://norte-prioridades.lovable.app

Aplicação pessoal e responsiva para organizar prioridades em quatro horizontes: **Hoje, Semana, Mês e Semestre**.

## Lógica
Cada atividade recebe:
- horizonte;
- importância de 1 a 4;
- esforço de 1 a 3;
- prazo;
- status Kanban.

O painel calcula um **foco recomendado** combinando importância, proximidade do prazo, horizonte e esforço. O objetivo não é encher a agenda: é deixar evidente o que merece atenção primeiro.

## Fluxo Kanban
1. Pode esperar
2. Planejar
3. Fazer agora
4. Concluído

## Segurança
Os dados ficam no Supabase, não no GitHub. O banco usa Supabase Auth + Row Level Security, limitando cada linha ao usuário autenticado.

No frontend, use somente a **publishable key** (ou anon key legada). Nunca use service_role ou secret key.

## Configuração
1. Crie um projeto Supabase dedicado.
2. Execute `schema.sql` no SQL Editor.
3. Em Authentication, crie seu usuário.
4. Copie `config.example.js` para `config.js`.
5. Preencha URL + publishable key do projeto.
6. Hospede a pasta por GitHub Pages, Vercel ou outro host estático.

## Realtime
O app assina alterações de `public.priorities` por `postgres_changes`, filtrando pelo `user_id` autenticado.

## Próximas evoluções
- calendário;
- recorrência;
- revisão semanal guiada;
- metas por área da vida;
- notificações;
- modo PWA;
- histórico de produtividade;
- captura rápida pelo celular.

> O app foi pensado para continuar leve: poucas decisões, leitura rápida e foco nas próximas ações.
