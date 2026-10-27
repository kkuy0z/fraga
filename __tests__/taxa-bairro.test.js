import request from 'supertest';
import app from '../test-app.js';

describe('Taxa Adicional por Bairro', () => {
  let clientToken;

  beforeAll(async () => {
    const clientLogin = await request(app)
      .post('/api/clientes/login')
      .send({ email: 'client@test.com', senha: 'client123' });
    clientToken = clientLogin.body.token;
  });

  const testCases = [
    { bairro: 'Centro', taxaEsperada: 0, totalEsperado: 30 },
    { bairro: 'Jardim América', taxaEsperada: 3.5, totalEsperado: 33.5 },
    { bairro: 'Vila Nova', taxaEsperada: 5, totalEsperado: 35 },
    { bairro: 'Parque Industrial', taxaEsperada: 7.5, totalEsperado: 37.5 },
    { bairro: 'Bairro Distante', taxaEsperada: 10, totalEsperado: 40 },
    { bairro: 'Bairro Não Configurado', taxaEsperada: 0, totalEsperado: 30 }
  ];

  test.each(testCases)('POST /api/pedidos - bairro "$bairro" deve ter taxa adicional R$ $taxaEsperada', async ({ bairro, taxaEsperada, totalEsperado }) => {
    const order = {
      cliente_nome: 'Cliente Teste',
      cliente_telefone: '11999999999',
      cliente_email: 'client@test.com',
      cep: '01000-000',
      logradouro: 'Rua Teste',
      numero_endereco: '123',
      bairro: bairro,
      complemento: '',
      referencia: '',
      forma_pagamento_id: 1,
      observacoes_pagamento: '',
      itens: [{
        produto_id: 1,
        quantidade: 1,
        personalizacoes: []
      }]
    };

    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(201);

    expect(response.body.bairro).toBe(bairro);
    expect(response.body.taxa_entrega).toBe(5);
    expect(response.body.taxa_bairro).toBe(taxaEsperada);
    expect(response.body.subtotal_produtos).toBe(25);
    expect(response.body.valor_total).toBe(totalEsperado);
  });

  test('GET /api/entrega/config - deve retornar configuração de bairros', async () => {
    const response = await request(app)
      .get('/api/entrega/config')
      .expect(200);

    expect(response.body).toHaveProperty('taxa_entrega', 5);
    expect(response.body).toHaveProperty('bairro_taxa_extra');
    expect(Array.isArray(response.body.bairro_taxa_extra)).toBe(true);

    const bairros = response.body.bairro_taxa_extra;
    expect(bairros).toContainEqual({ bairro: 'Centro', taxa_extra: 0 });
    expect(bairros).toContainEqual({ bairro: 'Jardim América', taxa_extra: 3.5 });
    expect(bairros).toContainEqual({ bairro: 'Vila Nova', taxa_extra: 5 });
    expect(bairros).toContainEqual({ bairro: 'Parque Industrial', taxa_extra: 7.5 });
    expect(bairros).toContainEqual({ bairro: 'Bairro Distante', taxa_extra: 10 });
  });

  test('deve distinguir taxa_entrega de taxa_bairro no total', async () => {
    // taxa_entrega = 5 (base)
    // taxa_bairro = 3.5 (adicional)
    // subtotal = 25
    // total = 33.5

    const order = {
      cliente_nome: 'Cliente Teste',
      cliente_telefone: '11999999999',
      cliente_email: 'client@test.com',
      cep: '01000-000',
      logradouro: 'Rua Teste',
      numero_endereco: '123',
      bairro: 'Jardim América',
      complemento: '',
      referencia: '',
      forma_pagamento_id: 1,
      observacoes_pagamento: '',
      itens: [{
        produto_id: 1,
        quantidade: 1,
        personalizacoes: []
      }]
    };

    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(201);

    // Verificar que são taxas separadas
    expect(response.body.taxa_entrega).toBe(5);
    expect(response.body.taxa_bairro).toBe(3.5);
    expect(response.body.valor_total).toBe(response.body.subtotal_produtos + response.body.taxa_entrega + response.body.taxa_bairro);
  });
});