/* ==========================================================
   MOTOR DE REGRAS — Cheiro Verde Ambiental | Pedidos de Compra
   Este MESMO arquivo roda em dois lugares:
     1) no navegador (modo demonstração, dados no localStorage);
     2) no Google Apps Script (copie-o como "Engine.gs").
   Assim a regra de alçada é validada no servidor em produção.
   Trabalha com tabelas "planas" — cada tabela vira uma aba da planilha.
   ========================================================== */
var CVEngine = (function () {
  'use strict';

  // Cada chave = nome da aba na planilha; valores = colunas (ordem da planilha)
  var TABELAS = {
    Solicitacoes: ['id', 'numero', 'criadoEm', 'solicitanteId', 'solicitanteNome', 'nivelSolicitante', 'filial', 'centroCusto', 'categoria', 'fornecedor', 'urgencia', 'dataNecessidade', 'justificativa', 'total', 'nivelNecessario', 'status', 'aprovadorId', 'aprovadorNome', 'nivelAprovador', 'decididoEm', 'compradoEm', 'fornecedorFinal'],
    Itens_Solicitacao: ['solicitacaoId', 'numero', 'seq', 'itemId', 'descricao', 'qtd', 'unidade', 'valorUnit', 'subtotal'],
    Historico: ['solicitacaoId', 'numero', 'em', 'usuario', 'acao', 'obs'],
    Orcamentos: ['id', 'solicitacaoId', 'numero', 'fornecedor', 'valor', 'arquivoNome', 'arquivoUrl', 'enviadoPor', 'em'],
    Itens: ['id', 'codigo', 'descricao', 'unidade', 'categoria', 'fornecedorPreferido', 'ultimoPreco', 'ultimaCompra', 'ativo', 'criadoEm'],
    Fornecedores: ['id', 'nome', 'cnpj', 'contato', 'telefone', 'email', 'cidade', 'categorias', 'ativo', 'criadoEm', 'nomeFantasia', 'endereco', 'uf', 'cep', 'situacao', 'atividade', 'inscricaoEstadual'],
    Listas: ['filial', 'centroCusto', 'categoria', 'unidade'],
    Historico_Precos: ['em', 'itemId', 'codigo', 'descricao', 'fornecedor', 'unidade', 'qtd', 'valorUnit', 'numero', 'solicitacaoId'],
    Usuarios: ['id', 'nome', 'email', 'senhaHash', 'nivel', 'filial', 'ativo', 'criadoEm'],
    Config: ['chave', 'valor']
  };
  // Tipos para conversão ao ler/gravar na planilha
  var NUMEROS = ['nivelSolicitante', 'total', 'nivelNecessario', 'nivelAprovador', 'seq', 'qtd', 'valorUnit', 'subtotal', 'valor', 'ultimoPreco', 'nivel'];
  var DATAS = ['criadoEm', 'decididoEm', 'compradoEm', 'em', 'ultimaCompra'];
  var BOOLEANOS = ['ativo'];
  var TEXTOS = ['numero', 'dataNecessidade', 'cnpj', 'telefone', 'codigo', 'senhaHash', 'chave', 'cep', 'filial', 'centroCusto', 'categoria', 'unidade', 'inscricaoEstadual'];

  var PADRAO = { limites: { 1: 2000, 2: 10000, 3: 50000 } };
  var NOMES = { 1: 'Comprador', 2: 'Supervisor', 3: 'Gerente', 4: 'Diretoria' };
  // Valores iniciais da aba "Listas" (base de dados das listas de validação)
  var LISTAS_PADRAO = {
    filial: ['Bernardino de Campos (Matriz)', 'Assis', 'São Manuel', 'Botucatu'],
    centroCusto: ['Operações - Coleta', 'Frota e Manutenção', 'Tratamento de Resíduos', 'Segurança do Trabalho', 'Administrativo', 'TI', 'Comercial'],
    categoria: ['EPI', 'Materiais de consumo', 'Embalagens e coletores', 'Peças e manutenção', 'Combustível', 'Equipamentos', 'Serviços', 'TI', 'Escritório'],
    unidade: ['un', 'cx', 'pct', 'kg', 'L', 'm', 'serv', 'h']
  };
  var TIPOS_LISTA = { filial: 'Filial', centroCusto: 'Centro de custo', categoria: 'Categoria', unidade: 'Unidade' };

  // ---------- utilidades ----------
  function agora() { return new Date().toISOString(); }
  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function txt(s) { return String(s == null ? '' : s).trim(); }
  function norm(s) { return txt(s).toLowerCase().replace(/\s+/g, ' '); }
  function erro(m) { throw new Error(m); }
  function sujar(db) { db._dirty = db._dirty || {}; for (var i = 1; i < arguments.length; i++) db._dirty[arguments[i]] = true; }
  function pad(n, t) { n = String(n); while (n.length < t) n = '0' + n; return n; }
  function agrupar(arr, k) { var o = {}; arr.forEach(function (x) { (o[x[k]] = o[x[k]] || []).push(x); }); return o; }
  function porId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }

  function novoDb() { var db = {}; Object.keys(TABELAS).forEach(function (t) { db[t] = []; }); return db; }

  function cfg(db, k, d) { for (var i = 0; i < db.Config.length; i++) if (db.Config[i].chave === k) return db.Config[i].valor; return d; }
  function setCfg(db, k, v) {
    for (var i = 0; i < db.Config.length; i++) if (db.Config[i].chave === k) { db.Config[i].valor = v; sujar(db, 'Config'); return; }
    db.Config.push({ chave: k, valor: v }); sujar(db, 'Config');
  }
  function proximo(db, chave) { var n = (Number(cfg(db, chave, 0)) || 0) + 1; setCfg(db, chave, n); return n; }

  function limites(db) {
    return {
      1: Number(cfg(db, 'limite_1', PADRAO.limites[1])),
      2: Number(cfg(db, 'limite_2', PADRAO.limites[2])),
      3: Number(cfg(db, 'limite_3', PADRAO.limites[3]))
    };
  }
  function nivelNecessario(lim, total) { for (var n = 1; n <= 3; n++) if (total <= Number(lim[n])) return n; return 4; }
  function podeAprovar(u, r) { return !!u && r.status === 'pendente' && Number(r.nivelNecessario) <= Number(u.nivel) && Number(r.nivelNecessario) <= 3; }
  function publico(u) { return { id: u.id, nome: u.nome, email: u.email, nivel: Number(u.nivel), filial: u.filial, ativo: u.ativo !== false }; }
  function hist(db, r, usuario, acao, obs, em) {
    db.Historico.push({ solicitacaoId: r.id, numero: r.numero, em: em || agora(), usuario: usuario, acao: acao, obs: txt(obs) });
    sujar(db, 'Historico');
  }
  function itemPorDescricao(db, d) { var n = norm(d); for (var i = 0; i < db.Itens.length; i++) if (norm(db.Itens[i].descricao) === n) return db.Itens[i]; return null; }
  function fornPorNome(db, nome) { var n = norm(nome); for (var i = 0; i < db.Fornecedores.length; i++) if (norm(db.Fornecedores[i].nome) === n) return db.Fornecedores[i]; return null; }

  // ---------- listas (aba Listas: uma coluna por lista) ----------
  function linhasListasPadrao() {
    var max = 0, rows = [];
    Object.keys(LISTAS_PADRAO).forEach(function (k) { max = Math.max(max, LISTAS_PADRAO[k].length); });
    for (var i = 0; i < max; i++) {
      var r = {}; Object.keys(LISTAS_PADRAO).forEach(function (k) { r[k] = LISTAS_PADRAO[k][i] || ''; }); rows.push(r);
    }
    return rows;
  }
  function listas(db) {
    var out = {};
    Object.keys(TIPOS_LISTA).forEach(function (k) {
      var vistos = {}, l = [];
      (db.Listas || []).forEach(function (r) { var v = txt(r[k]); if (v && !vistos[norm(v)]) { vistos[norm(v)] = 1; l.push(v); } });
      out[k] = l.length ? l : LISTAS_PADRAO[k].slice();
    });
    return out;
  }
  function addLista(db, tipo, valor) {
    if (!TIPOS_LISTA[tipo]) erro('Lista inválida.');
    valor = txt(valor); if (!valor) erro('Informe o valor.');
    db.Listas = db.Listas || [];
    if (!db.Listas.some(function (r) { return txt(r[tipo]); })) { // coluna vazia usa o padrão: grava o padrão antes
      LISTAS_PADRAO[tipo].forEach(function (v, i) { if (!db.Listas[i]) db.Listas[i] = { filial: '', centroCusto: '', categoria: '', unidade: '' }; db.Listas[i][tipo] = v; });
    }
    if (listas(db)[tipo].some(function (v) { return norm(v) === norm(valor); })) erro('"' + valor + '" já existe na lista de ' + TIPOS_LISTA[tipo] + '.');
    var livre = null;
    for (var i = 0; i < db.Listas.length; i++) if (!txt(db.Listas[i][tipo])) { livre = db.Listas[i]; break; }
    if (livre) livre[tipo] = valor;
    else { var r = { filial: '', centroCusto: '', categoria: '', unidade: '' }; r[tipo] = valor; db.Listas.push(r); }
    sujar(db, 'Listas');
  }
  function removeLista(db, tipo, valor) {
    if (!TIPOS_LISTA[tipo]) erro('Lista inválida.');
    db.Listas = db.Listas || [];
    var vals = listas(db)[tipo].filter(function (v) { return norm(v) !== norm(valor); });
    if (!vals.length) erro('A lista precisa ter ao menos um valor.');
    // reescreve a coluna compactada (sem buracos)
    var n = Math.max(db.Listas.length, vals.length);
    for (var i = 0; i < n; i++) {
      if (!db.Listas[i]) db.Listas[i] = { filial: '', centroCusto: '', categoria: '', unidade: '' };
      db.Listas[i][tipo] = vals[i] || '';
    }
    db.Listas = db.Listas.filter(function (r) { return Object.keys(TIPOS_LISTA).some(function (k) { return txt(r[k]); }); });
    sujar(db, 'Listas');
  }

  // ---------- CPF / CNPJ ----------
  function digitos(s) { return String(s || '').replace(/\D/g, ''); }
  function cnpjValido(c) {
    c = digitos(c); if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    var calc = function (n) { var s = 0, p = n - 7; for (var i = 0; i < n; i++) { s += c[i] * p--; if (p < 2) p = 9; } var r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === +c[12] && calc(13) === +c[13];
  }
  function cpfValido(c) {
    c = digitos(c); if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    for (var t = 9; t < 11; t++) { var s = 0; for (var i = 0; i < t; i++) s += c[i] * (t + 1 - i); var d = ((10 * s) % 11) % 10; if (+c[t] !== d) return false; }
    return true;
  }
  function formatarDoc(s) {
    var d = digitos(s);
    if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return txt(s);
  }
  function titulo(s) { return txt(s).toLowerCase().replace(/(^|\s)\S/g, function (m) { return m.toUpperCase(); }).replace(/ (De|Da|Do|Das|Dos|E) /g, function (m) { return m.toLowerCase(); }); }
  function fmtTel(t) {
    t = digitos(t);
    return /^\d{10,11}$/.test(t) ? '(' + t.slice(0, 2) + ') ' + t.slice(2, t.length - 4) + '-' + t.slice(-4) : t;
  }
  /** Converte a resposta da CNPJá (open), BrasilAPI ou ReceitaWS para um formato único */
  function normalizarCnpj(j) {
    if (!j) erro('CNPJ não encontrado.');
    if (j.status === 'ERROR') erro(j.message || 'CNPJ não encontrado.');
    if (j.taxId || j.company) { // CNPJá
      var a = j.address || {}, ie = '';
      var regs = (j.registrations || []).filter(function (r) { return r && r.number; });
      var r1 = regs.filter(function (r) { return r.enabled !== false && (!a.state || r.state === a.state); })[0] || regs[0];
      if (r1) ie = txt(r1.number);
      var ph = (j.phones || [])[0];
      return {
        cnpj: formatarDoc(j.taxId), razaoSocial: txt(j.company && j.company.name), nomeFantasia: txt(j.alias),
        situacao: txt(j.status && j.status.text).toUpperCase(),
        endereco: [a.street, a.number, a.details, a.district].map(txt).filter(Boolean).join(', '),
        cidade: txt(a.city), uf: txt(a.state).toUpperCase(), cep: txt(a.zip),
        telefone: ph ? fmtTel(txt(ph.area) + txt(ph.number)) : '', email: txt(((j.emails || [])[0] || {}).address).toLowerCase(),
        atividade: txt(j.mainActivity && j.mainActivity.text), inscricaoEstadual: ie
      };
    }
    var tel = j.ddd_telefone_1 ? fmtTel(j.ddd_telefone_1) : txt(j.telefone);
    var ativ = j.cnae_fiscal_descricao || (j.atividade_principal && j.atividade_principal[0] && j.atividade_principal[0].text) || '';
    return {
      cnpj: formatarDoc(j.cnpj), razaoSocial: txt(j.razao_social || j.nome), nomeFantasia: txt(j.nome_fantasia || j.fantasia),
      situacao: txt(j.descricao_situacao_cadastral || j.situacao).toUpperCase(),
      endereco: [j.logradouro, j.numero, j.complemento, j.bairro].map(txt).filter(Boolean).join(', '),
      cidade: titulo(j.municipio), uf: txt(j.uf).toUpperCase(), cep: txt(j.cep),
      telefone: tel, email: txt(j.email).toLowerCase(), atividade: txt(ativ), inscricaoEstadual: ''
    };
  }

  // ---------- estado entregue à interface ----------
  function estado(db, u, extra) {
    var itensBy = agrupar(db.Itens_Solicitacao, 'solicitacaoId');
    var histBy = agrupar(db.Historico, 'solicitacaoId');
    var orcBy = agrupar(db.Orcamentos, 'solicitacaoId');
    var reqs = db.Solicitacoes
      .filter(function (r) { return Number(u.nivel) >= 2 || r.solicitanteId === u.id; })
      .map(function (r) {
        var o = {}; for (var k in r) o[k] = r[k];
        o.itens = (itensBy[r.id] || []).slice().sort(function (a, b) { return a.seq - b.seq; });
        o.historico = (histBy[r.id] || []).slice().sort(function (a, b) { return String(a.em).localeCompare(String(b.em)); });
        o.orcamentos = (orcBy[r.id] || []).slice();
        return o;
      })
      .sort(function (a, b) { return String(b.criadoEm).localeCompare(String(a.criadoEm)); });
    var precos = db.Historico_Precos.slice().sort(function (a, b) { return String(b.em).localeCompare(String(a.em)); }).slice(0, 3000);
    return {
      user: publico(u),
      limites: limites(db),
      requests: reqs,
      users: Number(u.nivel) >= 3 ? db.Usuarios.map(publico) : [],
      listas: listas(db),
      catalogo: db.Itens.slice().sort(function (a, b) { return String(a.descricao).localeCompare(String(b.descricao)); }),
      fornecedores: db.Fornecedores.slice().sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); }),
      precos: precos,
      extra: extra || {}
    };
  }

  // ---------- operações internas ----------
  function criar(db, u, d, ctx, em) {
    em = em || agora();
    if (!txt(d.centroCusto)) erro('Informe o centro de custo.');
    if (!txt(d.categoria)) erro('Informe a categoria.');
    if (!txt(d.justificativa)) erro('Informe o motivo da compra.');
    var itens = (d.itens || []).map(function (i) {
      return { itemId: txt(i.itemId), descricao: txt(i.descricao), unidade: txt(i.unidade) || 'un', qtd: Number(i.qtd) || 0, valorUnit: r2(i.valorUnit) };
    }).filter(function (i) { return i.descricao && i.qtd > 0; });
    if (!itens.length) erro('Inclua ao menos um item com descrição e quantidade.');
    var total = r2(itens.reduce(function (s, i) { return s + i.qtd * i.valorUnit; }, 0));
    if (total <= 0) erro('O valor total precisa ser maior que zero.');
    var ano = em.slice(0, 4);
    var r = {
      id: ctx.uuid(), numero: 'PC-' + ano + '-' + pad(proximo(db, 'seq_pedido'), 4), criadoEm: em,
      solicitanteId: u.id, solicitanteNome: u.nome, nivelSolicitante: Number(u.nivel),
      filial: txt(d.filial) || u.filial, centroCusto: txt(d.centroCusto), categoria: txt(d.categoria),
      fornecedor: txt(d.fornecedor), urgencia: txt(d.urgencia), dataNecessidade: txt(d.dataNecessidade),
      justificativa: txt(d.justificativa), total: total, nivelNecessario: nivelNecessario(limites(db), total),
      status: 'pendente', aprovadorId: '', aprovadorNome: '', nivelAprovador: '', decididoEm: '', compradoEm: '', fornecedorFinal: ''
    };
    db.Solicitacoes.push(r);
    itens.forEach(function (i, k) {
      if (!i.itemId) { var c = itemPorDescricao(db, i.descricao); if (c) i.itemId = c.id; }
      db.Itens_Solicitacao.push({ solicitacaoId: r.id, numero: r.numero, seq: k + 1, itemId: i.itemId, descricao: i.descricao, qtd: i.qtd, unidade: i.unidade, valorUnit: i.valorUnit, subtotal: r2(i.qtd * i.valorUnit) });
    });
    sujar(db, 'Solicitacoes', 'Itens_Solicitacao');
    hist(db, r, u.nome, 'Solicitação criada', '', em);
    if (r.nivelNecessario <= Number(u.nivel)) {
      r.status = 'aprovado'; r.aprovadorId = u.id; r.aprovadorNome = u.nome; r.nivelAprovador = Number(u.nivel); r.decididoEm = em;
      hist(db, r, u.nome, 'Aprovado dentro da própria alçada', '', em);
    } else {
      hist(db, r, 'Sistema', 'Encaminhado para aprovação: ' + NOMES[r.nivelNecessario], '', em);
    }
    return r;
  }

  function decidir(db, r, u, aprovar, obs, em) {
    if (!podeAprovar(u, r)) erro('Você não tem alçada para decidir esta solicitação.');
    if (!aprovar && !txt(obs)) erro('Informe o motivo da reprovação.');
    em = em || agora();
    r.status = aprovar ? 'aprovado' : 'reprovado';
    r.aprovadorId = u.id; r.aprovadorNome = u.nome; r.nivelAprovador = Number(u.nivel); r.decididoEm = em;
    sujar(db, 'Solicitacoes');
    hist(db, r, u.nome, aprovar ? 'Aprovado' : 'Reprovado', obs, em);
  }

  function comprar(db, r, u, fornecedor, obs, ctx, em) {
    if (r.status !== 'aprovado') erro('Apenas pedidos aprovados podem ser marcados como comprados.');
    em = em || agora();
    var forn = txt(fornecedor) || r.fornecedor;
    r.status = 'comprado'; r.compradoEm = em; r.fornecedorFinal = forn;
    sujar(db, 'Solicitacoes', 'Itens', 'Historico_Precos');
    if (forn && !fornPorNome(db, forn)) {
      db.Fornecedores.push({ id: ctx.uuid(), nome: forn, cnpj: '', contato: '', telefone: '', email: '', cidade: '', categorias: r.categoria, ativo: true, criadoEm: em });
      sujar(db, 'Fornecedores');
    }
    db.Itens_Solicitacao.filter(function (i) { return i.solicitacaoId === r.id; }).forEach(function (i) {
      var c = (i.itemId && porId(db.Itens, i.itemId)) || itemPorDescricao(db, i.descricao);
      if (!c) {
        c = { id: ctx.uuid(), codigo: 'IT-' + pad(proximo(db, 'seq_item'), 4), descricao: i.descricao, unidade: i.unidade, categoria: r.categoria, fornecedorPreferido: forn, ultimoPreco: '', ultimaCompra: '', ativo: true, criadoEm: em };
        db.Itens.push(c);
      }
      if (!i.itemId) { i.itemId = c.id; sujar(db, 'Itens_Solicitacao'); }
      c.ultimoPreco = i.valorUnit; c.ultimaCompra = em;
      if (!c.fornecedorPreferido) c.fornecedorPreferido = forn;
      db.Historico_Precos.push({ em: em, itemId: c.id, codigo: c.codigo, descricao: c.descricao, fornecedor: forn, unidade: i.unidade, qtd: i.qtd, valorUnit: i.valorUnit, numero: r.numero, solicitacaoId: r.id });
    });
    hist(db, r, u.nome, 'Compra efetivada' + (forn ? ' — ' + forn : ''), obs, em);
  }

  function exigir(u, nivel) { if (Number(u.nivel) < nivel) erro('Seu nível de acesso não permite esta ação.'); }
  function getReq(db, id) { var r = porId(db.Solicitacoes, id); if (!r) erro('Solicitação não encontrada.'); return r; }

  // ---------- ações públicas (chamadas pela interface) ----------
  function handle(db, action, p, u, ctx) {
    p = p || {};
    var extra = {};
    switch (action) {
      case 'state': break;

      case 'createRequest': {
        var r = criar(db, u, p.data || {}, ctx);
        extra.criado = { id: r.id, numero: r.numero, status: r.status, nivelNecessario: r.nivelNecessario };
        break;
      }
      case 'decide': decidir(db, getReq(db, p.id), u, !!p.aprovar, p.obs); break;
      case 'cancel': {
        var rc = getReq(db, p.id);
        if (rc.status !== 'pendente' || (rc.solicitanteId !== u.id && Number(u.nivel) < 3)) erro('Não é possível cancelar esta solicitação.');
        rc.status = 'cancelado'; sujar(db, 'Solicitacoes'); hist(db, rc, u.nome, 'Cancelado', p.obs);
        break;
      }
      case 'markPurchased': comprar(db, getReq(db, p.id), u, p.fornecedor, p.obs, ctx); break;

      case 'addOrcamento': {
        var ro = getReq(db, p.solicitacaoId);
        if (ro.solicitanteId !== u.id && Number(u.nivel) < 2) erro('Somente o solicitante ou um aprovador pode anexar orçamentos.');
        if (!txt(p.arquivoUrl)) erro('Arquivo não recebido.');
        db.Orcamentos.push({ id: ctx.uuid(), solicitacaoId: ro.id, numero: ro.numero, fornecedor: txt(p.fornecedor), valor: r2(p.valor), arquivoNome: txt(p.arquivoNome), arquivoUrl: txt(p.arquivoUrl), enviadoPor: u.nome, em: agora() });
        sujar(db, 'Orcamentos');
        hist(db, ro, u.nome, 'Orçamento anexado' + (txt(p.fornecedor) ? ' — ' + txt(p.fornecedor) : ''), '');
        break;
      }
      case 'removeOrcamento': {
        var o = porId(db.Orcamentos, p.id); if (!o) erro('Orçamento não encontrado.');
        if (o.enviadoPor !== u.nome && Number(u.nivel) < 2) erro('Sem permissão para remover.');
        db.Orcamentos.splice(db.Orcamentos.indexOf(o), 1); sujar(db, 'Orcamentos');
        var rr = porId(db.Solicitacoes, o.solicitacaoId); if (rr) hist(db, rr, u.nome, 'Orçamento removido — ' + o.arquivoNome, '');
        break;
      }

      case 'saveItem': {
        var d = p.item || {};
        if (!txt(d.descricao)) erro('Informe a descrição do item.');
        var dup = itemPorDescricao(db, d.descricao);
        if (dup && dup.id !== d.id) erro('Já existe um item com esta descrição (' + dup.codigo + ').');
        if (d.id) {
          var it = porId(db.Itens, d.id); if (!it) erro('Item não encontrado.');
          it.descricao = txt(d.descricao); it.unidade = txt(d.unidade) || 'un'; it.categoria = txt(d.categoria); it.fornecedorPreferido = txt(d.fornecedorPreferido);
          extra.salvo = it;
        } else {
          var novo = { id: ctx.uuid(), codigo: 'IT-' + pad(proximo(db, 'seq_item'), 4), descricao: txt(d.descricao), unidade: txt(d.unidade) || 'un', categoria: txt(d.categoria), fornecedorPreferido: txt(d.fornecedorPreferido), ultimoPreco: '', ultimaCompra: '', ativo: true, criadoEm: agora() };
          db.Itens.push(novo); extra.salvo = novo;
        }
        sujar(db, 'Itens');
        break;
      }
      case 'toggleItem': { exigir(u, 2); var ti = porId(db.Itens, p.id); if (ti) { ti.ativo = !(ti.ativo !== false); sujar(db, 'Itens'); } break; }

      case 'saveFornecedor': {
        var f = p.fornecedor || {};
        if (!txt(f.nome)) erro('Informe a razão social do fornecedor.');
        var fd = fornPorNome(db, f.nome);
        if (fd && fd.id !== f.id) erro('Já existe um fornecedor com este nome.');
        var doc = digitos(f.cnpj);
        if (doc) {
          if (doc.length === 14 ? !cnpjValido(doc) : doc.length === 11 ? !cpfValido(doc) : true) erro('CNPJ/CPF inválido. Confira os números.');
          var fdoc = db.Fornecedores.filter(function (x) { return digitos(x.cnpj) === doc && x.id !== f.id; })[0];
          if (fdoc) erro('Este CNPJ/CPF já está cadastrado para "' + fdoc.nome + '".');
        }
        var campos = { nome: txt(f.nome), cnpj: formatarDoc(doc), contato: txt(f.contato), telefone: txt(f.telefone), email: txt(f.email), cidade: txt(f.cidade), categorias: txt(f.categorias),
          nomeFantasia: txt(f.nomeFantasia), endereco: txt(f.endereco), uf: txt(f.uf).toUpperCase(), cep: txt(f.cep), situacao: txt(f.situacao), atividade: txt(f.atividade), inscricaoEstadual: txt(f.inscricaoEstadual) };
        var fx;
        if (f.id) { fx = porId(db.Fornecedores, f.id); if (!fx) erro('Fornecedor não encontrado.'); for (var k in campos) fx[k] = campos[k]; }
        else { fx = campos; campos.id = ctx.uuid(); campos.ativo = true; campos.criadoEm = agora(); db.Fornecedores.push(campos); }
        extra.salvo = fx;
        sujar(db, 'Fornecedores');
        break;
      }
      case 'toggleFornecedor': { exigir(u, 2); var tf = porId(db.Fornecedores, p.id); if (tf) { tf.ativo = !(tf.ativo !== false); sujar(db, 'Fornecedores'); } break; }

      case 'saveUser': {
        exigir(u, 3);
        var x = p.user || {}, email = norm(x.email);
        if (!txt(x.nome) || !email) erro('Nome e e-mail são obrigatórios.');
        if (db.Usuarios.some(function (y) { return norm(y.email) === email && y.id !== x.id; })) erro('Já existe um usuário com este e-mail.');
        var nv = Number(x.nivel); if (!(nv >= 1 && nv <= 3)) erro('Nível inválido.');
        if (x.id) {
          var ux = porId(db.Usuarios, x.id); if (!ux) erro('Usuário não encontrado.');
          ux.nome = txt(x.nome); ux.email = email; ux.nivel = nv; ux.filial = txt(x.filial);
          if (txt(x.senha)) ux.senhaHash = ctx.hash(txt(x.senha));
        } else {
          if (txt(x.senha).length < 4) erro('Defina uma senha inicial (mín. 4 caracteres).');
          db.Usuarios.push({ id: ctx.uuid(), nome: txt(x.nome), email: email, senhaHash: ctx.hash(txt(x.senha)), nivel: nv, filial: txt(x.filial), ativo: true, criadoEm: agora() });
        }
        sujar(db, 'Usuarios');
        break;
      }
      case 'toggleUser': { exigir(u, 3); var tu = porId(db.Usuarios, p.id); if (tu && tu.id !== u.id) { tu.ativo = !(tu.ativo !== false); sujar(db, 'Usuarios'); } break; }
      case 'saveLimites': {
        exigir(u, 3);
        var a = Number(p.limites[1]), b = Number(p.limites[2]), c = Number(p.limites[3]);
        if (!(a > 0 && b > a && c > b)) erro('Os limites devem ser crescentes: Comprador < Supervisor < Gerente.');
        setCfg(db, 'limite_1', a); setCfg(db, 'limite_2', b); setCfg(db, 'limite_3', c);
        break;
      }
      case 'changePassword': {
        if (u.senhaHash !== ctx.hash(txt(p.atual))) erro('Senha atual incorreta.');
        if (txt(p.nova).length < 6) erro('A nova senha precisa ter ao menos 6 caracteres.');
        u.senhaHash = ctx.hash(txt(p.nova)); sujar(db, 'Usuarios');
        extra.msg = 'Senha alterada.';
        break;
      }
      case 'addLista': exigir(u, 3); addLista(db, p.tipo, p.valor); extra.salvo = txt(p.valor); break;
      case 'removeLista': exigir(u, 3); removeLista(db, p.tipo, p.valor); break;
      default: erro('Ação desconhecida: ' + action);
    }
    return estado(db, u, extra);
  }

  function login(db, email, senha, ctx) {
    var e = norm(email), h = ctx.hash(txt(senha));
    for (var i = 0; i < db.Usuarios.length; i++) {
      var u = db.Usuarios[i];
      if (norm(u.email) === e && u.senhaHash === h && u.ativo !== false) return u;
    }
    return null;
  }

  // ---------- dados iniciais ----------
  var CATALOGO = [
    ['Luva nitrílica (caixa c/ 100)', 'cx', 'EPI', 'Proteção Total EPIs', 42, 60, 10, 60],
    ['Máscara PFF2', 'un', 'EPI', 'Proteção Total EPIs', 3, 5, 200, 800],
    ['Uniforme operacional completo', 'un', 'EPI', 'Proteção Total EPIs', 90, 140, 10, 40],
    ['Coletor perfurocortante 13L', 'un', 'Embalagens e coletores', 'Plastibras Embalagens', 8, 12, 100, 500],
    ['Bombona plástica 200L', 'un', 'Embalagens e coletores', 'Plastibras Embalagens', 180, 250, 4, 30],
    ['Contêiner 1000L', 'un', 'Embalagens e coletores', 'Plastibras Embalagens', 1500, 2100, 1, 6],
    ['Saco infectante branco 100L (pct c/ 100)', 'pct', 'Embalagens e coletores', 'Plastibras Embalagens', 85, 120, 5, 40],
    ['Pneu caminhão 295/80 R22.5', 'un', 'Peças e manutenção', 'Mega Pneus', 2200, 2800, 2, 6],
    ['Revisão e troca de óleo — frota', 'serv', 'Serviços', 'Auto Peças Paulista', 900, 1500, 1, 3],
    ['Diesel S10', 'L', 'Combustível', 'Posto Rodovia 225', 5.8, 6.4, 300, 1500],
    ['Manutenção preventiva autoclave', 'serv', 'Serviços', 'Hidromec Industrial', 7000, 14000, 1, 1],
    ['Calibração de balança rodoviária', 'serv', 'Serviços', 'Tecnocal Serviços', 1200, 3200, 1, 1],
    ['Notebook corporativo', 'un', 'TI', 'Dell Brasil', 4200, 5600, 1, 4],
    ['Papel A4 (caixa c/ 10 resmas)', 'cx', 'Escritório', 'Kalunga', 220, 290, 1, 6],
    ['Fragmentadora industrial de documentos', 'un', 'Equipamentos', 'Hidromec Industrial', 26000, 38000, 1, 1]
  ];
  var FORNECEDORES = [
    ['Proteção Total EPIs', 'Bauru', 'EPI'], ['Plastibras Embalagens', 'Marília', 'Embalagens e coletores'],
    ['Auto Peças Paulista', 'Ourinhos', 'Peças e manutenção; Serviços'], ['Mega Pneus', 'Ourinhos', 'Peças e manutenção'],
    ['Posto Rodovia 225', 'Bernardino de Campos', 'Combustível'], ['Hidromec Industrial', 'Botucatu', 'Serviços; Equipamentos'],
    ['Tecnocal Serviços', 'Assis', 'Serviços'], ['Dell Brasil', 'Eldorado do Sul', 'TI'], ['Kalunga', 'São Paulo', 'Escritório']
  ];
  var CC_POR_CAT = { 'EPI': 'Segurança do Trabalho', 'Embalagens e coletores': 'Operações - Coleta', 'Peças e manutenção': 'Frota e Manutenção', 'Combustível': 'Frota e Manutenção', 'Serviços': 'Tratamento de Resíduos', 'TI': 'TI', 'Escritório': 'Administrativo', 'Equipamentos': 'Tratamento de Resíduos' };

  function seed(ctx, opcoes) {
    opcoes = opcoes || {};
    var db = novoDb(), em = agora();
    var filiais = opcoes.filiais || ['Bernardino de Campos (Matriz)', 'Assis', 'São Manuel', 'Botucatu'];
    setCfg(db, 'limite_1', PADRAO.limites[1]); setCfg(db, 'limite_2', PADRAO.limites[2]); setCfg(db, 'limite_3', PADRAO.limites[3]);
    setCfg(db, 'seq_pedido', 0); setCfg(db, 'seq_item', 0);
    var senha = ctx.hash('1234');
    db.Usuarios = [
      { id: ctx.uuid(), nome: 'Ana Souza', email: 'comprador@cheiroverde.com.br', senhaHash: senha, nivel: 1, filial: filiais[0], ativo: true, criadoEm: em },
      { id: ctx.uuid(), nome: 'Bruno Lima', email: 'comprador2@cheiroverde.com.br', senhaHash: senha, nivel: 1, filial: filiais[1], ativo: true, criadoEm: em },
      { id: ctx.uuid(), nome: 'Carla Mendes', email: 'supervisor@cheiroverde.com.br', senhaHash: senha, nivel: 2, filial: filiais[0], ativo: true, criadoEm: em },
      { id: ctx.uuid(), nome: 'Diego Rocha', email: 'gerente@cheiroverde.com.br', senhaHash: senha, nivel: 3, filial: filiais[0], ativo: true, criadoEm: em }
    ];
    db.Listas = linhasListasPadrao();
    FORNECEDORES.forEach(function (f) { db.Fornecedores.push({ id: ctx.uuid(), nome: f[0], cnpj: '', contato: '', telefone: '', email: '', cidade: f[1], categorias: f[2], ativo: true, criadoEm: em }); });
    CATALOGO.forEach(function (c) { db.Itens.push({ id: ctx.uuid(), codigo: 'IT-' + pad(proximo(db, 'seq_item'), 4), descricao: c[0], unidade: c[1], categoria: c[2], fornecedorPreferido: c[3], ultimoPreco: '', ultimaCompra: '', ativo: true, criadoEm: em }); });
    if (opcoes.demo) demo(db, ctx);
    db._dirty = null;
    return db;
  }

  function demo(db, ctx) {
    var a = 20260923;
    function rnd() { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function entre(x, y) { return x + rnd() * (y - x); }
    var U = db.Usuarios, DAY = 86400000, now = Date.now();
    var planos = [];
    for (var i = 0; i < 30; i++) planos.push(now - Math.floor(entre(0, 175)) * DAY - Math.floor(entre(0, 10)) * 3600000);
    planos.sort();
    planos.forEach(function (ms) {
      var criador = [U[0], U[0], U[1], U[1], U[2]][Math.floor(rnd() * 5)];
      var c = CATALOGO[Math.floor(rnd() * CATALOGO.length)];
      var item = itemPorDescricao(db, c[0]);
      var itens = [{ itemId: item.id, descricao: c[0], unidade: c[1], qtd: Math.round(entre(c[6], c[7])), valorUnit: r2(entre(c[4], c[5])) }];
      var em = new Date(ms).toISOString();
      var r = criar(db, criador, {
        filial: criador.filial, centroCusto: CC_POR_CAT[c[2]], categoria: c[2], fornecedor: c[3],
        urgencia: '', dataNecessidade: '',
        justificativa: 'Reposição para continuidade da operação.', itens: itens
      }, ctx, em);
      var idade = (now - ms) / DAY;
      if (r.status === 'pendente' && r.nivelNecessario <= 3 && idade > 4) {
        var apr = U.filter(function (x) { return x.nivel === r.nivelNecessario; })[0];
        var ok = rnd() > 0.18;
        decidir(db, r, apr, ok, ok ? '' : 'Solicitar mais 2 orçamentos.', new Date(ms + entre(2, 70) * 3600000).toISOString());
      }
      if (r.status === 'aprovado' && idade > 12 && rnd() < 0.75) {
        comprar(db, r, criador, c[3], '', ctx, new Date(new Date(r.decididoEm).getTime() + entre(1, 5) * DAY).toISOString());
      }
    });
  }

  return {
    TABELAS: TABELAS, NUMEROS: NUMEROS, DATAS: DATAS, BOOLEANOS: BOOLEANOS, TEXTOS: TEXTOS, NOMES: NOMES, TIPOS_LISTA: TIPOS_LISTA,
    linhasListasPadrao: linhasListasPadrao, listas: listas, cnpjValido: cnpjValido, cpfValido: cpfValido, digitos: digitos, formatarDoc: formatarDoc, normalizarCnpj: normalizarCnpj,
    novoDb: novoDb, seed: seed, login: login, handle: handle, estado: estado,
    limites: limites, nivelNecessario: nivelNecessario, podeAprovar: podeAprovar, norm: norm, r2: r2
  };
})();
if (typeof window !== 'undefined') window.CVEngine = CVEngine;
