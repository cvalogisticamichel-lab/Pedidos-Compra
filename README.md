# 🌿 Pedidos de Compra — Cheiro Verde Ambiental

Sistema web (site + app instalável no celular) para **solicitação e aprovação de pedidos de compra por alçada**, com **dashboard de gestores**.

> **v2:** integração com **Google Planilhas + Google Drive** (orçamentos, cadastro de itens e fornecedores, histórico de preços). Sem configurar, o sistema roda em **modo demonstração** (dados só no navegador). Para ligar ao Google, siga o **GUIA-GOOGLE.txt**.

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
index.html                 página única (SPA)
css/style.css              identidade visual (cores em :root)
js/config.js               apiUrl do Google, filiais, centros de custo, categorias
js/engine.js               regras de negócio (alçadas, compras, preços) — mesmas do servidor
js/store.js                camada de dados: modo Google (Apps Script) ou demonstração
js/app.js                  telas
google-apps-script/        backend: Codigo.gs + Engine.gs (cópia do js/engine.js)
GUIA-GOOGLE.txt            passo a passo da integração
assets/                    logo e ícones do app
manifest.webmanifest, sw.js   app instalável (PWA)
```

## Novidades da v2

- **Orçamentos no Drive:** anexe PDF/foto/planilha em cada pedido; subpasta por pedido; destaque do menor valor.
- **Cadastro de itens** (código IT-0001) e **fornecedores** (CNPJ, contato, categorias).
- **Histórico de preços** automático ao marcar "Comprado"; a nova solicitação sugere o último preço e alerta preços >10% acima da média.
- **Aba Painel** na planilha para o dashboard de gestores (pronta para Looker Studio).
- **Alterar senha** (clique nas iniciais) e senhas guardadas com hash.
- Regras de alçada validadas no servidor (Apps Script), não só no navegador.

## Personalizar a identidade visual

- **Logo:** substitua `assets/logo.svg` pelo logo oficial (pode ser `.png`; ajuste o nome em `js/app.js`). Na barra lateral e no login o logo é exibido em branco automaticamente.
- **Cores:** edite as variáveis no topo de `css/style.css` (`--verde-700` principal, `--laranja` destaque — `#ff9302`, usado no site oficial).
- **Ícones do app:** substitua `assets/icon-192.png` e `assets/icon-512.png`.

## Dashboard de gestores

A tela **Dashboard** (Níveis 02 e 03) mostra: total solicitado, aprovado, pendente, taxa de aprovação, tempo médio de decisão, valor por mês, por centro de custo, uso das alçadas, principais fornecedores e pendentes mais antigas — com filtros de período, filial e centro de custo.

Os botões **Exportar CSV/JSON** geram a base para Power BI / Excel. No modo Google, a aba **Painel** da planilha já traz os resumos e pode ser conectada ao Looker Studio.

## Segurança

- No modo Google, a regra de alçada é validada no servidor e as senhas ficam com hash SHA-256 + salt na aba Usuarios (coluna oculta).
- Sessões expiram em 6 horas.
- Troque a senha `1234` dos usuários de demonstração no primeiro acesso.
