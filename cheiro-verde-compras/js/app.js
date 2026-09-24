/* ==========================================================
   INTERFACE — Pedidos de Compra | Cheiro Verde Ambiental
   SPA simples com rotas por hash (#/inicio, #/nova, ...).
   ========================================================== */
(function () {
  const S = window.CVStore;
  const C = window.CV_CONFIG;
  const root = document.getElementById('root');

  // ---------- helpers ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlK = v => v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl(v);
  const data = iso => iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR') : '—';
  const dataHora = iso => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const iniciais = n => String(n).split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const STATUS = { pendente: 'Pendente', aprovado: 'Aprovado', reprovado: 'Reprovado', comprado: 'Comprado', cancelado: 'Cancelado' };
  const statusTag = s => `<span class="status st-${s}">${STATUS[s] || s}</span>`;
  const opts = (arr, sel) => arr.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

  function toast(msg, erro) {
    const t = document.createElement('div');
    t.className = 'toast' + (erro ? ' erro' : '');
    t.textContent = msg;
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    box.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }
  function download(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- ícones ----------
  const I = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'
  };
  const icon = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 20}" height="${s || 20}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

  // ---------- rotas ----------
  const ROTAS = [
    { id: 'inicio', nome: 'Início', icon: 'home', nivel: 1 },
    { id: 'nova', nome: 'Nova solicitação', curto: 'Nova', icon: 'plus', nivel: 1 },
    { id: 'solicitacoes', nome: 'Solicitações', curto: 'Pedidos', icon: 'list', nivel: 1 },
    { id: 'aprovacoes', nome: 'Aprovações', icon: 'check', nivel: 2 },
    { id: 'dashboard', nome: 'Dashboard', icon: 'chart', nivel: 2 },
    { id: 'config', nome: 'Configurações', curto: 'Config.', icon: 'cog', nivel: 3 }
  ];

  function rotaAtual() {
    const h = (location.hash || '#/inicio').replace(/^#\//, '').split('/');
    return { id: h[0] || 'inicio', param: h[1] };
  }
  window.addEventListener('hashchange', render);

  function pendentesParaMim(u) { return S.listRequests().filter(r => S.podeAprovar(u, r)); }

  // ========== LOGIN ==========
  function renderLogin() {
    root.innerHTML = `
    <div class="login-wrap">
      <section class="login-hero">
        <img class="logo-img" src="assets/logo.svg" alt="Cheiro Verde Ambiental">
        <div>
          <h1>Pedidos de compra com agilidade e controle.</h1>
          <p>Solicite, aprove dentro da sua alçada e acompanhe cada compra da Cheiro Verde Ambiental em um só lugar.</p>
        </div>
        <p class="small">© ${new Date().getFullYear()} ${esc(C.empresa)}</p>
      </section>
      <section class="login-form">
        <form class="login-card" id="fLogin" autocomplete="on">
          <img class="logo-img" src="assets/logo.svg" alt="Cheiro Verde Ambiental">
          <h1>Entrar</h1>
          <p class="muted">Acesse com seu e-mail corporativo.</p>
          <div class="field"><label for="email">E-mail</label><input id="email" type="email" required autocomplete="username"></div>
          <div class="field"><label for="senha">Senha</label><input id="senha" type="password" required autocomplete="current-password"></div>
          <div class="erro-msg" id="erro"></div>
          <button class="btn btn-primary" style="width:100%" type="submit">Entrar</button>
          <div class="demo-box">
            <b>Acessos de demonstração</b> (senha <code>1234</code>):
            <button type="button" data-demo="comprador@cheiroverde.com.br">Comprador — Nível 01</button>
            <button type="button" data-demo="supervisor@cheiroverde.com.br">Supervisor — Nível 02</button>
            <button type="button" data-demo="gerente@cheiroverde.com.br">Gerente — Nível 03</button>
          </div>
        </form>
      </section>
    </div>`;
    const f = document.getElementById('fLogin');
    f.addEventListener('submit', e => {
      e.preventDefault();
      const u = S.login(f.email.value, f.senha.value);
      if (!u) { document.getElementById('erro').textContent = 'E-mail ou senha inválidos.'; return; }
      location.hash = '#/inicio'; render();
    });
    f.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => {
      f.email.value = b.dataset.demo; f.senha.value = '1234'; f.requestSubmit();
    }));
  }

  // ========== SHELL ==========
  function render() {
    const u = S.currentUser();
    if (!u) return renderLogin();
    const rota = rotaAtual();
    const disp = ROTAS.filter(r => u.nivel >= r.nivel);
    const r = disp.find(x => x.id === rota.id) || disp[0];
    const nPend = pendentesParaMim(u).length;

    root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand"><img src="assets/logo.svg" alt="Cheiro Verde Ambiental"></div>
        <nav class="nav">
          ${disp.map(x => `<a href="#/${x.id}" class="${x.id === r.id ? 'active' : ''}">${icon(x.icon)}<span class="lbl-full">${esc(x.nome)}</span><span class="lbl-short">${esc(x.curto || x.nome)}</span>${x.id === 'aprovacoes' && nPend ? `<span class="badge">${nPend}</span>` : ''}</a>`).join('')}
        </nav>
        <div class="foot">${esc(C.sistema)} v${esc(C.versao)}</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <img class="mobile-brand" src="assets/logo.svg" alt="Cheiro Verde Ambiental">
          <h2 class="page-title-desk">${esc(r.nome)}</h2>
          <div class="user-chip">
            <div class="who"><b>${esc(u.nome)}</b><span class="nivel-tag">Nível 0${u.nivel} · ${esc(S.nomeNivel(u.nivel))}</span></div>
            <div class="avatar" title="${esc(u.nome)}">${iniciais(u.nome)}</div>
            <button class="btn btn-ghost btn-sm" id="btnSair" title="Sair">${icon('out', 18)}</button>
          </div>
        </header>
        <main class="content" id="view"></main>
      </div>
    </div>`;
    document.getElementById('btnSair').onclick = () => { S.logout(); location.hash = ''; render(); };

    const view = document.getElementById('view');
    ({ inicio: vInicio, nova: vNova, solicitacoes: vLista, aprovacoes: vAprovacoes, dashboard: vDashboard, config: vConfig }[r.id])(view, u, rota.param);
  }

  // ========== INÍCIO ==========
  function vInicio(el, u) {
    const todas = S.listRequests();
    const minhas = todas.filter(r => r.solicitanteId === u.id);
    const pend = pendentesParaMim(u);
    const lim = S.limites();
    const mesAtual = new Date().toISOString().slice(0, 7);
    const doMes = minhas.filter(r => r.criadoEm.slice(0, 7) === mesAtual);
    el.innerHTML = `
      <div class="page-head">
        <div><h1>Olá, ${esc(u.nome.split(' ')[0])}!</h1><p>Resumo das suas solicitações de compra.</p></div>
        <a class="btn btn-accent" href="#/nova">${icon('plus', 18)} Nova solicitação</a>
      </div>
      <div class="kpis">
        <div class="kpi destaque"><div class="lbl">Sua alçada</div><div class="val">${brl(lim[u.nivel])}</div><div class="sub">Aprova sozinho até este valor</div></div>
        <div class="kpi"><div class="lbl">Minhas pendentes</div><div class="val">${minhas.filter(r => r.status === 'pendente').length}</div><div class="sub">aguardando aprovação</div></div>
        <div class="kpi"><div class="lbl">Solicitado no mês</div><div class="val">${brl(doMes.reduce((s, r) => s + r.total, 0))}</div><div class="sub">${doMes.length} pedido(s)</div></div>
        <div class="kpi"><div class="lbl">${u.nivel >= 2 ? 'Para eu aprovar' : 'Aprovadas (total)'}</div><div class="val">${u.nivel >= 2 ? pend.length : minhas.filter(r => ['aprovado', 'comprado'].includes(r.status)).length}</div><div class="sub">${u.nivel >= 2 ? brl(pend.reduce((s, r) => s + r.total, 0)) : 'aprovadas ou compradas'}</div></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Alçadas de aprovação</h2></div>
        <div class="alcada">
          ${[1, 2, 3].map(n => `<div class="lvl ${n === u.nivel ? 'me' : ''}"><span class="small muted">Nível 0${n} · ${esc(S.nomeNivel(n))}</span><b>até ${brl(lim[n])}</b></div>`).join('')}
          <div class="lvl"><span class="small muted">${esc(C.instanciaSuperior)}</span><b>acima de ${brl(lim[3])}</b></div>
        </div>
      </div>
      ${u.nivel >= 2 && pend.length ? `<div class="card"><div class="card-head"><h2>Aguardando sua aprovação</h2><a href="#/aprovacoes" class="small">Ver todas</a></div>${tabela(pend.slice(0, 5))}</div>` : ''}
      <div class="card"><div class="card-head"><h2>Minhas últimas solicitações</h2><a href="#/solicitacoes" class="small">Ver todas</a></div>
        ${minhas.length ? tabela(minhas.slice(0, 6)) : '<div class="empty">Você ainda não criou solicitações.</div>'}
      </div>`;
    bindLinhas(el);
  }

  // ---------- tabela reutilizável ----------
  function tabela(lista, extra) {
    if (!lista.length) return '<div class="empty">Nenhuma solicitação encontrada.</div>';
    return `<div class="table-wrap"><table>
      <thead><tr><th>Nº</th><th>Data</th><th class="hide-sm">Solicitante</th><th class="hide-sm">Centro de custo</th><th class="hide-sm">Urgência</th><th class="r">Total</th><th>Status</th>${extra ? '<th></th>' : ''}</tr></thead>
      <tbody>${lista.map(r => `<tr class="click" data-id="${r.id}">
        <td><b>${esc(r.numero)}</b><div class="small muted">${esc(r.itens[0] ? r.itens[0].descricao : '')}${r.itens.length > 1 ? ' +' + (r.itens.length - 1) : ''}</div></td>
        <td class="num">${data(r.criadoEm)}</td>
        <td class="hide-sm">${esc(r.solicitanteNome)}</td>
        <td class="hide-sm">${esc(r.centroCusto)}</td>
        <td class="hide-sm urg-${esc(r.urgencia)}">${esc(r.urgencia)}</td>
        <td class="r num"><b>${brl(r.total)}</b></td>
        <td>${statusTag(r.status)}${r.status === 'pendente' ? `<div class="small muted">→ ${esc(S.nomeNivel(r.nivelNecessario))}</div>` : ''}</td>
        ${extra ? `<td>${extra(r)}</td>` : ''}
      </tr>`).join('')}</tbody></table></div>`;
  }
  function bindLinhas(el) {
    el.querySelectorAll('tr.click').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      abrirDetalhe(tr.dataset.id);
    }));
  }

  // ========== NOVA SOLICITAÇÃO ==========
  function vNova(el, u) {
    let itens = [{ descricao: '', qtd: 1, unidade: 'un', valorUnit: '' }];
    const lim = S.limites();
    el.innerHTML = `
      <div class="page-head"><div><h1>Nova solicitação de compra</h1><p>Preencha os dados e os itens. O fluxo de aprovação é definido automaticamente pelo valor total.</p></div></div>
      <form id="fNova">
        <div class="card">
          <h2 style="margin-bottom:14px">Dados gerais</h2>
          <div class="grid g3">
            <div><label>Filial</label><select name="filial">${opts(C.filiais, u.filial)}</select></div>
            <div><label>Centro de custo *</label><select name="centroCusto" required><option value="">Selecione…</option>${opts(C.centrosCusto)}</select></div>
            <div><label>Categoria *</label><select name="categoria" required><option value="">Selecione…</option>${opts(C.categorias)}</select></div>
            <div><label>Fornecedor sugerido</label><input name="fornecedor" placeholder="Nome do fornecedor"></div>
            <div><label>Urgência</label><select name="urgencia">${opts(C.urgencias, 'Normal')}</select></div>
            <div><label>Necessário até</label><input type="date" name="dataNecessidade"></div>
          </div>
          <div class="field" style="margin-top:14px"><label>Justificativa *</label><textarea name="justificativa" required placeholder="Por que esta compra é necessária?"></textarea></div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Itens</h2><button type="button" class="btn btn-ghost btn-sm" id="addItem">${icon('plus', 16)} Adicionar item</button></div>
          <div class="table-wrap"><table class="itens-table">
            <thead><tr><th style="width:44%">Descrição</th><th>Qtd</th><th>Unid.</th><th>Valor unit. (R$)</th><th class="r">Subtotal</th><th></th></tr></thead>
            <tbody id="itensBody"></tbody>
          </table></div>
          <div class="total-bar">
            <div><div class="small muted">Valor total</div><div class="v" id="vTotal">R$ 0,00</div></div>
            <div id="hintAlcada" class="hint ok">Informe os itens para calcular a alçada.</div>
          </div>
        </div>
        <div class="acoes" style="justify-content:flex-end">
          <a href="#/inicio" class="btn btn-ghost">Cancelar</a>
          <button type="submit" class="btn btn-primary" id="btnEnviar">Enviar solicitação</button>
        </div>
      </form>`;
    const body = el.querySelector('#itensBody');
    const pintarItens = () => {
      body.innerHTML = itens.map((it, i) => `<tr data-i="${i}">
        <td><input data-k="descricao" value="${esc(it.descricao)}" placeholder="Ex.: Luva nitrílica (caixa c/ 100)" required></td>
        <td><input data-k="qtd" type="number" min="0.01" step="any" value="${esc(it.qtd)}" required></td>
        <td><select data-k="unidade">${opts(C.unidadesMedida, it.unidade)}</select></td>
        <td><input data-k="valorUnit" type="number" min="0" step="0.01" value="${esc(it.valorUnit)}" placeholder="0,00" required></td>
        <td class="r num sub">${brl((+it.qtd || 0) * (+it.valorUnit || 0))}</td>
        <td><button type="button" class="btn btn-danger btn-sm" data-rm="${i}" title="Remover" ${itens.length === 1 ? 'disabled' : ''}>${icon('trash', 16)}</button></td>
      </tr>`).join('');
      atualizarTotal();
    };
    const atualizarTotal = () => {
      const total = S.calcTotal(itens);
      el.querySelector('#vTotal').textContent = brl(total);
      body.querySelectorAll('tr').forEach((tr, i) => { tr.querySelector('.sub').textContent = brl((+itens[i].qtd || 0) * (+itens[i].valorUnit || 0)); });
      const h = el.querySelector('#hintAlcada');
      if (!total) { h.className = 'hint ok'; h.textContent = 'Informe os itens para calcular a alçada.'; return; }
      const nec = S.nivelNecessario(total);
      if (nec <= u.nivel) { h.className = 'hint ok'; h.textContent = `✓ Dentro da sua alçada (${brl(lim[u.nivel])}) — será aprovado automaticamente.`; }
      else { h.className = 'hint warn'; h.textContent = `Acima da sua alçada — seguirá para aprovação: ${S.nomeNivel(nec)}.`; }
    };
    body.addEventListener('input', e => {
      const tr = e.target.closest('tr'); if (!tr) return;
      itens[+tr.dataset.i][e.target.dataset.k] = e.target.value;
      atualizarTotal();
    });
    body.addEventListener('change', e => { const tr = e.target.closest('tr'); if (tr) itens[+tr.dataset.i][e.target.dataset.k] = e.target.value; });
    body.addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { itens.splice(+b.dataset.rm, 1); pintarItens(); } });
    el.querySelector('#addItem').onclick = () => { itens.push({ descricao: '', qtd: 1, unidade: 'un', valorUnit: '' }); pintarItens(); body.querySelector('tr:last-child input').focus(); };
    pintarItens();

    el.querySelector('#fNova').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      try {
        const r = S.createRequest(u, {
          filial: f.filial.value, centroCusto: f.centroCusto.value, categoria: f.categoria.value,
          fornecedor: f.fornecedor.value, urgencia: f.urgencia.value, dataNecessidade: f.dataNecessidade.value,
          justificativa: f.justificativa.value, itens
        });
        toast(r.status === 'aprovado' ? `${r.numero} criada e aprovada na sua alçada.` : `${r.numero} enviada para aprovação (${S.nomeNivel(r.nivelNecessario)}).`);
        window.addEventListener('hashchange', () => abrirDetalhe(r.id), { once: true });
        location.hash = '#/solicitacoes';
      } catch (err) { toast(err.message, true); }
    });
  }

  // ========== LISTA ==========
  function vLista(el, u) {
    const podeVerTodas = u.nivel >= 2;
    el.innerHTML = `
      <div class="page-head"><div><h1>Solicitações</h1><p>${podeVerTodas ? 'Todas as solicitações da empresa.' : 'Suas solicitações de compra.'}</p></div>
        <a class="btn btn-accent" href="#/nova">${icon('plus', 18)} Nova</a></div>
      <div class="card">
        <div class="filters">
          <input type="search" id="fBusca" placeholder="Buscar nº, item, fornecedor, solicitante…">
          <select id="fStatus"><option value="">Todos os status</option>${Object.keys(STATUS).map(s => `<option value="${s}">${STATUS[s]}</option>`).join('')}</select>
          <select id="fCC"><option value="">Todos os centros de custo</option>${opts(C.centrosCusto)}</select>
          ${podeVerTodas ? `<select id="fDono"><option value="">Todas</option><option value="minhas">Somente minhas</option></select>` : ''}
        </div>
        <div id="tab"></div>
      </div>`;
    const pintar = () => {
      const q = el.querySelector('#fBusca').value.trim().toLowerCase();
      const st = el.querySelector('#fStatus').value;
      const cc = el.querySelector('#fCC').value;
      const dono = el.querySelector('#fDono') ? el.querySelector('#fDono').value : 'minhas';
      let l = S.listRequests();
      if (!podeVerTodas || dono === 'minhas') l = l.filter(r => r.solicitanteId === u.id);
      if (st) l = l.filter(r => r.status === st);
      if (cc) l = l.filter(r => r.centroCusto === cc);
      if (q) l = l.filter(r => [r.numero, r.fornecedor, r.solicitanteNome, r.centroCusto, ...r.itens.map(i => i.descricao)].join(' ').toLowerCase().includes(q));
      el.querySelector('#tab').innerHTML = tabela(l) + `<p class="small muted" style="margin:12px 0 0">${l.length} registro(s) · ${brl(l.reduce((s, r) => s + r.total, 0))}</p>`;
      bindLinhas(el);
    };
    el.querySelectorAll('.filters input, .filters select').forEach(i => i.addEventListener('input', pintar));
    pintar();
  }

  // ========== APROVAÇÕES ==========
  function vAprovacoes(el, u) {
    const pend = pendentesParaMim(u);
    const acima = S.listRequests().filter(r => r.status === 'pendente' && r.nivelNecessario > u.nivel);
    el.innerHTML = `
      <div class="page-head"><div><h1>Aprovações</h1><p>Solicitações dentro da sua alçada (até ${brl(S.limiteDoNivel(u.nivel))}).</p></div></div>
      <div class="card"><div class="card-head"><h2>Aguardando você (${pend.length})</h2></div>
        ${tabela(pend, r => `<div style="display:flex;gap:6px"><button class="btn btn-primary btn-sm" data-ap="${r.id}">Aprovar</button><button class="btn btn-danger btn-sm" data-rp="${r.id}">Reprovar</button></div>`)}
      </div>
      ${acima.length ? `<div class="card"><div class="card-head"><h2>Acima da sua alçada (${acima.length})</h2><span class="small muted">somente acompanhamento</span></div>${tabela(acima)}</div>` : ''}`;
    bindLinhas(el);
    el.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => { try { S.decide(b.dataset.ap, u, true, ''); toast('Solicitação aprovada.'); render(); } catch (e) { toast(e.message, true); } });
    el.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => abrirDetalhe(b.dataset.rp, 'reprovar'));
  }

  // ========== DETALHE (gaveta lateral) ==========
  function abrirDetalhe(id, foco) {
    const u = S.currentUser();
    const r = S.getRequest(id);
    if (!r) return;
    const podeDecidir = S.podeAprovar(u, r);
    const podeCancelar = r.status === 'pendente' && (r.solicitanteId === u.id || u.nivel >= 3);
    const podeComprar = r.status === 'aprovado';
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="drawer" role="dialog" aria-modal="true" aria-label="Solicitação ${esc(r.numero)}">
      <div class="card-head" style="margin:0">
        <div><div class="small muted">Solicitação</div><h1>${esc(r.numero)}</h1></div>
        <button class="btn btn-ghost btn-sm" data-close title="Fechar">${icon('x', 18)}</button>
      </div>
      <div style="margin-top:8px">${statusTag(r.status)} ${r.status === 'pendente' ? `<span class="small muted">aguardando <b>${esc(S.nomeNivel(r.nivelNecessario))}</b></span>` : ''}</div>
      <div class="dl">
        <div><span>Solicitante</span>${esc(r.solicitanteNome)} <span class="nivel-tag" style="display:inline">N0${r.nivelSolicitante}</span></div>
        <div><span>Criada em</span>${dataHora(r.criadoEm)}</div>
        <div><span>Filial</span>${esc(r.filial)}</div>
        <div><span>Centro de custo</span>${esc(r.centroCusto)}</div>
        <div><span>Categoria</span>${esc(r.categoria)}</div>
        <div><span>Fornecedor</span>${esc(r.fornecedor || '—')}</div>
        <div><span>Urgência</span><span class="urg-${esc(r.urgencia)}" style="display:inline;text-transform:none;font-size:inherit">${esc(r.urgencia)}</span></div>
        <div><span>Necessário até</span>${data(r.dataNecessidade)}</div>
        ${r.aprovadorNome ? `<div><span>${r.status === 'reprovado' ? 'Reprovado por' : 'Aprovado por'}</span>${esc(r.aprovadorNome)} (N0${r.nivelAprovador || ''})</div><div><span>Decisão em</span>${dataHora(r.decididoEm)}</div>` : ''}
      </div>
      ${r.justificativa ? `<h3>Justificativa</h3><p style="margin:6px 0 16px">${esc(r.justificativa)}</p>` : ''}
      <h3>Itens</h3>
      <div class="table-wrap"><table><thead><tr><th>Descrição</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Subtotal</th></tr></thead>
        <tbody>${r.itens.map(i => `<tr><td>${esc(i.descricao)}</td><td class="r num">${i.qtd} ${esc(i.unidade)}</td><td class="r num">${brl(i.valorUnit)}</td><td class="r num">${brl(i.qtd * i.valorUnit)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3"><b>Total</b></td><td class="r num"><b>${brl(r.total)}</b></td></tr></tfoot></table></div>
      ${(podeDecidir || podeCancelar || podeComprar) ? `
        <div class="card" style="margin-top:18px;background:var(--verde-50)">
          <label for="obs">Observação ${podeDecidir ? '(obrigatória para reprovar)' : ''}</label>
          <textarea id="obs" placeholder="Comentário opcional…"></textarea>
          <div class="acoes">
            ${podeDecidir ? `<button class="btn btn-primary" data-act="aprovar">Aprovar</button><button class="btn btn-danger" data-act="reprovar">Reprovar</button>` : ''}
            ${podeComprar ? `<button class="btn btn-accent" data-act="comprar">Marcar como comprado</button>` : ''}
            ${podeCancelar ? `<button class="btn btn-ghost" data-act="cancelar">Cancelar solicitação</button>` : ''}
          </div>
        </div>` : ''}
      <h3 style="margin:20px 0 10px">Histórico</h3>
      <ul class="timeline">${r.historico.map(h => `<li><b>${esc(h.acao)}</b><div class="small muted">${dataHora(h.em)} · ${esc(h.usuario)}</div>${h.obs ? `<div class="small">“${esc(h.obs)}”</div>` : ''}</li>`).join('')}</ul>
    </div>`;
    const fechar = () => { bg.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = e => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc_);
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) fechar(); });
    bg.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const obs = bg.querySelector('#obs').value;
      try {
        const a = b.dataset.act;
        if (a === 'aprovar') S.decide(r.id, u, true, obs);
        if (a === 'reprovar') S.decide(r.id, u, false, obs);
        if (a === 'comprar') S.markPurchased(r.id, u, obs);
        if (a === 'cancelar') S.cancel(r.id, u, obs);
        toast({ aprovar: 'Solicitação aprovada.', reprovar: 'Solicitação reprovada.', comprar: 'Compra registrada.', cancelar: 'Solicitação cancelada.' }[a]);
        fechar(); render();
      } catch (e) { toast(e.message, true); }
    });
    document.body.appendChild(bg);
    if (foco === 'reprovar') { const o = bg.querySelector('#obs'); o && o.focus(); }
  }

  // ========== DASHBOARD DE GESTORES ==========
  function vDashboard(el) {
    el.innerHTML = `
      <div class="page-head"><div><h1>Dashboard de compras</h1><p>Visão gerencial das solicitações.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" id="expCSV">Exportar CSV</button>
          <button class="btn btn-ghost btn-sm" id="expJSON">Exportar JSON</button>
        </div></div>
      <div class="filters">
        <select id="dPer"><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="180" selected>Últimos 6 meses</option><option value="365">Últimos 12 meses</option><option value="0">Todo o período</option></select>
        <select id="dFil"><option value="">Todas as filiais</option>${opts(C.filiais)}</select>
        <select id="dCC"><option value="">Todos os centros de custo</option>${opts(C.centrosCusto)}</select>
      </div>
      <div id="dash"></div>`;
    el.querySelector('#expCSV').onclick = () => download('pedidos-compra.csv', S.exportCSV(), 'text/csv;charset=utf-8');
    el.querySelector('#expJSON').onclick = () => download('pedidos-compra.json', S.exportJSON(), 'application/json');

    const pintar = () => {
      const dias = +el.querySelector('#dPer').value, fil = el.querySelector('#dFil').value, cc = el.querySelector('#dCC').value;
      const desde = dias ? Date.now() - dias * 86400000 : 0;
      const l = S.listRequests().filter(r => new Date(r.criadoEm).getTime() >= desde && (!fil || r.filial === fil) && (!cc || r.centroCusto === cc));
      const soma = arr => arr.reduce((s, r) => s + r.total, 0);
      const aprov = l.filter(r => ['aprovado', 'comprado'].includes(r.status));
      const pend = l.filter(r => r.status === 'pendente');
      const reprov = l.filter(r => r.status === 'reprovado');
      const decididas = aprov.length + reprov.length;
      const taxa = decididas ? Math.round(aprov.length / decididas * 100) : 0;
      const comEscalada = l.filter(r => r.decididoEm && r.aprovadorId !== r.solicitanteId);
      const horas = comEscalada.length ? comEscalada.reduce((s, r) => s + (new Date(r.decididoEm) - new Date(r.criadoEm)), 0) / comEscalada.length / 3600000 : 0;

      // por mês (6 últimos meses do período)
      const meses = [];
      const ref = new Date(); ref.setDate(1);
      const nMeses = dias && dias <= 90 ? 3 : 6;
      for (let i = nMeses - 1; i >= 0; i--) { const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1); meses.push({ k: d.toISOString().slice(0, 7), lbl: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') }); }
      meses.forEach(m => { const doMes = l.filter(r => r.criadoEm.slice(0, 7) === m.k); m.a = soma(doMes.filter(r => ['aprovado', 'comprado'].includes(r.status))); m.p = soma(doMes.filter(r => r.status === 'pendente')); });
      const maxM = Math.max(1, ...meses.map(m => m.a + m.p));

      const agrupar = (arr, key) => { const o = {}; arr.forEach(r => { o[r[key]] = (o[r[key]] || 0) + r.total; }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
      const porCC = agrupar(aprov, 'centroCusto');
      const porForn = agrupar(aprov.filter(r => r.fornecedor), 'fornecedor').slice(0, 6);
      const porNivel = [1, 2, 3].map(n => { const x = aprov.filter(r => r.nivelAprovador === n); return [`N0${n} · ${S.nomeNivel(n)}`, x.length, soma(x)]; });
      const hbars = (rows, fmt) => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.length ? rows.map(([k, v]) => `<div class="hbar"><span class="lbl" title="${esc(k)}">${esc(k)}</span><div class="track"><div class="fill" style="width:${(v / mx * 100).toFixed(1)}%"></div></div><span class="num small"><b>${fmt(v)}</b></span></div>`).join('') : '<div class="empty">Sem dados no período.</div>'; };

      el.querySelector('#dash').innerHTML = `
        <div class="kpis">
          <div class="kpi"><div class="lbl">Total solicitado</div><div class="val">${brl(soma(l))}</div><div class="sub">${l.length} solicitações</div></div>
          <div class="kpi"><div class="lbl">Aprovado</div><div class="val">${brl(soma(aprov))}</div><div class="sub">${aprov.length} pedidos · ${l.filter(r => r.status === 'comprado').length} comprados</div></div>
          <div class="kpi destaque"><div class="lbl">Pendente</div><div class="val">${brl(soma(pend))}</div><div class="sub">${pend.length} aguardando aprovação</div></div>
          <div class="kpi"><div class="lbl">Taxa de aprovação</div><div class="val">${taxa}%</div><div class="sub">tempo médio de decisão: ${horas ? (horas < 24 ? horas.toFixed(0) + ' h' : (horas / 24).toFixed(1) + ' dias') : '—'}</div></div>
        </div>
        <div class="charts">
          <div class="card"><div class="card-head"><h2>Valor por mês</h2><div class="legend"><span><i style="background:var(--verde-600)"></i>Aprovado</span><span><i style="background:var(--laranja)"></i>Pendente</span></div></div>
            <div class="vbars">${meses.map(m => `<div class="col" title="${m.lbl}: aprovado ${brl(m.a)} · pendente ${brl(m.p)}"><span class="v">${m.a + m.p ? brlK(m.a + m.p) : ''}</span><div class="stack" style="height:${((m.a + m.p) / maxM * 85).toFixed(1)}%"><div class="seg-a" style="flex:${m.a}"></div><div class="seg-p" style="flex:${m.p}"></div></div></div>`).join('')}</div>
            <div class="vlabels">${meses.map(m => `<span>${m.lbl}</span>`).join('')}</div>
          </div>
          <div class="card"><div class="card-head"><h2>Aprovado por centro de custo</h2></div>${hbars(porCC, brlK)}</div>
          <div class="card"><div class="card-head"><h2>Uso das alçadas</h2><span class="small muted">pedidos aprovados por nível</span></div>
            ${hbars(porNivel.map(x => [x[0], x[1]]), v => v + ' ped.')}
            <p class="small muted" style="margin:6px 0 0">${porNivel.map(x => `${x[0]}: ${brlK(x[2])}`).join(' · ')}</p></div>
          <div class="card"><div class="card-head"><h2>Principais fornecedores</h2></div>${hbars(porForn, brlK)}</div>
        </div>
        <div class="card" style="margin-top:16px"><div class="card-head"><h2>Pendentes mais antigas</h2></div>${tabela(pend.slice().sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)).slice(0, 8))}</div>`;
      bindLinhas(el);
    };
    el.querySelectorAll('.filters select').forEach(s => s.addEventListener('input', pintar));
    pintar();
  }

  // ========== CONFIGURAÇÕES (Gerente) ==========
  function vConfig(el, u) {
    const lim = S.limites();
    const users = S.listUsers();
    el.innerHTML = `
      <div class="page-head"><div><h1>Configurações</h1><p>Alçadas, usuários e dados do sistema.</p></div></div>
      <div class="card">
        <div class="card-head"><h2>Limites de aprovação (alçadas)</h2></div>
        <form id="fLim" class="grid g4" style="align-items:end">
          ${[1, 2, 3].map(n => `<div><label>Nível 0${n} — ${esc(S.nomeNivel(n))} (R$)</label><input type="number" min="1" step="0.01" name="l${n}" value="${lim[n]}"></div>`).join('')}
          <div><button class="btn btn-primary" style="width:100%">Salvar limites</button></div>
        </form>
        <p class="small muted" style="margin:10px 0 0">Acima do limite do Gerente, o pedido fica aguardando <b>${esc(C.instanciaSuperior)}</b>. Novos limites valem para novas solicitações.</p>
      </div>
      <div class="card">
        <div class="card-head"><h2>Usuários</h2><button class="btn btn-accent btn-sm" id="novoU">${icon('plus', 16)} Novo usuário</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th class="hide-sm">E-mail</th><th>Nível</th><th class="hide-sm">Filial</th><th>Status</th><th></th></tr></thead>
          <tbody>${users.map(x => `<tr><td><b>${esc(x.nome)}</b></td><td class="hide-sm">${esc(x.email)}</td><td><span class="nivel-tag">N0${x.nivel} · ${esc(S.nomeNivel(x.nivel))}</span></td><td class="hide-sm">${esc(x.filial)}</td>
            <td>${x.ativo ? '<span class="status st-aprovado">Ativo</span>' : '<span class="status st-cancelado">Inativo</span>'}</td>
            <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-ed="${x.id}">Editar</button> ${x.id !== u.id ? `<button class="btn btn-ghost btn-sm" data-tg="${x.id}">${x.ativo ? 'Desativar' : 'Ativar'}</button>` : ''}</td></tr>`).join('')}</tbody>
        </table></div>
        <form id="fUser" class="hidden" style="margin-top:16px;border-top:1px solid var(--linha);padding-top:16px">
          <input type="hidden" name="id">
          <div class="grid g3">
            <div><label>Nome *</label><input name="nome" required></div>
            <div><label>E-mail *</label><input name="email" type="email" required></div>
            <div><label>Senha <span class="muted" id="senhaHint"></span></label><input name="senha" type="text"></div>
            <div><label>Nível</label><select name="nivel">${[1, 2, 3].map(n => `<option value="${n}">Nível 0${n} — ${esc(S.nomeNivel(n))}</option>`).join('')}</select></div>
            <div><label>Filial</label><select name="filial">${opts(C.filiais)}</select></div>
            <div style="display:flex;gap:8px;align-items:end"><button class="btn btn-primary">Salvar</button><button type="button" class="btn btn-ghost" id="cancU">Cancelar</button></div>
          </div>
        </form>
      </div>
      <div class="card">
        <div class="card-head"><h2>Dados</h2></div>
        <div class="acoes" style="margin:0">
          <button class="btn btn-ghost" id="bExp">Backup (JSON)</button>
          <label class="btn btn-ghost" style="margin:0">Importar JSON<input type="file" accept="application/json" id="bImp" hidden></label>
          <button class="btn btn-danger" id="bReset">Restaurar dados de demonstração</button>
        </div>
        <p class="small muted" style="margin:10px 0 0">Nesta versão os dados ficam salvos no navegador. Para uso real com vários usuários, conecte um banco de dados (veja o README).</p>
      </div>`;

    el.querySelector('#fLim').addEventListener('submit', e => {
      e.preventDefault(); const f = e.target;
      try { S.saveLimites({ 1: f.l1.value, 2: f.l2.value, 3: f.l3.value }); toast('Limites atualizados.'); render(); } catch (err) { toast(err.message, true); }
    });
    const fU = el.querySelector('#fUser');
    const abrirForm = x => {
      fU.classList.remove('hidden'); fU.reset();
      fU.id.value = x ? x.id : ''; fU.nome.value = x ? x.nome : ''; fU.email.value = x ? x.email : '';
      fU.nivel.value = x ? x.nivel : 1; fU.filial.value = x ? x.filial : C.filiais[0];
      el.querySelector('#senhaHint').textContent = x ? '(deixe em branco para manter)' : '*';
      fU.nome.focus();
    };
    el.querySelector('#novoU').onclick = () => abrirForm(null);
    el.querySelector('#cancU').onclick = () => fU.classList.add('hidden');
    el.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => abrirForm(users.find(x => x.id === b.dataset.ed)));
    el.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => { S.toggleUser(b.dataset.tg); render(); });
    fU.addEventListener('submit', e => {
      e.preventDefault();
      try { S.saveUser({ id: fU.id.value, nome: fU.nome.value.trim(), email: fU.email.value, senha: fU.senha.value, nivel: fU.nivel.value, filial: fU.filial.value }); toast('Usuário salvo.'); render(); } catch (err) { toast(err.message, true); }
    });
    el.querySelector('#bExp').onclick = () => download('backup-pedidos-compra.json', S.exportJSON(), 'application/json');
    el.querySelector('#bImp').onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      file.text().then(t => { S.importJSON(t); toast('Dados importados.'); render(); }).catch(err => toast(err.message || 'Falha ao importar.', true));
    };
    el.querySelector('#bReset').onclick = () => { if (!confirm('Apagar todos os dados e restaurar a demonstração?')) return; S.reset(); S.logout(); toast('Dados de demonstração restaurados.'); render(); };
  }

  render();
})();
