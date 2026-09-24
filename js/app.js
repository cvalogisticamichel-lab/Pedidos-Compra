/* ==========================================================
   INTERFACE — Pedidos de Compra | Cheiro Verde Ambiental
   SPA simples com rotas por hash (#/inicio, #/nova, ...).
   ========================================================== */
(function () {
  const S = window.CVStore;
  const C = window.CV_CONFIG;
  const root = document.getElementById('root');
  const M = window.CV_MARCA;

  // ---------- helpers ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlK = v => v >= 1000 ? 'R$ ' + (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil' : brl(v);
  const data = iso => iso ? new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('pt-BR') : '—';
  const dataHora = iso => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const iniciais = n => String(n).split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const STATUS = { pendente: 'Pendente', aprovado: 'Aprovado', reprovado: 'Reprovado', comprado: 'Comprado', cancelado: 'Cancelado' };
  const statusTag = s => `<span class="status st-${s}">${STATUS[s] || s}</span>`;
  const opts = (arr, sel) => arr.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const ativo = x => x.ativo !== false;

  function toast(msg, erro) {
    const t = document.createElement('div');
    t.className = 'toast' + (erro ? ' erro' : '');
    t.textContent = msg;
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    box.appendChild(t);
    setTimeout(() => t.remove(), erro ? 5000 : 3200);
  }
  function download(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /** Executa uma ação no servidor com botão em "carregando", mensagens e re-render. */
  async function executar(btn, fn, okMsg, depois, overlayMsg) {
    const txtOrig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Salvando…'; }
    if (overlayMsg) mostrarCarregando(overlayMsg);
    try {
      const r = await fn();
      esconderCarregando();
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg);
      if (depois) depois(r); else render();
      return r;
    } catch (e) {
      esconderCarregando();
      if (e.sessao === false) { S.logout(); toast(e.message, true); render(); return; }
      toast(e.message || 'Erro inesperado.', true);
      if (btn) { btn.disabled = false; btn.innerHTML = txtOrig; }
    }
  }

  // ---------- ícones ----------
  const I = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    check: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    sync: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    clip: '<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
    truck: '<path d="M1 4h14v11H1zM15 8h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    user: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a7 7 0 0 1 14 0v1"/><path d="M19 8v6M16 11h6"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'
  };
  const icon = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 20}" height="${s || 20}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

  // ---------- rotas ----------
  const ROTAS = [
    { id: 'inicio', nome: 'Início', icon: 'home', nivel: 1 },
    { id: 'nova', nome: 'Nova solicitação', curto: 'Nova', icon: 'plus', nivel: 1 },
    { id: 'solicitacoes', nome: 'Solicitações', curto: 'Pedidos', icon: 'list', nivel: 1 },
    { id: 'aprovacoes', nome: 'Aprovações', icon: 'check', nivel: 2 },
    { id: 'itens', nome: 'Itens', icon: 'box', nivel: 1, grupo: 'Cadastros' },
    { id: 'fornecedores', nome: 'Fornecedores', icon: 'truck', nivel: 1 },
    { id: 'precos', nome: 'Histórico de preços', curto: 'Preços', icon: 'chart', nivel: 1 },
    { id: 'credenciamento', nome: 'Credenciamento', curto: 'Credenc.', icon: 'shield', nivel: 3, grupo: 'Gestão' },
    { id: 'acessos', nome: 'Acessos', icon: 'user', nivel: 3 },
    { id: 'config', nome: 'Configurações', curto: 'Config.', icon: 'cog', nivel: 3 }
  ];
  function rotaAtual() {
    const h = (location.hash || '#/inicio').replace(/^#\//, '').split('/');
    const id = h[0] === 'cadastros' ? (h[1] || 'itens') : (h[0] || 'inicio'); // links antigos
    return { id, param: h[1] };
  }
  window.addEventListener('hashchange', () => render());

  function pendentesParaMim(u) { return S.listRequests().filter(r => S.podeAprovar(u, r)); }

  // ========== CARREGANDO ==========
  function renderCarregando(msg) {
    root.innerHTML = `<div class="loading-screen">${M.carregando()}<p>${esc(msg || 'Carregando…')}</p></div>`;
  }
  /** Tela de carregamento por cima da página (login, envio de pedido, anexos) */
  function mostrarCarregando(msg) {
    let ov = document.querySelector('.loading-overlay');
    if (!ov) { ov = document.createElement('div'); ov.className = 'loading-overlay'; ov.setAttribute('role', 'status'); document.body.appendChild(ov); }
    ov.innerHTML = `<div class="loading-box">${M.carregando()}<p>${esc(msg || 'Carregando…')}</p></div>`;
  }
  function esconderCarregando() { document.querySelectorAll('.loading-overlay').forEach(o => o.remove()); }

  // ========== LOGIN ==========
  function renderLogin(msgErro) {
    const demo = S.modo === 'local';
    root.innerHTML = `
    <div class="login-wrap">
      <section class="login-hero">
        <div class="hero-centro">
          <div class="hero-logo">${M.carregando(false)}</div>
          <h1>Pedidos de compra com agilidade e controle.</h1>
          <p>Solicite, aprove dentro da sua alçada e acompanhe cada compra em um só lugar.</p>
        </div>
        <p class="small hero-rodape">© ${new Date().getFullYear()} ${esc(C.empresa)}</p>
      </section>
      <section class="login-form">
        <form class="login-card" id="fLogin" autocomplete="on">
          <div class="logo-mobile">${M.carregando(false)}</div>
          <h1>Entrar</h1>
          <p class="muted">Acesse com seu e-mail @${esc(S.dominio)}.</p>
          <div class="field"><label for="email">E-mail</label><input id="email" type="email" required autocomplete="username"></div>
          <div class="field"><label for="senha">Senha</label><input id="senha" type="password" required autocomplete="current-password"></div>
          <div class="erro-msg" id="erro">${esc(msgErro || '')}</div>
          <button class="btn btn-primary" style="width:100%" type="submit" id="btnEntrar">Entrar</button>
          ${demo ? `<div class="demo-box">
            <b>Modo demonstração</b> — dados salvos só neste navegador. Senha <code>1234</code>:
            <button type="button" data-demo="comprador@cheiroverde.com.br">Comprador</button>
            <button type="button" data-demo="supervisor@cheiroverde.com.br">Supervisor</button>
            <button type="button" data-demo="gerente@cheiroverde.com.br">Gerente</button>
          </div>` : `<p class="small muted" style="margin-top:16px">Conectado à base Google da empresa.</p>`}
        </form>
      </section>
      <button type="button" class="btn btn-accent btn-primeiro-acesso" id="btnPrimeiro">${icon('plus', 18)} Solicitar primeiro acesso</button>
    </div>`;
    document.getElementById('btnPrimeiro').onclick = primeiroAcesso;
    const f = document.getElementById('fLogin');
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const b = document.getElementById('btnEntrar');
      b.disabled = true; b.innerHTML = '<span class="spin"></span> Entrando…';
      mostrarCarregando('Entrando…');
      try {
        await S.login(f.email.value, f.senha.value);
        esconderCarregando();
        if (!location.hash || location.hash === '#/') location.hash = '#/inicio';
        render();
      } catch (err) {
        esconderCarregando();
        document.getElementById('erro').textContent = err.message;
        b.disabled = false; b.textContent = 'Entrar';
      }
    });
    f.querySelectorAll('[data-demo]').forEach(b => b.addEventListener('click', () => {
      f.email.value = b.dataset.demo; f.senha.value = '1234'; f.requestSubmit();
    }));
  }

  // ========== PRIMEIRO ACESSO ==========
  const mascaraCpf = v => { const d = S.digitos(v).slice(0, 11); return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2'); };
  function primeiroAcesso() {
    abrirGaveta(`
      <div class="card-head" style="margin:0"><div><div class="small muted">Cheiro Verde Ambiental</div><h1>Solicitar primeiro acesso</h1></div>${btnFechar}</div>
      <div id="paPasso"></div>`, (bg, fechar) => {
      const box = bg.querySelector('#paPasso');
      const passoEmail = (erroMsg, valor) => {
        box.innerHTML = `<form id="paEmail" class="pa-form">
          <div class="pa-etapas"><span class="on">1 · E-mail</span><span>2 · Cadastro</span><span>3 · Aprovação</span></div>
          <p class="muted">Informe seu e-mail corporativo <b>@${esc(S.dominio)}</b>.</p>
          <div class="field"><label>E-mail *</label><input name="email" type="email" required autocomplete="email" value="${esc(valor || '')}" placeholder="nome@${esc(S.dominio)}"></div>
          <div class="erro-msg">${esc(erroMsg || '')}</div>
          <button class="btn btn-primary" style="width:100%">Continuar</button>
        </form>`;
        const fe = box.querySelector('#paEmail'); fe.email.focus();
        fe.addEventListener('submit', async e => {
          e.preventDefault();
          const b = fe.querySelector('button'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Verificando…';
          try {
            const v = await S.verificarEmail(fe.email.value);
            if (!v.autorizado) return passoEmail(`E-mail não autorizado. O cadastro é permitido apenas para e-mails @${S.dominio}.`, fe.email.value);
            if (v.existe) return passoEmail(v.status === 'pendente' ? 'Já existe uma solicitação para este e-mail aguardando aprovação de um gerente.' : 'Este e-mail já possui cadastro. Feche esta janela e use "Entrar".', fe.email.value);
            passoCadastro(v);
          } catch (err) { passoEmail(err.message, fe.email.value); }
        });
      };
      const passoCadastro = v => {
        box.innerHTML = `<form id="paCad" class="pa-form" autocomplete="off">
          <div class="pa-etapas"><span class="ok">1 · E-mail</span><span class="on">2 · Cadastro</span><span>3 · Aprovação</span></div>
          <div class="pa-email">${icon('check', 16)} ${esc(v.email)} <button type="button" class="btn-mini" id="paTroca">trocar</button></div>
          <div class="field"><label>Nome completo *</label><input name="nome" required value="${esc(v.nomeSugerido || '')}" placeholder="Nome e sobrenome"></div>
          <div class="field"><label>CPF *</label><input name="cpf" required inputmode="numeric" placeholder="000.000.000-00" maxlength="14"><div class="campo-hint" id="cpfHint"></div></div>
          <div class="grid g2">
            <div><label>Senha * <span class="muted small">(mín. 6)</span></label><input name="senha" type="password" required minlength="6" autocomplete="new-password"></div>
            <div><label>Confirmar senha *</label><input name="confirmacao" type="password" required autocomplete="new-password"></div>
          </div>
          <div class="campo-hint" id="senhaHint"></div>
          <div class="erro-msg" id="paErro"></div>
          <button class="btn btn-primary" style="width:100%" id="paEnviar" disabled>Enviar cadastro para aprovação</button>
        </form>`;
        const fc = box.querySelector('#paCad');
        box.querySelector('#paTroca').onclick = () => passoEmail('', v.email);
        const validar = () => {
          const cpf = S.digitos(fc.cpf.value), okCpf = S.cpfValido(cpf);
          box.querySelector('#cpfHint').innerHTML = cpf.length < 11 ? '' : okCpf ? '<span class="ok">✓ CPF válido</span>' : '<span class="warn">CPF inválido</span>';
          const s1 = fc.senha.value, s2 = fc.confirmacao.value;
          const okSenha = s1.length >= 6 && s1 === s2;
          box.querySelector('#senhaHint').innerHTML = !s2 ? '' : s1 !== s2 ? '<span class="warn">As senhas não são iguais</span>' : s1.length < 6 ? '<span class="warn">A senha precisa ter ao menos 6 caracteres</span>' : '<span class="ok">✓ As senhas conferem</span>';
          const okNome = fc.nome.value.trim().split(/\s+/).length >= 2;
          fc.querySelector('#paEnviar').disabled = !(okCpf && okSenha && okNome);
        };
        fc.cpf.addEventListener('input', () => { fc.cpf.value = mascaraCpf(fc.cpf.value); validar(); });
        ['nome', 'senha', 'confirmacao'].forEach(k => fc[k].addEventListener('input', validar));
        (v.nomeSugerido ? fc.cpf : fc.nome).focus();
        fc.addEventListener('submit', async e => {
          e.preventDefault();
          const b = fc.querySelector('#paEnviar'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Enviando…';
          mostrarCarregando('Enviando cadastro…');
          try {
            const r = await S.solicitarAcesso({ email: v.email, nome: fc.nome.value, cpf: fc.cpf.value, senha: fc.senha.value, confirmacao: fc.confirmacao.value });
            esconderCarregando();
            passoFim(r);
          } catch (err) { esconderCarregando(); box.querySelector('#paErro').textContent = err.message; b.disabled = false; b.textContent = 'Enviar cadastro para aprovação'; }
        });
      };
      const passoFim = r => {
        box.innerHTML = `<div class="pa-form">
          <div class="pa-etapas"><span class="ok">1 · E-mail</span><span class="ok">2 · Cadastro</span><span class="on">3 · Aprovação</span></div>
          <div class="pa-sucesso">${icon('check', 40)}<h2>Cadastro enviado!</h2>
          <p>Obrigado, <b>${esc(r.nome.split(' ')[0])}</b>. Sua solicitação foi enviada aos gerentes. Assim que um gerente aprovar e definir o seu perfil, você poderá entrar com o e-mail <b>${esc(r.email)}</b> e a senha cadastrada.</p></div>
          <button type="button" class="btn btn-primary" style="width:100%" data-close>Voltar para o login</button>
        </div>`;
      };
      passoEmail();
    });
  }

  // ========== SHELL ==========
  function render() {
    const rt = rotaAtual();
    if (rt.id === 'assinar') return renderAssinar(rt.param);
    const u = S.user();
    if (!u) return renderLogin();
    document.querySelectorAll('.modal-bg').forEach(m => m.remove());
    acFechar();
    const rota = rotaAtual();
    const disp = ROTAS.filter(r => u.nivel >= r.nivel);
    const r = disp.find(x => x.id === rota.id) || disp[0];
    const nPend = pendentesParaMim(u).length;
    const nAcessos = u.nivel >= 3 ? S.acessosPendentes() : 0;
    const nForn = u.nivel >= 3 ? S.fornecedoresPendentes() : 0;
    const nNotif = nAcessos + nForn;

    root.innerHTML = `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">${M.logo(true)}</div>
        <nav class="nav">
          ${disp.map(x => `${x.grupo ? `<div class="nav-grupo">${esc(x.grupo)}</div>` : ''}<a href="#/${x.id}" class="${x.id === r.id ? 'active' : ''}">${icon(x.icon)}<span class="lbl-full">${esc(x.nome)}</span><span class="lbl-short">${esc(x.curto || x.nome)}</span>${x.id === 'aprovacoes' && nPend ? `<span class="badge">${nPend}</span>` : ''}${x.id === 'acessos' && nAcessos ? `<span class="badge">${nAcessos}</span>` : ''}${x.id === 'credenciamento' && nForn ? `<span class="badge">${nForn}</span>` : ''}</a>`).join('')}
        </nav>
        <div class="foot">${esc(C.sistema)} v${esc(C.versao)}<br>${S.modo === 'google' ? '● Conectado ao Google' : '○ Modo demonstração'}</div>
      </aside>
      <div class="main">
        <header class="topbar">
          <div class="mobile-brand">${M.logo(false)}</div>
          <h2 class="page-title-desk">${esc(r.nome)}</h2>
          <div class="user-chip">
            ${u.nivel >= 3 ? `<a class="btn btn-ghost btn-sm sino${nNotif ? ' tem' : ''}" href="#/${nAcessos || !nForn ? 'acessos' : 'credenciamento'}" title="${[nAcessos ? nAcessos + ' usuário(s) aguardando aprovação' : '', nForn ? nForn + ' fornecedor(es) aguardando credenciamento' : ''].filter(Boolean).join(' · ') || 'Sem notificações'}">${icon('bell', 18)}${nNotif ? `<span class="sino-n">${nNotif}</span>` : ''}</a>` : ''}
            <button class="btn btn-ghost btn-sm" id="btnSync" title="Atualizar dados">${icon('sync', 18)}</button>
            <div class="who"><b>${esc(u.nome)}</b><span class="nivel-tag">${esc(S.nomeNivel(u.nivel))}</span></div>
            <button class="avatar" id="btnPerfil" title="Minha conta">${iniciais(u.nome)}</button>
            <button class="btn btn-ghost btn-sm" id="btnSair" title="Sair">${icon('out', 18)}</button>
          </div>
        </header>
        <main class="content" id="view"></main>
      </div>
    </div>`;
    document.getElementById('btnSair').onclick = () => { S.logout(); location.hash = ''; render(); };
    document.getElementById('btnSync').onclick = e => executar(e.currentTarget, () => S.refresh(), 'Dados atualizados.');
    document.getElementById('btnPerfil').onclick = abrirPerfil;

    const view = document.getElementById('view');
    ({ inicio: vInicio, nova: vNova, solicitacoes: vLista, aprovacoes: vAprovacoes, cadastros: vCadastros, acessos: vAcessos, config: vConfig, itens: (e, x) => vCadastros(e, x, 'itens'), fornecedores: (e, x) => vCadastros(e, x, 'fornecedores'), precos: (e, x) => vCadastros(e, x, 'precos'), credenciamento: vCredenciamento }[r.id])(view, u, rota.param);
  }

  // Atualiza sozinho ao voltar para a aba (modo Google)
  let ultimaSync = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !S.user() || S.modo !== 'google') return;
    if (Date.now() - ultimaSync < 60000 || document.querySelector('.modal-bg') || document.getElementById('fNova')) return;
    ultimaSync = Date.now();
    S.refresh().then(render).catch(() => {});
  });

  // ---------- gaveta / modal ----------
  function abrirGaveta(html, onMount) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="drawer" role="dialog" aria-modal="true">${html}</div>`;
    const fechar = () => { bg.remove(); document.removeEventListener('keydown', escK); };
    const escK = e => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', escK);
    bg.addEventListener('click', e => { if (e.target === bg || e.target.closest('[data-close]')) fechar(); });
    document.body.appendChild(bg);
    if (onMount) onMount(bg, fechar);
    return { bg, fechar };
  }
  const btnFechar = `<button class="btn btn-ghost btn-sm" data-close title="Fechar">${icon('x', 18)}</button>`;

  function abrirPerfil() {
    const u = S.user();
    abrirGaveta(`
      <div class="card-head" style="margin:0"><div><div class="small muted">Minha conta</div><h1>${esc(u.nome)}</h1></div>${btnFechar}</div>
      <p class="muted">${esc(u.email)} · ${esc(S.nomeNivel(u.nivel))} · alçada ${brl(S.limiteDoNivel(u.nivel))}</p>
      <form id="fSenha" class="card" style="margin-top:16px">
        <h2 style="margin-bottom:12px">Alterar senha</h2>
        <div class="field"><label>Senha atual</label><input type="password" name="atual" required autocomplete="current-password"></div>
        <div class="field"><label>Nova senha (mín. 6 caracteres)</label><input type="password" name="nova" minlength="6" required autocomplete="new-password"></div>
        <button class="btn btn-primary">Salvar nova senha</button>
      </form>
      <div class="card">
        <div class="card-head"><h2>Minha assinatura</h2>${S.temAssinatura() ? '<span class="status st-aprovado">Cadastrada</span>' : '<span class="status st-pendente">Não cadastrada</span>'}</div>
        <p class="small muted" style="margin-top:-6px">Usada no PDF dos pedidos de compra (solicitação e aprovação). Assine com o mouse ou com o dedo.</p>
        <div id="padPerfil"></div>
        <div class="acoes"><button class="btn btn-primary" id="salvarAss">${icon('pen', 16)} ${S.temAssinatura() ? 'Substituir assinatura' : 'Salvar assinatura'}</button>
        <button class="btn btn-ghost" id="linkCel">${icon('link', 16)} Assinar pelo celular</button></div>
      </div>`, (bg, fechar) => {
      const pad = padAssinatura(bg.querySelector('#padPerfil'));
      bg.querySelector('#salvarAss').onclick = e => {
        if (pad.vazio()) { toast('Faça sua assinatura no quadro antes de salvar.', true); return; }
        executar(e.currentTarget, () => S.act('salvarMinhaAssinatura', { png: pad.exportar() }), 'Assinatura salva.', () => fechar());
      };
      bg.querySelector('#linkCel').onclick = e => executar(e.currentTarget, () => S.act('gerarLinkAssinatura', {}), null, j => { fechar(); mostrarLinkAssinatura(j.state.extra.nome, j.state.extra.token); });
      const f = bg.querySelector('#fSenha');
      f.addEventListener('submit', e => {
        e.preventDefault();
        executar(f.querySelector('button'), () => S.act('changePassword', { atual: f.atual.value, nova: f.nova.value }), 'Senha alterada.', () => fechar());
      });
    });
  }

  // ========== ASSINATURA (quadro para assinar com mouse/dedo) ==========
  function padAssinatura(box) {
    box.innerHTML = `<div class="pad"><canvas></canvas><div class="pad-linha"></div><span class="pad-dica">Assine aqui</span>
      <button type="button" class="btn btn-ghost btn-sm pad-limpar">Limpar</button></div>`;
    const cv = box.querySelector('canvas'), ctx = cv.getContext('2d'), dica = box.querySelector('.pad-dica');
    let desenhou = false, ativo = false, pts = [];
    const ajustar = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.max(window.devicePixelRatio || 1, 2);
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#14285a';
      desenhou = false; dica.hidden = false;
    };
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure || 0.5 }; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); ativo = true; pts = [pos(e)]; dica.hidden = true; });
    cv.addEventListener('pointermove', e => {
      if (!ativo) return; e.preventDefault();
      const p = pos(e); pts.push(p);
      if (pts.length < 3) return;
      const [a, b, c] = pts.slice(-3);
      const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, m2 = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
      const vel = Math.hypot(c.x - b.x, c.y - b.y);
      ctx.lineWidth = Math.max(1.4, Math.min(3.2, 3.4 - vel * 0.08));
      ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.quadraticCurveTo(b.x, b.y, m2.x, m2.y); ctx.stroke();
      desenhou = true;
    });
    const fim = () => { if (ativo && pts.length === 1) { const p = pts[0]; ctx.beginPath(); ctx.arc(p.x, p.y, 1.3, 0, 7); ctx.fillStyle = '#14285a'; ctx.fill(); desenhou = true; } ativo = false; };
    cv.addEventListener('pointerup', fim); cv.addEventListener('pointercancel', fim); cv.addEventListener('pointerleave', fim);
    box.querySelector('.pad-limpar').onclick = ajustar;
    requestAnimationFrame(ajustar);
    return {
      vazio: () => !desenhou,
      /** PNG recortado e reduzido (cabe numa célula da planilha) */
      exportar() {
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
        for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) if (d[(y * cv.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const pad = 12; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(cv.width, x1 + pad); y1 = Math.min(cv.height, y1 + pad);
        let w = x1 - x0, h = y1 - y0, esc = Math.min(1, 520 / w, 180 / h), url = '';
        for (let k = 0; k < 5; k++) {
          const o = document.createElement('canvas'); o.width = Math.max(1, Math.round(w * esc)); o.height = Math.max(1, Math.round(h * esc));
          o.getContext('2d').drawImage(cv, x0, y0, w, h, 0, 0, o.width, o.height);
          url = o.toDataURL('image/png');
          if (url.length < 40000) break;
          esc *= 0.75;
        }
        return url;
      }
    };
  }

  const linkAssinatura = token => location.href.split('#')[0] + '#/assinar/' + token;
  function mostrarLinkAssinatura(nome, token) {
    const url = linkAssinatura(token);
    const msg = `Olá, ${nome.split(' ')[0]}! Cadastre sua assinatura no sistema de Pedidos de Compra da Cheiro Verde Ambiental: ${url}`;
    abrirGaveta(`
      <div class="card-head" style="margin:0"><div><div class="small muted">Link de assinatura</div><h1>${esc(nome)}</h1></div>${btnFechar}</div>
      <p class="muted">Envie este link para a pessoa assinar com o mouse ou com o dedo (no celular). O link vale para uma única assinatura.</p>
      <div class="link-box"><input readonly value="${esc(url)}" id="lkUrl"><button class="btn btn-primary btn-sm" id="lkCopiar">Copiar</button></div>
      <div class="acoes">
        <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Enviar pelo WhatsApp</a>
        <a class="btn btn-ghost" href="mailto:?subject=${encodeURIComponent('Cadastro de assinatura — Pedidos de Compra')}&body=${encodeURIComponent(msg)}">Enviar por e-mail</a>
        <a class="btn btn-ghost" target="_blank" rel="noopener" href="${esc(url)}">Abrir link</a>
      </div>`, bg => {
      bg.querySelector('#lkCopiar').onclick = async () => {
        const inp = bg.querySelector('#lkUrl'); inp.select();
        try { await navigator.clipboard.writeText(url); } catch (e) { document.execCommand('copy'); }
        toast('Link copiado.');
      };
    });
  }

  /** Página pública aberta pelo link (não precisa de login) */
  async function renderAssinar(token) {
    root.innerHTML = `<div class="assinar-wrap"><div class="assinar-card card">
      <div class="assinar-logo">${M.logo(false)}</div>
      <div id="assBox"><div class="empty"><span class="spin dark"></span> Verificando link…</div></div>
    </div></div>`;
    const box = document.getElementById('assBox');
    try {
      const info = await S.assinaturaInfo(token);
      box.innerHTML = `<h1>Cadastro de assinatura</h1>
        <p class="muted">Olá, <b>${esc(info.nome)}</b>. Assine no quadro abaixo como você assina documentos. Ela será usada nos PDFs dos pedidos de compra.</p>
        <div id="padPub"></div>
        <label class="check"><input type="checkbox" id="assOk"> Confirmo que esta é a minha assinatura.</label>
        <button class="btn btn-primary" style="width:100%" id="assSalvar">${icon('pen', 16)} Salvar assinatura</button>`;
      const pad = padAssinatura(box.querySelector('#padPub'));
      box.querySelector('#assSalvar').onclick = async e => {
        if (pad.vazio()) { toast('Faça sua assinatura no quadro.', true); return; }
        if (!box.querySelector('#assOk').checked) { toast('Marque a confirmação.', true); return; }
        const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spin"></span> Salvando…';
        try {
          await S.salvarAssinatura(token, pad.exportar());
          box.innerHTML = `<div class="pa-sucesso">${icon('check', 40)}<h2>Assinatura salva!</h2><p>Obrigado, ${esc(info.nome.split(' ')[0])}. Você já pode fechar esta página.</p></div>
            <a class="btn btn-ghost" style="width:100%" href="#/inicio">Ir para o sistema</a>`;
        } catch (err) { toast(err.message, true); b.disabled = false; b.textContent = 'Salvar assinatura'; }
      };
    } catch (err) {
      box.innerHTML = `<div class="empty">${icon('x', 28)}<p>${esc(err.message)}</p><a class="btn btn-ghost" href="#/inicio">Ir para o sistema</a></div>`;
    }
  }

  // ========== INÍCIO ==========
  function vInicio(el, u) {
    const todas = S.listRequests();
    const minhas = todas.filter(r => r.solicitanteId === u.id);
    const pend = pendentesParaMim(u);
    const lim = S.limites();
    const mesAtual = new Date().toISOString().slice(0, 7);
    const doMes = minhas.filter(r => String(r.criadoEm).slice(0, 7) === mesAtual);
    el.innerHTML = `
      <div class="page-head">
        <div><h1>Olá, ${esc(u.nome.split(' ')[0])}!</h1><p>Resumo das suas solicitações de compra.</p></div>
        <a class="btn btn-accent" href="#/nova">${icon('plus', 18)} Nova solicitação</a>
      </div>
      ${u.nivel >= 3 && S.acessosPendentes() ? `<a class="aviso-acesso" href="#/acessos">${icon('bell', 20)}<div><b>${S.acessosPendentes()} novo(s) cadastro(s) aguardando sua aprovação</b><div class="small">Defina o perfil (Comprador, Supervisor ou Gerente) para liberar o acesso.</div></div><span class="btn btn-accent btn-sm">Analisar</span></a>` : ''}
      ${u.nivel >= 3 && S.fornecedoresPendentes() ? `<a class="aviso-acesso" href="#/credenciamento">${icon('truck', 20)}<div><b>${S.fornecedoresPendentes()} fornecedor(es) aguardando credenciamento</b><div class="small">Confira os dados e credencie ou recuse.</div></div><span class="btn btn-accent btn-sm">Analisar</span></a>` : ''}
      <div class="kpis">
        <div class="kpi destaque"><div class="lbl">Sua alçada</div><div class="val">${brl(lim[u.nivel])}</div><div class="sub">Aprova sozinho até este valor</div></div>
        <div class="kpi"><div class="lbl">Minhas pendentes</div><div class="val">${minhas.filter(r => r.status === 'pendente').length}</div><div class="sub">aguardando aprovação</div></div>
        <div class="kpi"><div class="lbl">Solicitado no mês</div><div class="val">${brl(doMes.reduce((s, r) => s + Number(r.total), 0))}</div><div class="sub">${doMes.length} pedido(s)</div></div>
        <div class="kpi"><div class="lbl">${u.nivel >= 2 ? 'Para eu aprovar' : 'Aguardando compra'}</div><div class="val">${u.nivel >= 2 ? pend.length : minhas.filter(r => r.status === 'aprovado').length}</div><div class="sub">${u.nivel >= 2 ? brl(pend.reduce((s, r) => s + Number(r.total), 0)) : 'aprovadas, ainda não compradas'}</div></div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Alçadas de aprovação</h2></div>
        <div class="alcada">
          ${[1, 2, 3].map(n => `<div class="lvl ${n === u.nivel ? 'me' : ''}"><span class="small muted">${esc(S.nomeNivel(n))}</span><b>até ${brl(lim[n])}</b></div>`).join('')}
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
      <thead><tr><th>Nº</th><th>Data</th><th class="hide-sm">Solicitante</th><th class="hide-sm">Centro de custo</th><th class="hide-sm">Categoria</th><th class="r">Total</th><th>Status</th>${extra ? '<th></th>' : ''}</tr></thead>
      <tbody>${lista.map(r => `<tr class="click" data-id="${r.id}">
        <td><b>${esc(r.numero)}</b>${r.orcamentos && r.orcamentos.length ? ` <span class="clip" title="${r.orcamentos.length} orçamento(s)">${icon('clip', 14)}${r.orcamentos.length}</span>` : ''}<div class="small muted">${esc(r.itens[0] ? r.itens[0].descricao : '')}${r.itens.length > 1 ? ' +' + (r.itens.length - 1) : ''}</div></td>
        <td class="num">${data(r.criadoEm)}</td>
        <td class="hide-sm">${esc(r.solicitanteNome)}</td>
        <td class="hide-sm">${esc(r.centroCusto)}</td>
        <td class="hide-sm">${esc(r.categoria)}</td>
        <td class="r num"><b>${brl(r.total)}</b></td>
        <td>${statusTag(r.status)}${r.status === 'pendente' ? `<div class="small muted">→ ${esc(S.nomeNivel(r.nivelNecessario))}</div>` : ''}</td>
        ${extra ? `<td>${extra(r)}</td>` : ''}
      </tr>`).join('')}</tbody></table></div>`;
  }
  function bindLinhas(el) {
    el.querySelectorAll('tr.click[data-id]').forEach(tr => tr.addEventListener('click', e => {
      if (e.target.closest('button, a')) return;
      abrirDetalhe(tr.dataset.id);
    }));
  }

  const datalists = () => `
    <datalist id="dlItens">${S.catalogo().filter(ativo).map(i => `<option value="${esc(i.descricao)}">${esc(i.codigo)}${i.ultimoPreco !== '' ? ' · ' + brl(i.ultimoPreco) : ''}</option>`).join('')}</datalist>
    <datalist id="dlForn">${S.fornecedores().filter(ativo).map(f => `<option value="${esc(f.nome)}">${esc(f.cidade || '')}</option>`).join('')}</datalist>`;

  // ---------- autocompletar: lista suspensa ABAIXO do campo (a partir de 3 letras) ----------
  const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const AC = { box: null, itens: [], idx: -1, input: null, cfg: null };
  function acBox() {
    if (AC.box && document.body.contains(AC.box)) return AC.box;
    AC.box = document.createElement('div');
    AC.box.className = 'ac-box'; AC.box.setAttribute('role', 'listbox'); AC.box.hidden = true;
    AC.box.addEventListener('mousedown', e => { const op = e.target.closest('.ac-op'); if (op) { e.preventDefault(); acEscolher(+op.dataset.i); } });
    document.body.appendChild(AC.box);
    return AC.box;
  }
  function acPosicionar() {
    if (!AC.box || AC.box.hidden || !AC.input || !document.body.contains(AC.input)) return acFechar();
    const r = AC.input.getBoundingClientRect(), w = Math.min(Math.max(r.width, 300), innerWidth - 16);
    AC.box.style.width = w + 'px';
    AC.box.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    AC.box.style.top = (r.bottom + 4) + 'px';
  }
  function acFechar() { if (AC.box) AC.box.hidden = true; AC.idx = -1; }
  function acAbrir(input, cfg) {
    const q = input.value.trim();
    AC.input = input; AC.cfg = cfg;
    if (semAcento(q).replace(/\s/g, '').length < 3) return acFechar();
    const res = cfg.buscar(q).slice(0, 8);
    const exato = res.some(r => semAcento(r.valor) === semAcento(q));
    AC.itens = res.map(r => Object.assign({ tipo: 'op' }, r));
    if (!exato && cfg.aoCriar) AC.itens.push({ tipo: 'novo', titulo: cfg.textoCriar(q) });
    const b = acBox();
    if (!AC.itens.length) return acFechar();
    b.innerHTML = (res.length ? '' : '<div class="ac-vazio">Nenhum cadastro encontrado</div>') +
      AC.itens.map((it, i) => `<div class="ac-op${it.tipo === 'novo' ? ' novo' : ''}" data-i="${i}" role="option"><div class="t">${it.tipo === 'novo' ? icon('plus', 15) + ' ' : ''}${esc(it.titulo)}</div>${it.sub ? `<div class="s">${esc(it.sub)}</div>` : ''}</div>`).join('');
    b.hidden = false; AC.idx = -1; acPosicionar();
  }
  function acEscolher(i) {
    const it = AC.itens[i], cfg = AC.cfg, input = AC.input;
    acFechar();
    if (!it) return;
    if (it.tipo === 'novo') cfg.aoCriar(input.value.trim());
    else { input.value = it.valor; cfg.aoEscolher(it.obj, input); }
  }
  function autocompletar(input, cfg) {
    input.setAttribute('autocomplete', 'off'); input.removeAttribute('list');
    input.addEventListener('input', () => acAbrir(input, cfg));
    input.addEventListener('focus', () => acAbrir(input, cfg));
    input.addEventListener('blur', () => setTimeout(() => { if (AC.input === input) acFechar(); }, 150));
    input.addEventListener('keydown', e => {
      if (!AC.box || AC.box.hidden || AC.input !== input) return;
      const n = AC.itens.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        AC.idx = e.key === 'ArrowDown' ? (AC.idx + 1) % n : (AC.idx <= 0 ? n - 1 : AC.idx - 1);
        AC.box.querySelectorAll('.ac-op').forEach((o, k) => o.classList.toggle('on', k === AC.idx));
      } else if (e.key === 'Enter' && AC.idx >= 0) { e.preventDefault(); acEscolher(AC.idx); }
      else if (e.key === 'Escape') acFechar();
    });
  }
  window.addEventListener('scroll', acPosicionar, true);
  window.addEventListener('resize', acPosicionar);

  const combina = (q, texto) => { const t = semAcento(texto); return semAcento(q).split(' ').every(p => t.includes(p)); };
  const ordenar = (q, campo) => (a, b) => (semAcento(b[campo]).startsWith(semAcento(q)) - semAcento(a[campo]).startsWith(semAcento(q))) || String(a[campo]).localeCompare(String(b[campo]));
  function buscarItens(q) {
    return S.catalogo().filter(ativo).filter(i => combina(q, i.descricao + ' ' + i.codigo)).sort(ordenar(q, 'descricao'))
      .map(i => ({ titulo: i.descricao, valor: i.descricao, obj: i, sub: `${i.codigo} · ${i.unidade}${i.ultimoPreco !== '' ? ' · último preço ' + brl(i.ultimoPreco) : ''}` }));
  }
  function buscarFornecedores(q) {
    const dig = S.digitos(q);
    return S.fornecedores().filter(ativo).filter(f => combina(q, [f.nome, f.nomeFantasia, f.cidade].join(' ')) || (dig.length >= 3 && S.digitos(f.cnpj).includes(dig))).sort(ordenar(q, 'nome'))
      .map(f => ({ titulo: f.nome, valor: f.nome, obj: f, sub: [f.nomeFantasia, f.cnpj, [f.cidade, f.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ') }));
  }
  const prefillForn = q => (/^[\d.\/\-\s]+$/.test(q) ? { cnpj: q } : { nome: q });
  const NOME_LISTA = { filial: 'Filial', centroCusto: 'Centro de custo', categoria: 'Categoria', unidade: 'Unidade' };

  /** Gerente: adiciona um valor novo a uma lista (Filial, Centro de custo...) */
  function novoValorLista(tipo, aoSalvar) {
    abrirGaveta(`
      <div class="card-head" style="margin:0"><div><div class="small muted">Lista de validação</div><h1>Novo(a) ${esc(NOME_LISTA[tipo])}</h1></div>${btnFechar}</div>
      <form id="fLista" style="margin-top:16px">
        <div class="field"><label>${esc(NOME_LISTA[tipo])}</label><input name="valor" required></div>
        <p class="small muted">O valor é gravado na aba "Listas" ${S.modo === 'google' ? 'da planilha ' : ''}e passa a aparecer para todos.</p>
        <button class="btn btn-primary">Adicionar</button>
      </form>`, (bg, fechar) => {
      const f = bg.querySelector('#fLista'); f.valor.focus();
      f.addEventListener('submit', e => {
        e.preventDefault();
        executar(f.querySelector('button'), () => S.act('addLista', { tipo, valor: f.valor.value }), 'Adicionado à lista.', j => { fechar(); aoSalvar(j.state.extra.salvo); });
      });
    });
  }

  // ========== NOVA SOLICITAÇÃO ==========
  function vNova(el, u) {
    const L = S.listas();
    const minOrc = S.minOrcamentos();
    const novoItem = () => ({ itemId: '', descricao: '', qtd: 1, unidade: 'un', valorUnit: '' });
    const itens = [novoItem()];
    const lim = S.limites();
    const addOpt = u.nivel >= 3 ? '<option value="__novo__">+ Adicionar novo…</option>' : '';
    const sel = (tipo, label, valor) => `<div><label>${label} *</label><select name="${tipo}" data-lista="${tipo}" required><option value="">Selecione…</option>${opts(L[tipo], L[tipo].includes(valor) ? valor : '')}${addOpt}</select></div>`;
    el.innerHTML = `
      <div class="page-head"><div><h1>Nova solicitação de compra</h1><p>Preencha os dados, o fornecedor e os itens. O fluxo de aprovação é definido automaticamente pelo valor total.</p></div></div>
      <form id="fNova">
        <div class="card card-compacto">
          <h2 class="card-titulo"><span class="passo">1</span> Dados gerais</h2>
          <div class="grid g3">
            ${sel('filial', 'Filial', u.filial)}
            ${sel('centroCusto', 'Centro de custo')}
            ${sel('categoria', 'Categoria')}
          </div>
          <div class="field" style="margin:12px 0 0"><label>Motivo da compra *</label><textarea name="justificativa" rows="2" required placeholder="Descreva por que esta compra é necessária"></textarea></div>
          <div class="local-info" id="localInfo">${icon('home', 14)} Detectando a cidade da solicitação…</div>
        </div>
        <div class="card card-compacto">
          <h2 class="card-titulo"><span class="passo">2</span> Fornecedor</h2>
          <label for="inForn">Nome do fornecedor</label>
          <input id="inForn" name="fornecedor" placeholder="Digite 3 letras do nome, nome fantasia ou CNPJ">
          <div id="fornInfo"></div>
          <div class="grid g2 pagto" style="margin-top:14px">
            <div><label>Condição de pagamento *</label><select name="formaPgto" required><option value="">Selecione…</option>${opts(['PIX', 'Boleto', 'Transferência bancária', 'Cartão de crédito', 'Dinheiro'])}</select></div>
            <div id="prazoBox" hidden><label id="prazoLbl">Prazo do boleto (dias) *</label><input name="prazo" placeholder="Ex.: 28  ou  30/60/90"><div class="campo-hint muted" id="prazoHint">Para parcelas, separe os dias com barra: 30/60/90</div></div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2 class="card-titulo" style="margin:0"><span class="passo">3</span> Itens</h2><button type="button" class="btn btn-ghost btn-sm" id="addItem">${icon('plus', 16)} Adicionar item</button></div>
          <p class="small muted" style="margin:-6px 0 10px">Digite ao menos 3 letras da descrição para ver os itens cadastrados. O último preço pago é sugerido automaticamente.</p>
          <div class="table-wrap"><table class="itens-table">
            <thead><tr><th style="width:42%">Descrição</th><th>Qtd</th><th>Unid.</th><th>Valor unit. (R$)</th><th class="r">Subtotal</th><th></th></tr></thead>
            <tbody id="itensBody"></tbody>
          </table></div>
          <div class="total-bar">
            <div><div class="small muted">Valor total</div><div class="v" id="vTotal">R$ 0,00</div></div>
            <div id="hintAlcada" class="hint ok">Informe os itens para calcular a alçada.</div>
          </div>
        </div>
        <div class="card">
          <div class="card-head">
            <h2 class="card-titulo" style="margin:0"><span class="passo">4</span> Orçamentos</h2>
            <span class="orc-cont" id="orcCont"></span>
          </div>
          <p class="small muted" style="margin:-6px 0 12px">Anexe ${minOrc > 0 ? `pelo menos <b>${minOrc} orçamentos</b>` : 'os orçamentos'} (PDF, foto, Word ou Excel — até 10 MB cada). O de menor valor fica destacado.</p>
          <div class="orc-linhas" id="orcLinhas"></div>
          <button type="button" class="btn btn-ghost btn-sm" id="addOrc" style="margin-top:10px">${icon('plus', 16)} Adicionar outro orçamento</button>
        </div>
        <div class="acoes" style="justify-content:flex-end">
          <span class="envio-status" id="envioStatus"></span>
          <a href="#/inicio" class="btn btn-ghost">Cancelar</a>
          <button type="submit" class="btn btn-primary" id="btnEnviar">Enviar solicitação</button>
        </div>
      </form>`;

    // --- orçamentos ---
    const orcs = [];
    const novoOrc = () => ({ fornecedor: '', valor: '', file: null });
    for (let k = 0; k < Math.max(minOrc, 1); k++) orcs.push(novoOrc());
    const orcBox = el.querySelector('#orcLinhas');
    const orcCompleto = o => o.file && o.fornecedor.trim();
    const atualizarOrcStatus = () => {
      const n = orcs.filter(orcCompleto).length;
      const ok = n >= minOrc;
      const cont = el.querySelector('#orcCont');
      cont.className = 'orc-cont' + (ok ? ' ok' : '');
      cont.textContent = `${ok ? '✓ ' : ''}${n} de ${minOrc} anexados`;
      const vals = orcs.filter(o => orcCompleto(o) && Number(o.valor) > 0);
      const menor = vals.length > 1 ? vals.reduce((a, b) => (Number(b.valor) < Number(a.valor) ? b : a)) : null;
      orcBox.querySelectorAll('.orc-linha').forEach((ln, i) => {
        ln.classList.toggle('ok', !!orcCompleto(orcs[i]));
        ln.querySelector('.menor').hidden = orcs[i] !== menor;
      });
      const btn = el.querySelector('#btnEnviar'), st = el.querySelector('#envioStatus');
      btn.disabled = !ok;
      st.className = 'envio-status' + (ok ? ' ok' : '');
      st.textContent = ok ? '' : `Anexe ${minOrc - n} orçamento(s) para liberar o envio`;
    };
    const pintarOrcs = () => {
      orcBox.innerHTML = orcs.map((o, i) => `<div class="orc-linha" data-o="${i}">
        <div class="n">${i + 1}</div>
        <div><label>Fornecedor *</label><input data-ok="fornecedor" value="${esc(o.fornecedor)}" placeholder="Digite 3 letras…"></div>
        <div><label>Valor total (R$)</label><input data-ok="valor" type="number" min="0" step="0.01" value="${esc(o.valor)}" placeholder="0,00"></div>
        <div><label>Arquivo * <span class="menor small" style="color:var(--ok)" hidden>· menor valor</span></label>
          <label class="arq">${icon('clip', 16)}<span>${o.file ? esc(o.file.name) : 'Escolher arquivo…'}</span><input type="file" data-ok="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"></label></div>
        <button type="button" class="btn btn-danger btn-sm" data-rmo="${i}" title="Remover" ${orcs.length <= Math.max(minOrc, 1) ? 'disabled' : ''}>${icon('trash', 16)}</button>
      </div>`).join('');
      orcBox.querySelectorAll('[data-ok=fornecedor]').forEach(inp => {
        const i = +inp.closest('.orc-linha').dataset.o;
        autocompletar(inp, { buscar: buscarFornecedores, aoEscolher: f => { orcs[i].fornecedor = f.nome; atualizarOrcStatus(); }, textoCriar: q => `Cadastrar novo fornecedor "${q}"`,
          aoCriar: q => formFornecedor(null, { prefill: prefillForn(q), onSaved: f => { orcs[i].fornecedor = f.nome; inp.value = f.nome; atualizarOrcStatus(); } }) });
      });
      atualizarOrcStatus();
    };
    const aoMudarOrc = e => {
      const ln = e.target.closest('.orc-linha'); if (!ln || !e.target.dataset.ok) return;
      const o = orcs[+ln.dataset.o], k = e.target.dataset.ok;
      if (k === 'file') { o.file = e.target.files[0] || null; ln.querySelector('.arq span').textContent = o.file ? o.file.name : 'Escolher arquivo…'; }
      else o[k] = e.target.value;
      atualizarOrcStatus();
    };
    orcBox.addEventListener('input', aoMudarOrc);
    orcBox.addEventListener('change', aoMudarOrc);
    orcBox.addEventListener('click', e => { const b = e.target.closest('[data-rmo]'); if (b) { orcs.splice(+b.dataset.rmo, 1); pintarOrcs(); } });
    el.querySelector('#addOrc').onclick = () => { orcs.push(novoOrc()); pintarOrcs(); };

    // --- listas com "+ Adicionar novo…" (Gerente) ---
    el.querySelectorAll('select[data-lista]').forEach(s => {
      s.dataset.ant = s.value;
      s.addEventListener('change', () => {
        if (s.value !== '__novo__') { s.dataset.ant = s.value; return; }
        s.value = s.dataset.ant || '';
        novoValorLista(s.dataset.lista, v => {
          s.innerHTML = '<option value="">Selecione…</option>' + opts(S.listas()[s.dataset.lista], v) + addOpt;
          s.value = v; s.dataset.ant = v;
        });
      });
    });

    // --- condição de pagamento ---
    const fp = el.querySelector('[name=formaPgto]'), prazoBox = el.querySelector('#prazoBox'), prazo = el.querySelector('[name=prazo]');
    fp.addEventListener('change', () => {
      const v = fp.value; prazoBox.hidden = !(v === 'Boleto' || v === 'Cartão de crédito');
      el.querySelector('#prazoLbl').textContent = v === 'Cartão de crédito' ? 'Parcelas *' : 'Prazo do boleto (dias) *';
      prazo.placeholder = v === 'Cartão de crédito' ? 'Ex.: 3' : 'Ex.: 28  ou  30/60/90';
      el.querySelector('#prazoHint').textContent = v === 'Cartão de crédito' ? 'Número de parcelas (1 = à vista)' : 'Para parcelas, separe os dias com barra: 30/60/90';
      prazo.required = !prazoBox.hidden;
    });
    const condicaoPagamento = () => {
      const v = fp.value, pz = (prazo.value.match(/\d+/g) || []).join('/');
      if (v === 'Boleto') return pz ? `Boleto ${pz} dias` : '';
      if (v === 'Cartão de crédito') return pz ? `Cartão de crédito ${pz}x` : '';
      return v;
    };

    // --- cidade (geolocalização de quem solicita) ---
    let cidade = '';
    const localInfo = el.querySelector('#localInfo');
    S.cidadeAtual().then(c => { cidade = c; localInfo.innerHTML = `${icon('home', 14)} Cidade da solicitação: <b>${esc(c)}</b>`; })
      .catch(e => { localInfo.innerHTML = `${icon('home', 14)} ${esc(e.message)} Será usada a filial selecionada.`; localInfo.classList.add('aviso'); });

    // --- fornecedor ---
    const fIn = el.querySelector('#inForn'), fInfo = el.querySelector('#fornInfo');
    const acharForn = v => S.fornecedores().find(f => semAcento(f.nome) === semAcento(v) || (f.nomeFantasia && semAcento(f.nomeFantasia) === semAcento(v)));
    const aoSalvarForn = f => { fIn.value = f.nome; atualizarFornInfo(); };
    const cadastrarForn = q => formFornecedor(null, { prefill: prefillForn(q), onSaved: aoSalvarForn });
    const atualizarFornInfo = () => {
      const v = fIn.value.trim(), f = acharForn(v);
      if (f) {
        const end = [f.endereco, [f.cidade, f.uf].filter(Boolean).join('/'), f.cep ? 'CEP ' + f.cep : ''].filter(Boolean).join(' · ');
        fInfo.innerHTML = `<div class="forn-info">
          <div class="forn-info-top">${f.statusCred === 'pendente' ? '<span class="status st-pendente">Cadastrado · aguardando credenciamento</span>' : f.statusCred === 'recusado' ? '<span class="status st-reprovado">Credenciamento recusado</span>' : '<span class="status st-aprovado">Credenciado</span>'}${f.situacao && !/ATIVA/.test(f.situacao) ? situacaoTag(f.situacao) : ''}<button type="button" class="btn-mini" id="edForn">Ver / editar cadastro</button></div>
          <div class="forn-grid">
            <div><span>CNPJ / CPF</span>${esc(f.cnpj || '—')}</div>
            ${f.inscricaoEstadual ? `<div><span>Inscrição estadual</span>${esc(f.inscricaoEstadual)}</div>` : ''}
            <div class="larga"><span>Endereço</span>${esc(end || '—')}</div>
            ${f.telefone || f.email ? `<div class="larga"><span>Contato</span>${esc([f.contato, f.telefone, f.email].filter(Boolean).join(' · '))}</div>` : ''}
          </div></div>`;
        fInfo.querySelector('#edForn').onclick = () => formFornecedor(f, { onSaved: aoSalvarForn });
        return;
      }
      if (semAcento(v).length < 3) { fInfo.innerHTML = '<p class="small muted" style="margin:8px 0 0">Opcional. Ao escolher um fornecedor cadastrado, os dados dele aparecem aqui.</p>'; return; }
      fInfo.innerHTML = `<div class="forn-alerta">${icon('box', 18)}<div><b>Fornecedor não cadastrado</b><div class="small">"${esc(v)}" não está na base de fornecedores.</div></div><button type="button" class="btn btn-accent btn-sm" id="cadForn">${icon('plus', 15)} Cadastrar fornecedor</button></div>`;
      fInfo.querySelector('#cadForn').onclick = () => cadastrarForn(v);
    };
    autocompletar(fIn, { buscar: buscarFornecedores, aoEscolher: atualizarFornInfo, textoCriar: q => `Cadastrar novo fornecedor "${q}"`, aoCriar: cadastrarForn });
    fIn.addEventListener('input', atualizarFornInfo);
    atualizarFornInfo();

    // --- itens ---
    const body = el.querySelector('#itensBody');
    const precoInfo = (it, i) => {
      if (!it.itemId) {
        return semAcento(it.descricao).length >= 3 ? `<div class="campo-hint"><span class="warn">Item não cadastrado.</span> <button type="button" class="btn-mini laranja" data-cad="${i}">${icon('plus', 13)} Cadastrar item</button></div>` : '';
      }
      const s = S.statsPreco(it.itemId, it.descricao);
      if (!s) return '<div class="preco-info">✓ Item cadastrado · sem compras anteriores</div>';
      const v = Number(it.valorUnit) || 0;
      const dif = v && s.media ? (v / s.media - 1) * 100 : 0;
      return `<div class="preco-info ${dif > 10 ? 'alto' : ''}">últ. ${brl(s.ultimo)}${s.ultimoForn ? ' · ' + esc(s.ultimoForn) : ''} · méd. ${brl(s.media)}${dif > 10 ? ` · ▲ ${dif.toFixed(0)}% acima` : ''}</div>`;
    };
    const linha = i => body.querySelector(`tr[data-i="${i}"]`);
    const aplicarItem = (i, c) => {
      const it = itens[i], tr = linha(i);
      it.itemId = c.id; it.descricao = c.descricao; it.unidade = c.unidade || it.unidade;
      if (!it.valorUnit && c.ultimoPreco !== '' && c.ultimoPreco != null) it.valorUnit = c.ultimoPreco;
      if (tr) {
        tr.querySelector('[data-k=descricao]').value = it.descricao;
        const un = tr.querySelector('[data-k=unidade]');
        if (![...un.options].some(o => o.value === it.unidade)) un.insertAdjacentHTML('beforeend', `<option>${esc(it.unidade)}</option>`);
        un.value = it.unidade;
        tr.querySelector('[data-k=valorUnit]').value = it.valorUnit;
      }
      const cat = el.querySelector('[name=categoria]');
      if (!cat.value && c.categoria && [...cat.options].some(o => o.value === c.categoria)) { cat.value = c.categoria; cat.dataset.ant = c.categoria; }
      if (!fIn.value && c.fornecedorPreferido) { fIn.value = c.fornecedorPreferido; atualizarFornInfo(); }
      atualizarTotal();
      if (tr) tr.querySelector('[data-k=qtd]').focus();
    };
    const cadastrarItem = (i, q) => formItem(null, {
      prefill: { descricao: q, unidade: itens[i].unidade, categoria: el.querySelector('[name=categoria]').value },
      onSaved: c => aplicarItem(i, c)
    });
    const pintarItens = () => {
      body.innerHTML = itens.map((it, i) => `<tr data-i="${i}">
        <td><input data-k="descricao" value="${esc(it.descricao)}" placeholder="Digite 3 letras… ex.: luva" required><div class="pinfo">${precoInfo(it, i)}</div></td>
        <td><input data-k="qtd" type="number" min="0.01" step="any" value="${esc(it.qtd)}" required></td>
        <td><select data-k="unidade">${opts(L.unidade.includes(it.unidade) ? L.unidade : L.unidade.concat([it.unidade]), it.unidade)}</select></td>
        <td><input data-k="valorUnit" type="number" min="0" step="0.01" value="${esc(it.valorUnit)}" placeholder="0,00" required></td>
        <td class="r num sub">${brl((+it.qtd || 0) * (+it.valorUnit || 0))}</td>
        <td><button type="button" class="btn btn-danger btn-sm" data-rm="${i}" title="Remover" ${itens.length === 1 ? 'disabled' : ''}>${icon('trash', 16)}</button></td>
      </tr>`).join('');
      body.querySelectorAll('[data-k=descricao]').forEach(inp => {
        const i = +inp.closest('tr').dataset.i;
        autocompletar(inp, { buscar: buscarItens, aoEscolher: c => aplicarItem(i, c), textoCriar: q => `Cadastrar "${q}" como novo item`, aoCriar: q => cadastrarItem(i, q) });
      });
      atualizarTotal();
    };
    const atualizarTotal = () => {
      const total = S.calcTotal(itens);
      el.querySelector('#vTotal').textContent = brl(total);
      body.querySelectorAll('tr').forEach((tr, i) => {
        tr.querySelector('.sub').textContent = brl((+itens[i].qtd || 0) * (+itens[i].valorUnit || 0));
        tr.querySelector('.pinfo').innerHTML = precoInfo(itens[i], i);
      });
      const h = el.querySelector('#hintAlcada');
      if (!total) { h.className = 'hint ok'; h.textContent = 'Informe os itens para calcular a alçada.'; return; }
      const nec = S.nivelNecessario(total);
      if (nec <= u.nivel) { h.className = 'hint ok'; h.textContent = `✓ Dentro da sua alçada (${brl(lim[u.nivel])}) — será aprovado automaticamente.`; }
      else { h.className = 'hint warn'; h.textContent = `Acima da sua alçada — seguirá para aprovação: ${S.nomeNivel(nec)}.`; }
    };
    const aoMudar = e => {
      const tr = e.target.closest('tr'); if (!tr || !e.target.dataset.k) return;
      const it = itens[+tr.dataset.i];
      it[e.target.dataset.k] = e.target.value;
      if (e.target.dataset.k === 'descricao') {
        const c = S.catalogo().find(x => semAcento(x.descricao) === semAcento(e.target.value));
        it.itemId = c ? c.id : '';
      }
      atualizarTotal();
    };
    body.addEventListener('input', aoMudar);
    body.addEventListener('change', aoMudar);
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-rm]'); if (b) { itens.splice(+b.dataset.rm, 1); pintarItens(); return; }
      const c = e.target.closest('[data-cad]'); if (c) cadastrarItem(+c.dataset.cad, itens[+c.dataset.cad].descricao.trim());
    });
    el.querySelector('#addItem').onclick = () => { itens.push(novoItem()); pintarItens(); body.querySelector('tr:last-child input').focus(); };
    pintarItens();
    pintarOrcs();

    el.querySelector('#fNova').addEventListener('submit', e => {
      e.preventDefault();
      const f = e.target;
      const anexos = orcs.filter(orcCompleto);
      if (anexos.length < minOrc) { toast(`Anexe pelo menos ${minOrc} orçamentos (com fornecedor e arquivo).`, true); el.querySelector('#orcLinhas').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      const cond = condicaoPagamento();
      if (!cond) { toast('Informe a condição de pagamento (e o prazo, se for boleto ou cartão).', true); fp.focus(); return; }
      executar(el.querySelector('#btnEnviar'), () => S.criarSolicitacao({
        filial: f.filial.value, centroCusto: f.centroCusto.value, categoria: f.categoria.value,
        fornecedor: f.fornecedor.value, justificativa: f.justificativa.value, itens,
        condicaoPagamento: cond, cidade: cidade || f.filial.value.replace(/ \(.*\)/, '')
      }, anexos.map(o => ({ fornecedor: o.fornecedor.trim(), valor: o.valor, file: o.file }))), j => {
        const c = j.state.extra.criado;
        return c.status === 'aprovado' ? `${c.numero} criada e aprovada na sua alçada.` : `${c.numero} enviada para aprovação (${S.nomeNivel(c.nivelNecessario)}).`;
      }, async j => {
        const id = j.state.extra.criado.id;
        await gerarPdfPedido(id, { baixar: true });
        if (location.hash === '#/solicitacoes') render(); else location.hash = '#/solicitacoes';
        setTimeout(() => abrirDetalhe(id), 0);
      }, `Enviando solicitação e ${anexos.length} orçamentos…`);
    });
  }

  // ---------- PDF do pedido ----------
  async function gerarPdfPedido(id, o) {
    o = o || {};
    const r = S.getRequest(id); if (!r) return;
    mostrarCarregando(o.msg || `Gerando PDF do pedido ${r.numeroPdf || r.numero}…`);
    try {
      const nomeF = r.fornecedorFinal || r.fornecedor;
      const forn = S.fornecedores().find(x => S.norm(x.nome) === S.norm(nomeF)) || null;
      const ass = await S.assinaturas([r.solicitanteId, r.aprovadorId].filter(Boolean));
      const blob = await window.CVPdf.gerar(S.getRequest(id) || r, forn, ass, n => S.nomeNivel(n));
      if (o.baixar) window.CVPdf.baixar(blob, window.CVPdf.nomeArquivo(r));
      if (o.salvar !== false) { try { await S.salvarPdf(id, blob); } catch (e) { toast('PDF gerado, mas não foi possível salvar no Drive: ' + e.message, true); } }
    } catch (e) { toast('Não foi possível gerar o PDF: ' + e.message, true); }
    esconderCarregando();
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
          <select id="fCC"><option value="">Todos os centros de custo</option>${opts(S.listas().centroCusto)}</select>
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
      if (q) l = l.filter(r => [r.numero, r.fornecedor, r.fornecedorFinal, r.solicitanteNome, r.centroCusto, ...r.itens.map(i => i.descricao)].join(' ').toLowerCase().includes(q));
      el.querySelector('#tab').innerHTML = tabela(l) + `<p class="small muted" style="margin:12px 0 0">${l.length} registro(s) · ${brl(l.reduce((s, r) => s + Number(r.total), 0))}</p>`;
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
    el.querySelectorAll('[data-ap]').forEach(b => b.onclick = () => executar(b, () => S.act('decide', { id: b.dataset.ap, aprovar: true, obs: '' }), 'Solicitação aprovada.',
      async () => { await gerarPdfPedido(b.dataset.ap, { msg: 'Atualizando o PDF com a aprovação…' }); render(); }));
    el.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => abrirDetalhe(b.dataset.rp, 'reprovar'));
  }

  // ========== DETALHE (gaveta lateral) ==========
  function abrirDetalhe(id, foco) {
    const u = S.user();
    const r = S.getRequest(id);
    if (!r) return;
    const podeDecidir = S.podeAprovar(u, r);
    const podeCancelar = r.status === 'pendente' && (r.solicitanteId === u.id || u.nivel >= 3);
    const podeComprar = r.status === 'aprovado';
    const podeAnexar = ['pendente', 'aprovado'].includes(r.status) && (r.solicitanteId === u.id || u.nivel >= 2);
    const orcs = r.orcamentos || [];
    const menorOrc = orcs.filter(o => Number(o.valor) > 0).sort((a, b) => a.valor - b.valor)[0];
    const reabrir = () => { render(); abrirDetalhe(id); };

    abrirGaveta(`
      ${datalists()}
      <div class="card-head" style="margin:0">
        <div><div class="small muted">Solicitação</div><h1>${esc(r.numero)}</h1></div>${btnFechar}
      </div>
      <div style="margin-top:8px">${statusTag(r.status)} ${r.status === 'pendente' ? `<span class="small muted">aguardando <b>${esc(S.nomeNivel(r.nivelNecessario))}</b></span>` : ''}</div>
      <div class="dl">
        <div><span>Solicitante</span>${esc(r.solicitanteNome)} <span class="nivel-tag">${esc(S.nomeNivel(r.nivelSolicitante))}</span></div>
        <div><span>Criada em</span>${dataHora(r.criadoEm)}</div>
        <div><span>Filial</span>${esc(r.filial)}</div>
        <div><span>Centro de custo</span>${esc(r.centroCusto)}</div>
        <div><span>Categoria</span>${esc(r.categoria)}</div>
        <div><span>Fornecedor sugerido</span>${esc(r.fornecedor || '—')}</div>
        <div><span>Condição de pagamento</span>${esc(r.condicaoPagamento || '—')}</div>
        <div><span>Cidade</span>${esc(r.cidade || '—')}</div>
        ${r.urgencia ? `<div><span>Urgência</span><b class="urg-${esc(r.urgencia)}">${esc(r.urgencia)}</b></div>` : ''}
        ${r.dataNecessidade ? `<div><span>Necessário até</span>${data(r.dataNecessidade)}</div>` : ''}
        ${r.aprovadorNome ? `<div><span>${r.status === 'reprovado' ? 'Reprovado por' : 'Aprovado por'}</span>${esc(r.aprovadorNome)}${r.nivelAprovador ? ' (' + esc(S.nomeNivel(r.nivelAprovador)) + ')' : ''}</div><div><span>Decisão em</span>${dataHora(r.decididoEm)}</div>` : ''}
        ${r.compradoEm ? `<div><span>Comprado de</span>${esc(r.fornecedorFinal || r.fornecedor || '—')}</div><div><span>Comprado em</span>${dataHora(r.compradoEm)}</div>` : ''}
      </div>
      ${r.justificativa ? `<h3>Motivo da compra</h3><p style="margin:6px 0 16px">${esc(r.justificativa)}</p>` : ''}
      <h3>Itens</h3>
      <div class="table-wrap"><table><thead><tr><th>Descrição</th><th class="r">Qtd</th><th class="r">Unit.</th><th class="r">Subtotal</th></tr></thead>
        <tbody>${r.itens.map(i => { const s = S.statsPreco(i.itemId, i.descricao); return `<tr><td>${esc(i.descricao)}${s && r.status !== 'comprado' ? `<div class="small muted">últ. pago ${brl(s.ultimo)} · méd. ${brl(s.media)}</div>` : ''}</td><td class="r num">${i.qtd} ${esc(i.unidade)}</td><td class="r num">${brl(i.valorUnit)}</td><td class="r num">${brl(i.qtd * i.valorUnit)}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td colspan="3"><b>Total</b></td><td class="r num"><b>${brl(r.total)}</b></td></tr></tfoot></table></div>

      <div class="pdf-box">
        ${icon('file', 26)}
        <div><b>Pedido de Compra Nº ${esc(r.numeroPdf || r.numero)}</b><div class="small muted">${r.pdfUrl ? 'Salvo no Drive · ' : ''}Com logo, fornecedor, itens, cidade, data da aprovação e assinaturas.</div></div>
        <div class="pdf-acoes">
          <button type="button" class="btn btn-primary btn-sm" id="btnPdf">${icon('file', 15)} Baixar PDF</button>
          ${r.pdfUrl ? `<a class="btn btn-ghost btn-sm" href="${esc(r.pdfUrl)}" target="_blank" rel="noopener">Abrir no Drive</a>` : ''}
        </div>
      </div>
      <h3 style="margin:20px 0 10px">Orçamentos (${orcs.length})</h3>
      ${orcs.length ? `<div class="orc-list">${orcs.map(o => `<div class="orc ${menorOrc && o.id === menorOrc.id && orcs.length > 1 ? 'melhor' : ''}">
          ${icon('file', 22)}
          <div class="orc-info"><a href="${esc(o.arquivoUrl)}" target="_blank" rel="noopener" ${String(o.arquivoUrl).startsWith('data:') ? `download="${esc(o.arquivoNome)}"` : ''}><b>${esc(o.fornecedor || 'Orçamento')}</b></a>
            <div class="small muted">${esc(o.arquivoNome)} · ${esc(o.enviadoPor)} · ${data(o.em)}</div></div>
          <div class="r num"><b>${Number(o.valor) ? brl(o.valor) : ''}</b>${menorOrc && o.id === menorOrc.id && orcs.length > 1 ? '<div class="small" style="color:var(--ok)">menor valor</div>' : ''}</div>
          ${(o.enviadoPor === u.nome || u.nivel >= 2) && r.status !== 'comprado' ? `<button class="btn btn-ghost btn-sm" data-rmorc="${o.id}" title="Remover">${icon('trash', 16)}</button>` : ''}
        </div>`).join('')}</div>` : '<p class="small muted" style="margin:0 0 8px">Nenhum orçamento anexado.</p>'}
      ${podeAnexar ? `<form id="fOrc" class="card orc-form">
          <div class="grid g3">
            <div><label>Fornecedor</label><input name="fornecedor" list="dlForn" value="${esc(orcs.length ? '' : r.fornecedor)}" required></div>
            <div><label>Valor total (R$)</label><input name="valor" type="number" min="0" step="0.01" placeholder="0,00"></div>
            <div><label>Arquivo (PDF/imagem)</label><input name="arquivo" type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" required></div>
          </div>
          <button class="btn btn-ghost btn-sm" style="margin-top:10px">${icon('clip', 16)} Anexar orçamento${S.modo === 'google' ? ' no Drive' : ''}</button>
        </form>` : ''}

      ${(podeDecidir || podeCancelar || podeComprar) ? `
        <div class="card" style="margin-top:18px;background:var(--verde-50)">
          ${podeComprar ? `<div class="field"><label>Comprado de (fornecedor final)</label><input id="fornFinal" list="dlForn" value="${esc(menorOrc ? menorOrc.fornecedor : r.fornecedor)}"></div>` : ''}
          <label for="obs">Observação ${podeDecidir ? '(obrigatória para reprovar)' : ''}</label>
          <textarea id="obs" placeholder="Comentário opcional…"></textarea>
          <div class="acoes">
            ${podeDecidir ? `<button class="btn btn-primary" data-act="aprovar">Aprovar</button><button class="btn btn-danger" data-act="reprovar">Reprovar</button>` : ''}
            ${podeComprar ? `<button class="btn btn-accent" data-act="comprar">Marcar como comprado</button>` : ''}
            ${podeCancelar ? `<button class="btn btn-ghost" data-act="cancelar">Cancelar solicitação</button>` : ''}
          </div>
          ${podeComprar ? '<p class="small muted" style="margin:8px 0 0">Ao marcar como comprado, os preços entram no histórico e o cadastro de itens é atualizado.</p>' : ''}
        </div>` : ''}
      <h3 style="margin:20px 0 10px">Histórico</h3>
      <ul class="timeline">${r.historico.map(h => `<li><b>${esc(h.acao)}</b><div class="small muted">${dataHora(h.em)} · ${esc(h.usuario)}</div>${h.obs ? `<div class="small">“${esc(h.obs)}”</div>` : ''}</li>`).join('')}</ul>
    `, (bg) => {
      bg.querySelector('.drawer').setAttribute('aria-label', 'Solicitação ' + r.numero);
      bg.querySelector('#btnPdf').onclick = () => gerarPdfPedido(r.id, { baixar: true, salvar: !r.pdfUrl && (r.solicitanteId === u.id || u.nivel >= 2) });
      bg.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
        const obs = bg.querySelector('#obs').value;
        const a = b.dataset.act;
        const acoes = {
          aprovar: () => S.act('decide', { id: r.id, aprovar: true, obs }),
          reprovar: () => S.act('decide', { id: r.id, aprovar: false, obs }),
          comprar: () => S.act('markPurchased', { id: r.id, obs, fornecedor: bg.querySelector('#fornFinal').value }),
          cancelar: () => S.act('cancel', { id: r.id, obs })
        };
        executar(b, acoes[a], { aprovar: 'Solicitação aprovada.', reprovar: 'Solicitação reprovada.', comprar: 'Compra registrada e preços salvos no histórico.', cancelar: 'Solicitação cancelada.' }[a],
          ['aprovar', 'reprovar'].includes(a) ? async () => { await gerarPdfPedido(r.id, { msg: 'Atualizando o PDF com a aprovação…' }); render(); abrirDetalhe(r.id); } : undefined);
      });
      const fo = bg.querySelector('#fOrc');
      if (fo) fo.addEventListener('submit', e => {
        e.preventDefault();
        executar(fo.querySelector('button'), () => S.upload(r.id, fo.arquivo.files[0], fo.fornecedor.value, fo.valor.value), 'Orçamento anexado.', reabrir, 'Enviando orçamento…');
      });
      bg.querySelectorAll('[data-rmorc]').forEach(b => b.onclick = () => {
        if (!confirm('Remover este orçamento da solicitação? (o arquivo continua no Drive)')) return;
        executar(b, () => S.act('removeOrcamento', { id: b.dataset.rmorc }), 'Orçamento removido.', reabrir);
      });
      if (foco === 'reprovar') { const o = bg.querySelector('#obs'); if (o) o.focus(); }
    });
  }

  // ========== CADASTROS: ITENS, FORNECEDORES, PREÇOS ==========
  function vCadastros(el, u, aba) {
    aba = ['itens', 'fornecedores', 'precos'].includes(aba) ? aba : 'itens';
    const TIT = {
      itens: ['Itens', `${S.catalogo().length} itens cadastrados. Clique em um item para ver o histórico de preços.`],
      fornecedores: ['Fornecedores', `${S.fornecedores().length} fornecedores. Novos cadastros passam pelo credenciamento de um gerente.`],
      precos: ['Histórico de preços', 'Preços pagos, gravados automaticamente a cada compra efetivada.']
    }[aba];
    el.innerHTML = `
      <div class="page-head"><div><h1>${TIT[0]}</h1><p>${TIT[1]}</p></div></div>
      <div id="aba"></div>`;
    const box = el.querySelector('#aba');
    ({ itens: abaItens, fornecedores: abaFornecedores, precos: abaPrecos })[aba](box, u);
  }

  function abaItens(box, u) {
    const itens = S.catalogo();
    box.innerHTML = `
      <div class="card">
        <div class="filters"><input type="search" id="q" placeholder="Buscar código, descrição, categoria…"><select id="qCat"><option value="">Todas as categorias</option>${opts(S.listas().categoria)}</select>
          <button class="btn btn-accent" id="novo">${icon('plus', 16)} Novo item</button></div>
        <div id="lista"></div>
      </div>`;
    const pintar = () => {
      const q = box.querySelector('#q').value.trim().toLowerCase(), cat = box.querySelector('#qCat').value;
      const l = itens.filter(i => (!cat || i.categoria === cat) && (!q || [i.codigo, i.descricao, i.categoria, i.fornecedorPreferido].join(' ').toLowerCase().includes(q)));
      box.querySelector('#lista').innerHTML = l.length ? `<div class="table-wrap"><table>
        <thead><tr><th class="hide-sm">Código</th><th>Descrição</th><th class="hide-sm">Categoria</th><th class="r">Último preço</th><th class="r hide-sm">Média</th><th class="hide-sm">Fornecedor pref.</th><th></th></tr></thead>
        <tbody>${l.map(i => { const s = S.statsPreco(i.id, i.descricao); return `<tr class="click ${ativo(i) ? '' : 'inativo'}" data-item="${i.id}">
          <td class="num hide-sm">${esc(i.codigo)}</td><td><b>${esc(i.descricao)}</b><div class="small muted">${esc(i.codigo)} · ${esc(i.unidade)}${s ? ' · ' + s.n + ' compra(s)' : ''}${ativo(i) ? '' : ' · inativo'}</div></td>
          <td class="hide-sm">${esc(i.categoria)}</td>
          <td class="r num">${i.ultimoPreco !== '' ? brl(i.ultimoPreco) : '—'}<div class="small muted">${i.ultimaCompra ? data(i.ultimaCompra) : ''}</div></td>
          <td class="r num hide-sm">${s ? brl(s.media) : '—'}</td>
          <td class="hide-sm">${esc(i.fornecedorPreferido || '—')}</td>
          <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-ed="${i.id}">Editar</button>${u.nivel >= 2 ? ` <button class="btn btn-ghost btn-sm" data-tg="${i.id}">${ativo(i) ? 'Desativar' : 'Ativar'}</button>` : ''}</td>
        </tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Nenhum item encontrado.</div>';
      box.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => formItem(itens.find(i => i.id === b.dataset.ed)));
      box.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => executar(b, () => S.act('toggleItem', { id: b.dataset.tg }), 'Item atualizado.'));
      box.querySelectorAll('tr[data-item]').forEach(tr => tr.onclick = e => { if (!e.target.closest('button')) historicoItem(itens.find(i => i.id === tr.dataset.item)); });
    };
    box.querySelector('#novo').onclick = () => formItem(null);
    box.querySelectorAll('#q, #qCat').forEach(i => i.addEventListener('input', pintar));
    pintar();
  }

  function formItem(it, o) {
    o = o || {};
    const base = it || o.prefill || {};
    const L = S.listas();
    abrirGaveta(`${datalists()}
      <div class="card-head" style="margin:0"><div><div class="small muted">${it ? esc(it.codigo) : 'Novo cadastro'}</div><h1>${it ? 'Editar item' : 'Novo item'}</h1></div>${btnFechar}</div>
      <form id="fItem" style="margin-top:16px">
        <div class="field"><label>Descrição *</label><input name="descricao" required value="${esc(base.descricao || '')}"></div>
        <div class="grid g2">
          <div><label>Unidade</label><select name="unidade">${opts(L.unidade.includes(base.unidade || 'un') ? L.unidade : L.unidade.concat([base.unidade]), base.unidade || 'un')}</select></div>
          <div><label>Categoria</label><select name="categoria"><option value="">—</option>${opts(!base.categoria || L.categoria.includes(base.categoria) ? L.categoria : L.categoria.concat([base.categoria]), base.categoria || '')}</select></div>
        </div>
        <div class="field" style="margin-top:14px"><label>Fornecedor preferido</label><input name="fornecedorPreferido" list="dlForn" value="${esc(base.fornecedorPreferido || '')}"></div>
        ${it ? '' : '<p class="small muted">O código (IT-0000) é gerado automaticamente.</p>'}
        <button class="btn btn-primary">Salvar item</button>
      </form>`, (bg, fechar) => {
      const f = bg.querySelector('#fItem');
      if (!it) f.descricao.focus();
      f.addEventListener('submit', e => {
        e.preventDefault();
        executar(f.querySelector('button'), () => S.act('saveItem', { item: { id: it ? it.id : '', descricao: f.descricao.value, unidade: f.unidade.value, categoria: f.categoria.value, fornecedorPreferido: f.fornecedorPreferido.value } }),
          'Item salvo.', o.onSaved ? j => { fechar(); o.onSaved(j.state.extra.salvo); } : undefined);
      });
    });
  }

  function historicoItem(it) {
    const s = S.statsPreco(it.id, it.descricao);
    const l = s ? s.lista : [];
    const mx = Math.max(1, ...l.map(p => Number(p.valorUnit)));
    const serie = l.slice(0, 12).reverse();
    abrirGaveta(`
      <div class="card-head" style="margin:0"><div><div class="small muted">${esc(it.codigo)} · ${esc(it.unidade)}</div><h1>${esc(it.descricao)}</h1></div>${btnFechar}</div>
      ${s ? `<div class="kpis" style="grid-template-columns:repeat(2,1fr);margin-top:16px">
        <div class="kpi destaque"><div class="lbl">Último preço</div><div class="val">${brl(s.ultimo)}</div><div class="sub">${esc(s.ultimoForn || '')} · ${data(s.ultimaData)}</div></div>
        <div class="kpi"><div class="lbl">Média</div><div class="val">${brl(s.media)}</div><div class="sub">mín. ${brl(s.min)} · máx. ${brl(s.max)}</div></div>
      </div>
      <div class="card"><h3 style="margin-bottom:8px">Evolução (últimas ${serie.length} compras)</h3>
        <div class="vbars" style="height:140px">${serie.map(p => `<div class="col" title="${data(p.em)} · ${esc(p.fornecedor)} · ${brl(p.valorUnit)}"><span class="v">${brlK(p.valorUnit)}</span><div class="stack" style="height:${(p.valorUnit / mx * 80).toFixed(1)}%"><div class="seg-a" style="flex:1"></div></div></div>`).join('')}</div>
        <div class="vlabels">${serie.map(p => `<span>${new Date(p.em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>`).join('')}</div>
      </div>
      <div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Data</th><th>Fornecedor</th><th class="r">Qtd</th><th class="r">Unitário</th><th>Pedido</th></tr></thead>
        <tbody>${l.map(p => `<tr><td class="num">${data(p.em)}</td><td>${esc(p.fornecedor)}</td><td class="r num">${p.qtd}</td><td class="r num"><b>${brl(p.valorUnit)}</b></td><td class="small">${esc(p.numero)}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="empty">Ainda não há compras registradas para este item. O histórico é gerado quando um pedido é marcado como <b>comprado</b>.</div>'}`);
  }

  function abaFornecedores(box, u) {
    const lst = S.fornecedores();
    const gasto = {};
    S.listRequests().filter(r => r.status === 'comprado').forEach(r => { const k = S.norm(r.fornecedorFinal || r.fornecedor); gasto[k] = (gasto[k] || 0) + Number(r.total); });
    box.innerHTML = `
      <div class="card">
        <div class="filters"><input type="search" id="q" placeholder="Buscar nome, CNPJ, cidade, categoria…"><button class="btn btn-accent" id="novo">${icon('plus', 16)} Novo fornecedor</button></div>
        <div id="lista"></div>
      </div>`;
    const pintar = () => {
      const q = box.querySelector('#q').value.trim().toLowerCase();
      const l = lst.filter(f => !q || [f.nome, f.nomeFantasia, f.cnpj, S.digitos(f.cnpj), f.cidade, f.categorias, f.contato].join(' ').toLowerCase().includes(q));
      box.querySelector('#lista').innerHTML = l.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Fornecedor</th><th class="hide-sm">Contato</th><th class="hide-sm">Categorias</th>${u.nivel >= 2 ? '<th class="r">Comprado</th>' : ''}<th></th></tr></thead>
        <tbody>${l.map(f => `<tr class="${ativo(f) ? '' : 'inativo'}">
          <td><b>${esc(f.nome)}</b> ${credTag(f)}${f.situacao && !/ATIVA/.test(f.situacao) ? ' ' + situacaoTag(f.situacao) : ''}<div class="small muted">${[f.nomeFantasia, f.cnpj, f.inscricaoEstadual ? 'IE ' + f.inscricaoEstadual : '', [f.cidade, f.uf].filter(Boolean).join('/')].filter(Boolean).map(esc).join(' · ')}${ativo(f) ? '' : ' · inativo'}</div></td>
          <td class="hide-sm">${esc(f.contato)}<div class="small muted">${[f.telefone, f.email].filter(Boolean).map(esc).join(' · ')}</div></td>
          <td class="hide-sm small">${esc(f.categorias)}</td>
          ${u.nivel >= 2 ? `<td class="r num">${gasto[S.norm(f.nome)] ? brl(gasto[S.norm(f.nome)]) : '—'}</td>` : ''}
          <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-ed="${f.id}">Editar</button>${u.nivel >= 2 ? ` <button class="btn btn-ghost btn-sm" data-tg="${f.id}">${ativo(f) ? 'Desativar' : 'Ativar'}</button>` : ''}</td>
        </tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhum fornecedor encontrado.</div>';
      box.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => formFornecedor(lst.find(f => f.id === b.dataset.ed)));
      box.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => executar(b, () => S.act('toggleFornecedor', { id: b.dataset.tg }), 'Fornecedor atualizado.'));
    };
    box.querySelector('#novo').onclick = () => formFornecedor(null);
    box.querySelector('#q').addEventListener('input', pintar);
    pintar();
  }

  const credTag = f => f.statusCred === 'pendente' ? '<span class="status st-pendente">Aguardando credenciamento</span>' : f.statusCred === 'recusado' ? '<span class="status st-reprovado">Credenciamento recusado</span>' : '';
  const situacaoTag = s => s ? `<span class="status ${/ATIVA/.test(s) ? 'st-aprovado' : 'st-reprovado'}">Receita: ${esc(s)}</span>` : '';

  function formFornecedor(f, o) {
    o = o || {};
    const base = f || o.prefill || {};
    const v = k => esc(base[k] || '');
    abrirGaveta(`
      <div class="card-head" style="margin:0"><div><div class="small muted">Cadastro</div><h1>${f ? 'Editar fornecedor' : 'Novo fornecedor'}</h1></div>${btnFechar}</div>
      <form id="fForn" style="margin-top:16px">
        <label>CNPJ / CPF</label>
        <div class="doc-row">
          <input name="cnpj" value="${v('cnpj')}" placeholder="00.000.000/0000-00" inputmode="numeric" autocomplete="off">
          <button type="button" class="btn btn-ghost" id="btnReceita">Consultar Receita</button>
        </div>
        <div id="docHint" class="campo-hint"><span class="muted">Digite o CNPJ e clique em "Consultar Receita" para preencher os dados automaticamente.</span></div>
        <div id="sitBox" style="margin:10px 0">${situacaoTag(base.situacao)}${base.atividade ? `<div class="small muted" style="margin-top:4px">${esc(base.atividade)}</div>` : ''}</div>
        <div class="field"><label>Razão social *</label><input name="nome" required value="${v('nome')}"></div>
        <div class="grid g2" style="margin-bottom:14px">
          <div><label>Nome fantasia</label><input name="nomeFantasia" value="${v('nomeFantasia')}"></div>
          <div><label>Inscrição estadual</label><input name="inscricaoEstadual" value="${v('inscricaoEstadual')}" placeholder="Se houver"></div>
        </div>
        <div class="field"><label>Endereço</label><input name="endereco" value="${v('endereco')}"></div>
        <div class="grid g3">
          <div><label>Cidade</label><input name="cidade" value="${v('cidade')}"></div>
          <div><label>UF</label><input name="uf" maxlength="2" value="${v('uf')}"></div>
          <div><label>CEP</label><input name="cep" value="${v('cep')}"></div>
        </div>
        <div class="grid g2" style="margin-top:14px">
          <div><label>Contato</label><input name="contato" value="${v('contato')}"></div>
          <div><label>Telefone / WhatsApp</label><input name="telefone" value="${v('telefone')}"></div>
        </div>
        <div class="field" style="margin-top:14px"><label>E-mail</label><input name="email" type="email" value="${v('email')}"></div>
        <div class="field"><label>Categorias que fornece</label><input name="categorias" value="${v('categorias')}" placeholder="Ex.: EPI; Embalagens e coletores"></div>
        <input type="hidden" name="situacao" value="${v('situacao')}"><input type="hidden" name="atividade" value="${v('atividade')}">
        <button class="btn btn-primary">Salvar fornecedor</button>
      </form>`, (bg, fechar) => {
      const fm = bg.querySelector('#fForn');
      const hint = bg.querySelector('#docHint');
      const btn = bg.querySelector('#btnReceita');
      const aviso = (cls, msg) => { hint.innerHTML = `<span class="${cls}">${msg}</span>`; };
      const consultar = async () => {
        const d = S.digitos(fm.cnpj.value);
        if (d.length === 11) { S.cpfValido(d) ? aviso('ok', '✓ CPF válido. A Receita não oferece consulta pública de CPF — preencha os dados manualmente.') : aviso('warn', 'CPF inválido — confira os números.'); return; }
        if (d.length !== 14) { aviso('warn', 'Digite um CNPJ (14 dígitos) ou CPF (11 dígitos).'); return; }
        if (!S.cnpjValido(d)) { aviso('warn', 'CNPJ inválido — confira os números.'); return; }
        const dup = S.fornecedores().find(x => S.digitos(x.cnpj) === d && (!f || x.id !== f.id));
        if (dup) { aviso('warn', `Este CNPJ já está cadastrado como "${esc(dup.nome)}".`); return; }
        btn.disabled = true; btn.innerHTML = '<span class="spin dark"></span> Consultando…';
        try {
          const r = await S.consultaCnpj(d);
          fm.cnpj.value = r.cnpj || fm.cnpj.value;
          ['nome:razaoSocial', 'nomeFantasia', 'inscricaoEstadual', 'endereco', 'cidade', 'uf', 'cep', 'telefone', 'email', 'situacao', 'atividade'].forEach(par => {
            const [campo, chave] = par.split(':'); const val = r[chave || campo];
            if (val) fm[campo].value = val;
          });
          bg.querySelector('#sitBox').innerHTML = situacaoTag(r.situacao) + (r.atividade ? `<div class="small muted" style="margin-top:4px">${esc(r.atividade)}</div>` : '');
          if (r.situacao && !/ATIVA/.test(r.situacao)) aviso('warn', `Atenção: empresa com situação "${esc(r.situacao)}" na Receita.`);
          else aviso('ok', '✓ Dados preenchidos pela Receita Federal.' + (r.inscricaoEstadual ? '' : ' Inscrição estadual não encontrada — preencha se houver.') + ' Confira antes de salvar.');
        } catch (e) { aviso('warn', esc(e.message)); }
        btn.disabled = false; btn.textContent = 'Consultar Receita';
      };
      btn.onclick = consultar;
      fm.cnpj.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); consultar(); } });
      fm.cnpj.addEventListener('blur', () => { if (S.digitos(fm.cnpj.value).length === 14 && !fm.nome.value.trim()) consultar(); });
      if (!f && S.digitos(base.cnpj).length === 14) consultar();
      else (f ? fm.nome : fm.cnpj).focus();
      fm.addEventListener('submit', e => {
        e.preventDefault();
        const d = { id: f ? f.id : '' };
        ['nome', 'cnpj', 'nomeFantasia', 'inscricaoEstadual', 'endereco', 'cidade', 'uf', 'cep', 'contato', 'telefone', 'email', 'categorias', 'situacao', 'atividade'].forEach(k => { d[k] = fm[k].value; });
        executar(fm.querySelector('button[class~="btn-primary"]'), () => S.act('saveFornecedor', { fornecedor: d }), j => j.state.extra.msg || 'Fornecedor salvo.',
          o.onSaved ? j => { fechar(); o.onSaved(j.state.extra.salvo); } : undefined);
      });
    });
  }

  function abaPrecos(box) {
    const l = S.precos();
    box.innerHTML = `
      <div class="card">
        <div class="filters"><input type="search" id="q" placeholder="Filtrar por item, fornecedor ou pedido…"><button class="btn btn-ghost" id="exp">Exportar CSV</button></div>
        <div id="lista"></div>
      </div>`;
    const pintar = () => {
      const q = box.querySelector('#q').value.trim().toLowerCase();
      const f = l.filter(p => !q || [p.codigo, p.descricao, p.fornecedor, p.numero].join(' ').toLowerCase().includes(q)).slice(0, 300);
      box.querySelector('#lista').innerHTML = f.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Item</th><th class="hide-sm">Fornecedor</th><th class="r">Qtd</th><th class="r">Unitário</th><th class="hide-sm">Pedido</th></tr></thead>
        <tbody>${f.map(p => `<tr><td class="num">${data(p.em)}</td><td><b>${esc(p.descricao)}</b><div class="small muted">${esc(p.codigo)}</div></td><td class="hide-sm">${esc(p.fornecedor)}</td><td class="r num">${p.qtd} ${esc(p.unidade)}</td><td class="r num"><b>${brl(p.valorUnit)}</b></td><td class="hide-sm small">${esc(p.numero)}</td></tr>`).join('')}</tbody></table></div>
        <p class="small muted" style="margin:12px 0 0">${f.length} registro(s)${f.length === 300 ? ' (mostrando os 300 mais recentes)' : ''}. Gerado automaticamente a cada compra efetivada.</p>` : '<div class="empty">Nenhum preço registrado ainda. Os preços entram aqui quando um pedido é marcado como comprado.</div>';
    };
    box.querySelector('#q').addEventListener('input', pintar);
    box.querySelector('#exp').onclick = () => download('historico-precos.csv', S.exportPrecosCSV(), 'text/csv;charset=utf-8');
    pintar();
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
        <select id="dFil"><option value="">Todas as filiais</option>${opts(S.listas().filial)}</select>
        <select id="dCC"><option value="">Todos os centros de custo</option>${opts(S.listas().centroCusto)}</select>
      </div>
      <div id="dash"></div>`;
    el.querySelector('#expCSV').onclick = () => download('pedidos-compra.csv', S.exportCSV(), 'text/csv;charset=utf-8');
    el.querySelector('#expJSON').onclick = () => download('pedidos-compra.json', S.exportJSON(), 'application/json');

    const pintar = () => {
      const dias = +el.querySelector('#dPer').value, fil = el.querySelector('#dFil').value, cc = el.querySelector('#dCC').value;
      const desde = dias ? Date.now() - dias * 86400000 : 0;
      const l = S.listRequests().filter(r => new Date(r.criadoEm).getTime() >= desde && (!fil || r.filial === fil) && (!cc || r.centroCusto === cc));
      const soma = arr => arr.reduce((s, r) => s + Number(r.total), 0);
      const aprov = l.filter(r => ['aprovado', 'comprado'].includes(r.status));
      const pend = l.filter(r => r.status === 'pendente');
      const reprov = l.filter(r => r.status === 'reprovado');
      const decididas = aprov.length + reprov.length;
      const taxa = decididas ? Math.round(aprov.length / decididas * 100) : 0;
      const comEscalada = l.filter(r => r.decididoEm && r.aprovadorId !== r.solicitanteId);
      const horas = comEscalada.length ? comEscalada.reduce((s, r) => s + (new Date(r.decididoEm) - new Date(r.criadoEm)), 0) / comEscalada.length / 3600000 : 0;

      const meses = [];
      const ref = new Date(); ref.setDate(1);
      const nMeses = dias && dias <= 90 ? 3 : 6;
      for (let i = nMeses - 1; i >= 0; i--) { const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1); meses.push({ k: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), lbl: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') }); }
      const mesDe = iso => { const d = new Date(iso); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
      meses.forEach(m => { const doMes = l.filter(r => mesDe(r.criadoEm) === m.k); m.a = soma(doMes.filter(r => ['aprovado', 'comprado'].includes(r.status))); m.p = soma(doMes.filter(r => r.status === 'pendente')); });
      const maxM = Math.max(1, ...meses.map(m => m.a + m.p));

      const agrupar = (arr, fn) => { const o = {}; arr.forEach(r => { const k = fn(r); if (k) o[k] = (o[k] || 0) + Number(r.total); }); return Object.entries(o).sort((a, b) => b[1] - a[1]); };
      const porCC = agrupar(aprov, r => r.centroCusto);
      const porForn = agrupar(l.filter(r => r.status === 'comprado'), r => r.fornecedorFinal || r.fornecedor).slice(0, 6);
      const porNivel = [1, 2, 3].map(n => { const x = aprov.filter(r => Number(r.nivelAprovador) === n); return [`${S.nomeNivel(n)}`, x.length, soma(x)]; });
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
          <div class="card"><div class="card-head"><h2>Principais fornecedores</h2><span class="small muted">compras efetivadas</span></div>${hbars(porForn, brlK)}</div>
        </div>
        <div class="card" style="margin-top:16px"><div class="card-head"><h2>Pendentes mais antigas</h2></div>${tabela(pend.slice().sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm))).slice(0, 8))}</div>`;
      bindLinhas(el);
    };
    el.querySelectorAll('.filters select').forEach(s => s.addEventListener('input', pintar));
    pintar();
  }

  // ========== CREDENCIAMENTO DE FORNECEDORES (Gerente) ==========
  function vCredenciamento(el) {
    const todos = S.fornecedores();
    const pend = todos.filter(f => f.statusCred === 'pendente');
    const hist = todos.filter(f => f.credAnalisadoEm && f.statusCred !== 'pendente' && f.credAnalisadoPor !== 'Sistema').sort((a, b) => String(b.credAnalisadoEm).localeCompare(String(a.credAnalisadoEm))).slice(0, 12);
    el.innerHTML = `
      <div class="page-head"><div><h1>Credenciamento de fornecedores</h1><p>Fornecedores cadastrados por compradores e supervisores aguardando aprovação.</p></div></div>
      ${pend.length ? `<div class="acessos-lista">${pend.map(f => `<div class="card acesso" data-id="${f.id}">
        <div class="acesso-topo">
          <div class="avatar">${icon('truck', 18)}</div>
          <div class="acesso-quem"><b>${esc(f.nome)}</b><div class="small muted">${esc(f.nomeFantasia || '')}</div></div>
          <span class="status st-pendente">Aguardando</span>
        </div>
        <div class="acesso-dados">
          <div><span>CNPJ / CPF</span>${esc(f.cnpj || '—')}</div>
          <div><span>Inscrição estadual</span>${esc(f.inscricaoEstadual || '—')}</div>
          <div style="grid-column:1/-1"><span>Endereço</span>${esc([f.endereco, [f.cidade, f.uf].filter(Boolean).join('/'), f.cep].filter(Boolean).join(' · ') || '—')}</div>
          <div><span>Contato</span>${esc([f.contato, f.telefone, f.email].filter(Boolean).join(' · ') || '—')}</div>
          <div><span>Situação na Receita</span>${f.situacao ? situacaoTag(f.situacao) : '—'}</div>
          <div><span>Categorias</span>${esc(f.categorias || '—')}</div>
          <div><span>Cadastrado por</span>${esc(f.cadastradoPor || '—')} · ${data(f.criadoEm)}</div>
        </div>
        <div class="acoes" style="margin-top:4px">
          <button class="btn btn-primary" data-ok>${icon('shield', 16)} Credenciar</button>
          <button class="btn btn-ghost" data-ed>Ver / editar</button>
          <button class="btn btn-danger" data-no>Recusar</button>
        </div>
      </div>`).join('')}</div>`
      : `<div class="card"><div class="empty">${icon('check', 28)}<p>Nenhum fornecedor aguardando credenciamento.</p></div></div>`}
      ${hist.length ? `<div class="card"><div class="card-head"><h2>Últimas análises</h2></div><div class="table-wrap"><table>
        <thead><tr><th>Fornecedor</th><th>Resultado</th><th class="hide-sm">Por</th><th class="hide-sm">Em</th></tr></thead>
        <tbody>${hist.map(f => `<tr><td><b>${esc(f.nome)}</b><div class="small muted">${esc(f.cnpj || '')}</div></td>
          <td>${f.statusCred === 'recusado' ? `<span class="status st-reprovado">Recusado</span>${f.credObs ? `<div class="small muted">${esc(f.credObs)}</div>` : ''}` : '<span class="status st-aprovado">Credenciado</span>'}</td>
          <td class="hide-sm">${esc(f.credAnalisadoPor)}</td><td class="hide-sm num">${dataHora(f.credAnalisadoEm)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    el.querySelectorAll('.acesso').forEach(c => {
      const id = c.dataset.id;
      c.querySelector('[data-ok]').onclick = e => executar(e.currentTarget, () => S.act('aprovarFornecedor', { id }), j => j.state.extra.msg || 'Fornecedor credenciado.');
      c.querySelector('[data-ed]').onclick = () => formFornecedor(todos.find(f => f.id === id));
      c.querySelector('[data-no]').onclick = e => {
        const motivo = prompt('Motivo da recusa (opcional):', ''); if (motivo === null) return;
        executar(e.currentTarget, () => S.act('recusarFornecedor', { id, motivo }), 'Credenciamento recusado.');
      };
    });
  }

  // ========== ACESSOS (Gerente aprova novos cadastros) ==========
  function vAcessos(el, u) {
    const todos = S.listUsers();
    const pend = todos.filter(x => x.status === 'pendente').sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
    const hist = todos.filter(x => x.aprovadoEm && x.status !== 'pendente').sort((a, b) => String(b.aprovadoEm).localeCompare(String(a.aprovadoEm))).slice(0, 12);
    const L = S.listas();
    el.innerHTML = `
      <div class="page-head"><div><h1>Acessos</h1><p>Novos cadastros aguardando aprovação. Escolha o perfil de cada pessoa para liberar o acesso.</p></div></div>
      ${pend.length ? `<div class="acessos-lista">${pend.map(x => `<div class="card acesso" data-id="${x.id}">
        <div class="acesso-topo">
          <div class="avatar">${iniciais(x.nome)}</div>
          <div class="acesso-quem"><b>${esc(x.nome)}</b><div class="small muted">${esc(x.email)}</div></div>
          <span class="status st-pendente">Aguardando</span>
        </div>
        <div class="acesso-dados">
          <div><span>CPF</span>${esc(x.cpf || '—')}</div>
          <div><span>Solicitado em</span>${dataHora(x.criadoEm)}</div>
        </div>
        <div class="grid g2 acesso-form">
          <div><label>Perfil do usuário *</label><select name="nivel" required><option value="">Selecione o perfil…</option>${[1, 2, 3].map(n => `<option value="${n}">${esc(S.nomeNivel(n))}</option>`).join('')}</select></div>
          <div><label>Filial</label><select name="filial"><option value="">—</option>${opts(L.filial)}</select></div>
        </div>
        <div class="acoes" style="margin-top:12px">
          <button class="btn btn-primary" data-aprovar>${icon('check', 16)} Aprovar acesso</button>
          <button class="btn btn-danger" data-recusar>Recusar</button>
        </div>
      </div>`).join('')}</div>`
      : `<div class="card"><div class="empty">${icon('check', 28)}<p>Nenhum cadastro aguardando aprovação.</p></div></div>`}
      ${hist.length ? `<div class="card"><div class="card-head"><h2>Últimas análises</h2></div><div class="table-wrap"><table>
        <thead><tr><th>Nome</th><th class="hide-sm">E-mail</th><th>Resultado</th><th class="hide-sm">Por</th><th class="hide-sm">Em</th></tr></thead>
        <tbody>${hist.map(x => `<tr><td><b>${esc(x.nome)}</b></td><td class="hide-sm">${esc(x.email)}</td>
          <td>${x.status === 'recusado' ? `<span class="status st-reprovado">Recusado</span>${x.obsAcesso ? `<div class="small muted">${esc(x.obsAcesso)}</div>` : ''}` : `<span class="nivel-tag">${esc(S.nomeNivel(x.nivel))}</span>`}</td>
          <td class="hide-sm">${esc(x.aprovadoPor)}</td><td class="hide-sm num">${dataHora(x.aprovadoEm)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    el.querySelectorAll('.acesso').forEach(c => {
      const id = c.dataset.id;
      c.querySelector('[data-aprovar]').onclick = e => {
        const nivel = c.querySelector('[name=nivel]').value;
        if (!nivel) { toast('Escolha o perfil do usuário antes de aprovar.', true); c.querySelector('[name=nivel]').focus(); return; }
        executar(e.currentTarget, () => S.act('aprovarAcesso', { id, nivel, filial: c.querySelector('[name=filial]').value }), j => j.state.extra.msg || 'Acesso aprovado.');
      };
      c.querySelector('[data-recusar]').onclick = e => {
        const motivo = prompt('Motivo da recusa (opcional):', '');
        if (motivo === null) return;
        executar(e.currentTarget, () => S.act('recusarAcesso', { id, motivo }), 'Cadastro recusado.');
      };
    });
  }

  // ========== CONFIGURAÇÕES (Gerente) ==========
  function vConfig(el, u) {
    const lim = S.limites();
    const users = S.listUsers();
    const ex = S.extra();
    el.innerHTML = `
      <div class="page-head"><div><h1>Configurações</h1><p>Alçadas, usuários e integração.</p></div></div>
      <div class="card">
        <div class="card-head"><h2>Integração Google (Planilha + Drive)</h2>${S.modo === 'google' ? '<span class="status st-aprovado">Conectado</span>' : '<span class="status st-pendente">Modo demonstração</span>'}</div>
        ${S.modo === 'google' ? `<p style="margin:0 0 12px">Todos os dados estão sendo gravados na planilha e os orçamentos na pasta do Drive.</p>
          <div class="acoes" style="margin:0">
            ${ex.planilhaUrl ? `<a class="btn btn-primary" href="${esc(ex.planilhaUrl)}" target="_blank" rel="noopener">Abrir planilha</a>` : ''}
            ${ex.pastaUrl ? `<a class="btn btn-ghost" href="${esc(ex.pastaUrl)}" target="_blank" rel="noopener">Abrir pasta de orçamentos</a>` : ''}
          </div>`
        : `<p style="margin:0">Os dados estão salvos apenas neste navegador. Para usar com toda a equipe, siga o <b>GUIA-GOOGLE.txt</b>: crie a planilha, instale o script e cole a URL em <code>js/config.js</code> (campo <code>apiUrl</code>).</p>`}
      </div>
      <div class="card">
        <div class="card-head"><h2>Listas de validação</h2><span class="small muted">${S.modo === 'google' ? 'gravadas na aba "Listas" da planilha' : 'base de dados das listas'}</span></div>
        <div class="listas-cards">${Object.keys(NOME_LISTA).map(t => `<div class="lista-box" data-tipo="${t}">
          <h3>${NOME_LISTA[t]} <span class="qtd">${S.listas()[t].length} itens</span></h3>
          <div class="linha">
            <select class="sel-lista" aria-label="Valores de ${NOME_LISTA[t]}">${opts(S.listas()[t])}</select>
            <button type="button" class="btn btn-danger btn-sm" data-rml="${t}" title="Remover o valor selecionado">${icon('trash', 15)} Remover</button>
          </div>
          <form class="linha addl" data-tipo="${t}"><input placeholder="Novo valor de ${NOME_LISTA[t].toLowerCase()}" required><button class="btn btn-primary btn-sm">${icon('plus', 15)} Adicionar</button></form>
        </div>`).join('')}</div>
        <p class="small muted" style="margin:10px 0 0">Esses valores aparecem como opções na Nova solicitação e como listas suspensas na planilha. Remover um valor não altera pedidos já feitos.</p>
      </div>
      ${S.superAdmin() ? `<div class="card">
        <div class="card-head"><h2>Alçadas e regras</h2><span class="small muted">visível só para o administrador</span></div>
        <form id="fLim" class="grid g4" style="align-items:end">
          ${[1, 2, 3].map(n => `<div><label>${esc(S.nomeNivel(n))} (R$)</label><input type="number" min="1" step="0.01" name="l${n}" value="${lim[n]}"></div>`).join('')}
          <div><button class="btn btn-primary" style="width:100%">Salvar</button></div>
          <div><label>Mínimo de orçamentos por solicitação</label><input type="number" min="0" max="10" step="1" name="minOrc" value="${S.minOrcamentos()}"></div>
        </form>
        <p class="small muted" style="margin:10px 0 0">Acima do limite do Gerente, o pedido fica aguardando <b>${esc(C.instanciaSuperior)}</b>. Novos limites valem para novas solicitações.</p>
      </div>` : ''}
      <div class="card">
        <div class="card-head"><h2>Usuários</h2>${S.acessosPendentes() ? `<a href="#/acessos" class="btn-mini laranja">${S.acessosPendentes()} aguardando aprovação</a>` : ''}<button class="btn btn-accent btn-sm" id="novoU">${icon('plus', 16)} Novo usuário</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Nome</th><th class="hide-sm">E-mail</th><th>Perfil</th><th class="hide-sm">Filial</th><th>Assinatura</th><th>Status</th><th></th></tr></thead>
          <tbody>${users.filter(x => x.status !== 'pendente').map(x => `<tr><td><b>${esc(x.nome)}</b></td><td class="hide-sm">${esc(x.email)}</td><td>${x.nivel ? `<span class="nivel-tag">${esc(S.nomeNivel(x.nivel))}</span>` : '—'}</td><td class="hide-sm">${esc(x.filial)}</td>
            <td>${x.temAssinatura ? '<span class="status st-aprovado">Cadastrada</span>' : '<span class="status st-pendente">Pendente</span>'}<div><button class="btn-mini" data-lk="${x.id}" title="Gerar link para a pessoa assinar">${icon('link', 12)} ${x.temAssinatura ? 'Novo link' : 'Gerar link'}</button></div></td>
            <td>${x.status === 'recusado' ? '<span class="status st-reprovado">Recusado</span>' : x.ativo ? '<span class="status st-aprovado">Ativo</span>' : '<span class="status st-cancelado">Inativo</span>'}</td>
            <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-ed="${x.id}">Editar</button> ${x.id !== u.id ? `<button class="btn btn-ghost btn-sm" data-tg="${x.id}">${x.ativo ? 'Desativar' : 'Ativar'}</button>` : ''}</td></tr>`).join('')}</tbody>
        </table></div>
        <form id="fUser" class="hidden" style="margin-top:16px;border-top:1px solid var(--linha);padding-top:16px">
          <input type="hidden" name="id">
          <div class="grid g3">
            <div><label>Nome *</label><input name="nome" required></div>
            <div><label>E-mail *</label><input name="email" type="email" required></div>
            <div><label>Senha <span class="muted" id="senhaHint"></span></label><input name="senha" type="text" autocomplete="off"></div>
            <div><label>Perfil</label><select name="nivel">${[1, 2, 3].map(n => `<option value="${n}">${esc(S.nomeNivel(n))}</option>`).join('')}</select></div>
            <div><label>Filial</label><select name="filial"></select></div>
            <div style="display:flex;gap:8px;align-items:end"><button class="btn btn-primary">Salvar</button><button type="button" class="btn btn-ghost" id="cancU">Cancelar</button></div>
          </div>
        </form>
      </div>
      <div class="card">
        <div class="card-head"><h2>Dados</h2></div>
        <div class="acoes" style="margin:0">
          <button class="btn btn-ghost" id="bExp">Exportar tudo (JSON)</button>
          ${S.modo === 'local' ? '<button class="btn btn-danger" id="bReset">Restaurar dados de demonstração</button>' : ''}
        </div>
      </div>`;

    el.querySelectorAll('form.addl').forEach(f => f.addEventListener('submit', e => {
      e.preventDefault();
      executar(f.querySelector('button'), () => S.act('addLista', { tipo: f.dataset.tipo, valor: f.querySelector('input').value }), 'Valor adicionado.');
    }));
    el.querySelectorAll('[data-rml]').forEach(b => b.onclick = () => {
      const v = b.closest('.lista-box').querySelector('.sel-lista').value;
      if (!v || !confirm(`Remover "${v}" da lista de ${NOME_LISTA[b.dataset.rml]}?`)) return;
      executar(b, () => S.act('removeLista', { tipo: b.dataset.rml, valor: v }), 'Valor removido.');
    });
    if (el.querySelector('#fLim')) el.querySelector('#fLim').addEventListener('submit', e => {
      e.preventDefault(); const f = e.target;
      executar(f.querySelector('button'), () => S.act('saveLimites', { limites: { 1: f.l1.value, 2: f.l2.value, 3: f.l3.value }, minOrcamentos: f.minOrc.value }), 'Limites atualizados.');
    });
    const fU = el.querySelector('#fUser');
    const abrirForm = x => {
      fU.classList.remove('hidden'); fU.reset();
      fU.id.value = x ? x.id : ''; fU.nome.value = x ? x.nome : ''; fU.email.value = x ? x.email : '';
      fU.nivel.value = x ? x.nivel : 1;
      const fl = S.listas().filial, atual = x ? x.filial : fl[0];
      fU.filial.innerHTML = opts(fl.includes(atual) || !atual ? fl : fl.concat([atual]), atual);
      el.querySelector('#senhaHint').textContent = x ? '(deixe em branco para manter)' : '*';
      fU.nome.focus();
    };
    el.querySelector('#novoU').onclick = () => abrirForm(null);
    el.querySelector('#cancU').onclick = () => fU.classList.add('hidden');
    el.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => abrirForm(users.find(x => x.id === b.dataset.ed)));
    el.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => executar(b, () => S.act('toggleUser', { id: b.dataset.tg }), 'Usuário atualizado.'));
    el.querySelectorAll('[data-lk]').forEach(b => b.onclick = () => executar(b, () => S.act('gerarLinkAssinatura', { id: b.dataset.lk }), null, j => { render(); mostrarLinkAssinatura(j.state.extra.nome, j.state.extra.token); }));
    fU.addEventListener('submit', e => {
      e.preventDefault();
      executar(fU.querySelector('button'), () => S.act('saveUser', { user: { id: fU.id.value, nome: fU.nome.value.trim(), email: fU.email.value, senha: fU.senha.value, nivel: fU.nivel.value, filial: fU.filial.value } }), 'Usuário salvo.');
    });
    el.querySelector('#bExp').onclick = () => download('pedidos-compra-completo.json', S.exportJSON(), 'application/json');
    const br = el.querySelector('#bReset');
    if (br) br.onclick = () => { if (!confirm('Apagar todos os dados e restaurar a demonstração?')) return; S.resetDemo(); toast('Dados de demonstração restaurados.'); render(); };
  }

  // ========== INÍCIO DO APP ==========
  renderCarregando(S.modo === 'google' ? 'Conectando à base Google…' : 'Carregando…');
  S.init()
    .then(() => render())
    .catch(e => renderLogin(e.message));
})();
