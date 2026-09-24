/* ==========================================================
   CONFIGURAÇÃO GERAL — Cheiro Verde Ambiental | Pedidos de Compra
   Edite este arquivo para ajustar níveis, limites, filiais etc.
   Os limites também podem ser alterados pela tela "Configurações"
   (usuário Gerente). O valor salvo na tela tem prioridade.
   ========================================================== */
window.CV_CONFIG = {
  empresa: 'Cheiro Verde Ambiental',
  sistema: 'Pedidos de Compra',
  versao: '1.0.0',

  // Alçadas de aprovação (R$) — valor máximo que cada nível autoriza sozinho
  niveis: {
    1: { nome: 'Comprador',  limite: 2000 },
    2: { nome: 'Supervisor', limite: 10000 },
    3: { nome: 'Gerente',    limite: 50000 }
  },
  // Acima do limite do Gerente, o pedido fica aguardando esta instância:
  instanciaSuperior: 'Diretoria',

  filiais: ['Bernardino de Campos (Matriz)', 'Assis', 'São Manuel', 'Botucatu'],

  centrosCusto: [
    'Operações - Coleta',
    'Frota e Manutenção',
    'Tratamento de Resíduos',
    'Segurança do Trabalho',
    'Administrativo',
    'TI',
    'Comercial'
  ],

  categorias: [
    'EPI',
    'Materiais de consumo',
    'Embalagens e coletores',
    'Peças e manutenção',
    'Combustível',
    'Equipamentos',
    'Serviços',
    'TI',
    'Escritório'
  ],

  unidadesMedida: ['un', 'cx', 'pct', 'kg', 'L', 'm', 'serv', 'h'],

  urgencias: ['Baixa', 'Normal', 'Alta', 'Urgente']
};
