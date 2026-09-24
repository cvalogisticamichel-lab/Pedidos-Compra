# 🌿 Pedidos de Compra — Cheiro Verde Ambiental

Sistema web (site + app instalável no celular) para **solicitação e aprovação de pedidos de compra por alçada**, com **dashboard de gestores**.

> Versão inicial (MVP) pronta para publicar no GitHub Pages. Os dados ficam salvos no navegador — ideal para validar o fluxo. Para uso real com toda a equipe, conecte um banco de dados (ver [Próximos passos](#próximos-passos)).

## Níveis de acesso e alçadas

| Nível | Perfil | Aprova sozinho até* | Acesso |
|---|---|---|---|
| 01 | Comprador | R$ 2.000,00 | Criar e acompanhar as próprias solicitações |
| 02 | Supervisor | R$ 10.000,00 | + Ver todas, aprovar/reprovar, Dashboard |
| 03 | Gerente | R$ 50.000,00 | + Configurações (limites e usuários) |
| — | Diretoria | acima do limite do Gerente | Pedido fica pendente “→ Diretoria” |

\* Valores de exemplo. Altere em **Configurações** (logado como Gerente) ou em `js/config.js`.

**Regra do fluxo:** ao enviar, o sistema soma os itens. Se o total couber na alçada de quem solicitou, o pedido é **aprovado automaticamente**. Se não, vai para o **menor nível** cuja alçada cobre o valor. Qualquer usuário daquele nível (ou acima) pode aprovar/reprovar. Reprovação exige motivo. Pedidos aprovados podem ser marcados como **Comprado**. Tudo fica registrado no histórico.

Status: `Pendente` → `Aprovado` → `Comprado` (ou `Reprovado` / `Cancelado`).

## Acessos de demonstração (senha `1234`)

- `comprador@cheiroverde.com.br` — Nível 01
- `supervisor@cheiroverde.com.br` — Nível 02
- `gerente@cheiroverde.com.br` — Nível 03

## Publicar no GitHub Pages

1. Crie um repositório (ex.: `pedidos-compra`) e envie todos os arquivos desta pasta.
   ```bash
   git init && git add . && git commit -m "Pedidos de Compra v1"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/pedidos-compra.git
   git push -u origin main
   ```
2. No GitHub: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
3. Em ~1 minuto o site estará em `https://SEU-USUARIO.github.io/pedidos-compra/`.

**Instalar como app:** no celular, abra o link e use “Adicionar à tela inicial” (Android/Chrome instala direto; iPhone: Safari → Compartilhar → Adicionar à Tela de Início).

Para testar localmente: `python3 -m http.server 8000` e abra `http://localhost:8000`.

## Estrutura

```
index.html              página única (SPA)
css/style.css           identidade visual (cores em :root)
js/config.js            níveis, limites, filiais, centros de custo, categorias
js/store.js             camada de dados e regras de alçada  ← trocar pelo backend
js/app.js               telas: login, início, nova, solicitações, aprovações, dashboard, configurações
assets/logo.svg         logo provisório — substitua pelo oficial
assets/icon-*.png       ícones do app
manifest.webmanifest    configuração do app instalável (PWA)
sw.js                   funcionamento offline
docs/supabase-schema.sql  esquema de banco sugerido para produção
```

## Personalizar a identidade visual

- **Logo:** substitua `assets/logo.svg` pelo logo oficial (pode ser `.png`; ajuste o nome em `js/app.js`). Na barra lateral e no login o logo é exibido em branco automaticamente.
- **Cores:** edite as variáveis no topo de `css/style.css` (`--verde-700` principal, `--laranja` destaque — `#ff9302`, usado no site oficial).
- **Ícones do app:** substitua `assets/icon-192.png` e `assets/icon-512.png`.

## Dashboard de gestores

A tela **Dashboard** (Níveis 02 e 03) mostra: total solicitado, aprovado, pendente, taxa de aprovação, tempo médio de decisão, valor por mês, por centro de custo, uso das alçadas, principais fornecedores e pendentes mais antigas — com filtros de período, filial e centro de custo.

Os botões **Exportar CSV/JSON** geram a base para Power BI / Excel / Google Data Studio. Em produção, use a view `vw_dashboard_compras` do arquivo `docs/supabase-schema.sql`.

## Próximos passos

⚠️ **Importante:** nesta versão os usuários, senhas e pedidos ficam no navegador de cada pessoa (localStorage). Serve para demonstrar e validar o fluxo, mas **não é seguro nem compartilhado** entre usuários.

Para produção:
1. Criar um projeto no [Supabase](https://supabase.com) (gratuito para começar) e rodar `docs/supabase-schema.sql`.
2. Trocar o login por Supabase Auth (e-mail corporativo).
3. Reescrever as funções de `js/store.js` para ler/gravar no banco (a interface não precisa mudar).
4. Levar a regra de aprovação para uma função no banco (RPC) + Row Level Security, para que o limite de alçada seja validado no servidor.
5. Opcional: notificações por e-mail/WhatsApp quando houver pedido aguardando aprovação; anexar orçamentos (PDF) via Supabase Storage.
