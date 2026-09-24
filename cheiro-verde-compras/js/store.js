/* ==========================================================
   CAMADA DE DADOS
   Hoje: salva no navegador (localStorage) — ideal para demonstração.
   Produção: troque as funções load()/save() e as ações por chamadas
   a um backend (Supabase, Firebase ou API própria). Veja docs/.
   Toda a interface usa apenas as funções exportadas em window.CVStore.
   ========================================================== */
(function () {
  const KEY = 'cv_compras_v1';
  const SESSION_KEY = 'cv_compras_sessao';
  const C = window.CV_CONFIG;
  let db = null;

  // ---------- utilidades ----------
  function lsGet(k, st) { try { return (st || localStorage).getItem(k); } catch (e) { return null; } }
  function lsSet(k, v, st) { try { (st || localStorage).setItem(k, v); } catch (e) { /* sem armazenamento: segue em memória */ } }
  function lsDel(k, st) { try { (st || localStorage).removeItem(k); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function nowISO() { return new Date().toISOString(); }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  function calcTotal(itens) {
    return round2((itens || []).reduce((s, i) => s + (Number(i.qtd) || 0) * (Number(i.valorUnit) || 0), 0));
  }

  // ---------- dados de demonstração ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seed() {
    const settings = {
      limites: { 1: C.niveis[1].limite, 2: C.niveis[2].limite, 3: C.niveis[3].limite }
    };
    const users = [
      { id: 'u1', nome: 'Ana Souza',    email: 'comprador@cheiroverde.com.br',  senha: '1234', nivel: 1, filial: C.filiais[0], ativo: true },
      { id: 'u2', nome: 'Bruno Lima',   email: 'comprador2@cheiroverde.com.br', senha: '1234', nivel: 1, filial: C.filiais[1], ativo: true },
      { id: 'u3', nome: 'Carla Mendes', email: 'supervisor@cheiroverde.com.br', senha: '1234', nivel: 2, filial: C.filiais[0], ativo: true },
      { id: 'u4', nome: 'Diego Rocha',  email: 'gerente@cheiroverde.com.br',    senha: '1234', nivel: 3, filial: C.filiais[0], ativo: true }
    ];

    const catalogo = [
      { d: 'Luva nitrílica (caixa c/ 100)', u: 'cx', p: [42, 60], q: [10, 60], cat: 'EPI', cc: 'Segurança do Trabalho' },
      { d: 'Máscara PFF2', u: 'un', p: [3, 5], q: [200, 800], cat: 'EPI', cc: 'Segurança do Trabalho' },
      { d: 'Coletor perfurocortante 13L', u: 'un', p: [8, 12], q: [100, 500], cat: 'Embalagens e coletores', cc: 'Operações - Coleta' },
      { d: 'Bombona plástica 200L', u: 'un', p: [180, 250], q: [4, 30], cat: 'Embalagens e coletores', cc: 'Operações - Coleta' },
      { d: 'Contêiner 1000L', u: 'un', p: [1500, 2100], q: [1, 6], cat: 'Embalagens e coletores', cc: 'Tratamento de Resíduos' },
      { d: 'Pneu caminhão 295/80 R22.5', u: 'un', p: [2200, 2800], q: [2, 6], cat: 'Peças e manutenção', cc: 'Frota e Manutenção' },
      { d: 'Revisão e troca de óleo — frota', u: 'serv', p: [900, 1500], q: [1, 3], cat: 'Serviços', cc: 'Frota e Manutenção' },
      { d: 'Manutenção preventiva autoclave', u: 'serv', p: [7000, 14000], q: [1, 1], cat: 'Serviços', cc: 'Tratamento de Resíduos' },
      { d: 'Notebook corporativo', u: 'un', p: [4200, 5600], q: [1, 4], cat: 'TI', cc: 'TI' },
      { d: 'Uniforme operacional completo', u: 'un', p: [90, 140], q: [10, 40], cat: 'EPI', cc: 'Operações - Coleta' },
      { d: 'Papel A4 (caixa c/ 10 resmas)', u: 'cx', p: [220, 290], q: [1, 6], cat: 'Escritório', cc: 'Administrativo' },
      { d: 'Calibração de balança rodoviária', u: 'serv', p: [1200, 3200], q: [1, 1], cat: 'Serviços', cc: 'Tratamento de Resíduos' },
      { d: 'Fragmentadora industrial de documentos', u: 'un', p: [26000, 38000], q: [1, 1], cat: 'Equipamentos', cc: 'Tratamento de Resíduos' },
      { d: 'Reforma de carroceria baú — caminhão', u: 'serv', p: [48000, 72000], q: [1, 1], cat: 'Serviços', cc: 'Frota e Manutenção' },
      { d: 'Diesel S10', u: 'L', p: [5.8, 6.4], q: [300, 1500], cat: 'Combustível', cc: 'Frota e Manutenção' }
    ];
    const fornecedores = ['Proteção Total EPIs', 'Plastibras Embalagens', 'Auto Peças Paulista', 'Tecnocal Serviços', 'Dell Brasil', 'Posto Rodovia 225', 'Kalunga', 'Hidromec Industrial', 'Mega Pneus'];

    const rnd = mulberry32(20260923);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const between = (a, b) => a + rnd() * (b - a);
    const requests = [];
    const now = Date.now();
    const DAY = 86400000;

    const reqLevel = total => {
      for (let n = 1; n <= 3; n++) if (total <= settings.limites[n]) return n;
      return 4;
    };

    for (let i = 0; i < 28; i++) {
      const criador = pick([users[0], users[0], users[1], users[1], users[2]]);
      const base = pick(catalogo);
      const nItens = rnd() < 0.7 ? 1 : 2;
      const itens = [];
      for (let k = 0; k < nItens; k++) {
        const it = k === 0 ? base : pick(catalogo.filter(c => c.cc === base.cc)) || base;
        itens.push({
          descricao: it.d, unidade: it.u,
          qtd: Math.round(between(it.q[0], it.q[1])),
          valorUnit: round2(between(it.p[0], it.p[1]))
        });
      }
      const total = calcTotal(itens);
      const criadoMs = now - Math.floor(between(0, 175)) * DAY - Math.floor(between(0, 10)) * 3600000;
      const criadoEm = new Date(criadoMs).toISOString();
      const nivelNec = reqLevel(total);
      const r = {
        id: uid() + i,
        numero: 'PC-' + new Date(criadoMs).getFullYear() + '-' + String(i + 1).padStart(4, '0'),
        criadoEm,
        solicitanteId: criador.id, solicitanteNome: criador.nome, nivelSolicitante: criador.nivel,
        filial: criador.filial, centroCusto: base.cc, categoria: base.cat,
        fornecedor: pick(fornecedores),
        urgencia: pick(C.urgencias),
        dataNecessidade: new Date(criadoMs + between(3, 20) * DAY).toISOString().slice(0, 10),
        justificativa: 'Reposição para continuidade da operação.',
        itens, total, nivelNecessario: nivelNec,
        status: 'pendente', aprovadorId: null, aprovadorNome: null, decididoEm: null,
        historico: [{ em: criadoEm, usuario: criador.nome, acao: 'Solicitação criada', obs: '' }]
      };
      const idade = (now - criadoMs) / DAY;
      if (nivelNec <= criador.nivel) {
        r.status = idade > 20 && rnd() < 0.7 ? 'comprado' : 'aprovado';
        r.aprovadorId = criador.id; r.aprovadorNome = criador.nome; r.decididoEm = criadoEm; r.nivelAprovador = criador.nivel;
        r.historico.push({ em: criadoEm, usuario: criador.nome, acao: 'Aprovado dentro da própria alçada', obs: '' });
      } else if (nivelNec <= 3 && idade > 4) {
        const aprov = users.find(u => u.nivel === nivelNec);
        const dec = new Date(criadoMs + between(2, 70) * 3600000).toISOString();
        const reprova = rnd() < 0.18;
        r.status = reprova ? 'reprovado' : (idade > 20 && rnd() < 0.6 ? 'comprado' : 'aprovado');
        r.aprovadorId = aprov.id; r.aprovadorNome = aprov.nome; r.decididoEm = dec; r.nivelAprovador = aprov.nivel;
        r.historico.push({ em: dec, usuario: aprov.nome, acao: reprova ? 'Reprovado' : 'Aprovado', obs: reprova ? 'Solicitar mais 2 orçamentos.' : '' });
      }
      if (r.status === 'comprado') {
        const em = new Date(new Date(r.decididoEm).getTime() + between(1, 5) * DAY).toISOString();
        r.compradoEm = em;
        r.historico.push({ em, usuario: criador.nome, acao: 'Compra efetivada', obs: '' });
      }
      requests.push(r);
    }
    requests.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
    return { versao: 1, settings, users, requests, seq: requests.length };
  }

  // ---------- persistência ----------
  function load() {
    if (db) return db;
    const raw = lsGet(KEY);
    if (raw) { try { db = JSON.parse(raw); } catch (e) { db = null; } }
    if (!db) { db = seed(); save(); }
    return db;
  }
  function save() { lsSet(KEY, JSON.stringify(db)); }
  function reset() { db = seed(); save(); }

  // ---------- regras de alçada ----------
  function limites() { return load().settings.limites; }
  function limiteDoNivel(n) { return Number(limites()[n]) || 0; }
  function nomeNivel(n) { return n >= 4 ? C.instanciaSuperior : (C.niveis[n] ? C.niveis[n].nome : '—'); }
  function nivelNecessario(total) {
    for (let n = 1; n <= 3; n++) if (total <= limiteDoNivel(n)) return n;
    return 4;
  }
  function podeAprovar(user, r) {
    return !!user && r.status === 'pendente' && r.nivelNecessario <= user.nivel && r.nivelNecessario <= 3;
  }

  // ---------- sessão ----------
  function login(email, senha) {
    const u = load().users.find(x => x.email.toLowerCase() === String(email).trim().toLowerCase() && x.senha === senha && x.ativo);
    if (!u) return null;
    lsSet(SESSION_KEY, u.id, sessionStorage);
    lsSet(SESSION_KEY, u.id);
    return u;
  }
  function logout() { lsDel(SESSION_KEY, sessionStorage); lsDel(SESSION_KEY); }
  function currentUser() {
    const id = lsGet(SESSION_KEY, sessionStorage) || lsGet(SESSION_KEY);
    return id ? load().users.find(u => u.id === id && u.ativo) || null : null;
  }

  // ---------- solicitações ----------
  function listRequests() { return load().requests.slice(); }
  function getRequest(id) { return load().requests.find(r => r.id === id) || null; }

  function createRequest(user, data) {
    const d = load();
    const itens = (data.itens || []).map(i => ({
      descricao: String(i.descricao || '').trim(), unidade: i.unidade || 'un',
      qtd: Number(i.qtd) || 0, valorUnit: round2(i.valorUnit)
    })).filter(i => i.descricao && i.qtd > 0);
    if (!itens.length) throw new Error('Inclua ao menos um item com descrição e quantidade.');
    const total = calcTotal(itens);
    if (total <= 0) throw new Error('O valor total precisa ser maior que zero.');
    d.seq = (d.seq || 0) + 1;
    const em = nowISO();
    const nivelNec = nivelNecessario(total);
    const r = {
      id: uid(),
      numero: 'PC-' + new Date().getFullYear() + '-' + String(d.seq).padStart(4, '0'),
      criadoEm: em,
      solicitanteId: user.id, solicitanteNome: user.nome, nivelSolicitante: user.nivel,
      filial: data.filial || user.filial, centroCusto: data.centroCusto, categoria: data.categoria,
      fornecedor: data.fornecedor || '', urgencia: data.urgencia || 'Normal',
      dataNecessidade: data.dataNecessidade || '', justificativa: data.justificativa || '',
      itens, total, nivelNecessario: nivelNec,
      status: 'pendente', aprovadorId: null, aprovadorNome: null, decididoEm: null,
      historico: [{ em, usuario: user.nome, acao: 'Solicitação criada', obs: '' }]
    };
    if (nivelNec <= user.nivel) {
      r.status = 'aprovado'; r.aprovadorId = user.id; r.aprovadorNome = user.nome; r.decididoEm = em; r.nivelAprovador = user.nivel;
      r.historico.push({ em, usuario: user.nome, acao: 'Aprovado dentro da própria alçada', obs: '' });
    } else {
      r.historico.push({ em, usuario: 'Sistema', acao: 'Encaminhado para aprovação: ' + nomeNivel(nivelNec), obs: '' });
    }
    d.requests.unshift(r);
    save();
    return r;
  }

  function decide(id, user, aprovar, obs) {
    const r = getRequest(id);
    if (!r) throw new Error('Solicitação não encontrada.');
    if (!podeAprovar(user, r)) throw new Error('Você não tem alçada para decidir esta solicitação.');
    if (!aprovar && !String(obs || '').trim()) throw new Error('Informe o motivo da reprovação.');
    const em = nowISO();
    r.status = aprovar ? 'aprovado' : 'reprovado';
    r.aprovadorId = user.id; r.aprovadorNome = user.nome; r.decididoEm = em; r.nivelAprovador = user.nivel;
    r.historico.push({ em, usuario: user.nome, acao: aprovar ? 'Aprovado' : 'Reprovado', obs: obs || '' });
    save();
    return r;
  }

  function cancel(id, user, obs) {
    const r = getRequest(id);
    if (!r || r.status !== 'pendente' || (r.solicitanteId !== user.id && user.nivel < 3)) throw new Error('Não é possível cancelar esta solicitação.');
    r.status = 'cancelado';
    r.historico.push({ em: nowISO(), usuario: user.nome, acao: 'Cancelado', obs: obs || '' });
    save();
    return r;
  }

  function markPurchased(id, user, obs) {
    const r = getRequest(id);
    if (!r || r.status !== 'aprovado') throw new Error('Apenas pedidos aprovados podem ser marcados como comprados.');
    r.status = 'comprado'; r.compradoEm = nowISO();
    r.historico.push({ em: r.compradoEm, usuario: user.nome, acao: 'Compra efetivada', obs: obs || '' });
    save();
    return r;
  }

  // ---------- usuários e configurações (Gerente) ----------
  function listUsers() { return load().users.slice(); }
  function saveUser(data) {
    const d = load();
    const email = String(data.email || '').trim().toLowerCase();
    if (!data.nome || !email) throw new Error('Nome e e-mail são obrigatórios.');
    if (d.users.some(u => u.email.toLowerCase() === email && u.id !== data.id)) throw new Error('Já existe um usuário com este e-mail.');
    if (data.id) {
      const u = d.users.find(x => x.id === data.id);
      Object.assign(u, { nome: data.nome, email, nivel: Number(data.nivel), filial: data.filial });
      if (data.senha) u.senha = data.senha;
    } else {
      if (!data.senha) throw new Error('Defina uma senha inicial.');
      d.users.push({ id: uid(), nome: data.nome, email, senha: data.senha, nivel: Number(data.nivel), filial: data.filial, ativo: true });
    }
    save();
  }
  function toggleUser(id) {
    const u = load().users.find(x => x.id === id);
    if (u) { u.ativo = !u.ativo; save(); }
  }
  function saveLimites(l) {
    const a = Number(l[1]), b = Number(l[2]), c = Number(l[3]);
    if (!(a > 0 && b > a && c > b)) throw new Error('Os limites devem ser crescentes: Comprador < Supervisor < Gerente.');
    load().settings.limites = { 1: a, 2: b, 3: c };
    save();
  }

  // ---------- exportação (alimenta o dashboard de gestores / BI) ----------
  function exportJSON() { return JSON.stringify({ exportadoEm: nowISO(), empresa: C.empresa, solicitacoes: load().requests }, null, 2); }
  function exportCSV() {
    const cols = ['numero', 'criadoEm', 'status', 'solicitanteNome', 'nivelSolicitante', 'filial', 'centroCusto', 'categoria', 'fornecedor', 'urgencia', 'total', 'nivelNecessario', 'aprovadorNome', 'nivelAprovador', 'decididoEm', 'compradoEm'];
    const q = v => { const s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [cols.join(';')].concat(load().requests.map(r => cols.map(c => c === 'total' ? String(r.total).replace('.', ',') : q(r[c])).join(';')));
    return '﻿' + lines.join('\n');
  }
  function importJSON(text) {
    const obj = JSON.parse(text);
    if (!obj || !Array.isArray(obj.solicitacoes)) throw new Error('Arquivo inválido.');
    load().requests = obj.solicitacoes;
    save();
  }

  window.CVStore = {
    load, reset, calcTotal, limites, limiteDoNivel, nomeNivel, nivelNecessario, podeAprovar,
    login, logout, currentUser,
    listRequests, getRequest, createRequest, decide, cancel, markPurchased,
    listUsers, saveUser, toggleUser, saveLimites,
    exportJSON, exportCSV, importJSON
  };
})();
