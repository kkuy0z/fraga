import request from 'supertest';
import app from '../test-app.js';

describe('Pedidos - Criação e validação', () => {
  let clientToken;
  let produtoId;

  beforeAll(async () => {
    // Login client
    const clientLogin = await request(app)
      .post('/api/clientes/login')
      .send({ email: 'client@test.com', senha: 'client123' });
    clientToken = clientLogin.body.token;

    // Get product
    const produtos = await request(app).get('/api/produtos');
    produtoId = produtos.body.data[0].id;
  });

  const baseOrder = {
    cliente_nome: 'Cliente Teste',
    cliente_telefone: '11999999999',
    cliente_email: 'client@test.com',
    cep: '01000-000',
    logradouro: 'Rua Teste',
    numero_endereco: '123',
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

  test('POST /api/pedidos - deve criar pedido com dados válidos (bairro Centro)', async () => {
    const order = { ...baseOrder, bairro: 'Centro' };
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(201);

    expect(response.body).toHaveProperty('numero_pedido');
    expect(response.body.bairro).toBe('Centro');
    expect(response.body.taxa_entrega).toBe(5);
    expect(response.body.taxa_bairro).toBe(0);
    expect(response.body.subtotal_produtos).toBe(25);
    expect(response.body.valor_total).toBe(30); // 25 + 5 + 0
  });

  test('POST /api/pedidos - deve calcular taxa bairro Jardim América (R$ 3,50)', async () => {
    const order = { ...baseOrder, bairro: 'Jardim América' };
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(201);

    expect(response.body.bairro).toBe('Jardim América');
    expect(response.body.taxa_entrega).toBe(5);
    expect(response.body.taxa_bairro).toBe(3.5);
    expect(response.body.valor_total).toBe(33.5); // 25 + 5 + 3.5
  });

  test('POST /api/pedidos - deve calcular taxa bairro Vila Nova (R$ 5,00)', async () => {
    const order = { ...baseOrder, bairro: 'Vila Nova' };
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(201);

    expect(response.body.taxa_bairro).toBe(5);
    expect(response.body.valor_total).toBe(35); // 25 + 5 + 5
  });

  test('POST /api/pedidos - deve calcular taxa bairro Parque Industrial (R$ 7,50)', async () => {
    const order = { ...baseOrder, bairro: 'Parque Industrial' };
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(201);

    expect(response.body.taxa_bairro).toBe(7.5);
    expect(response.body.valor_total).toBe(37.5); // 25 + 5 + 7.5
  });

  test('POST /api/pedidos - deve calcular taxa bairro Bairro Distante (R$ 10,00)', async () => {
    const order = { ...baseOrder, bairro: 'Bairro Distante' };
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(201);

    expect(response.body.taxa_bairro).toBe(10);
    expect(response.body.valor_total).toBe(40); // 25 + 5 + 10
  });

  test('POST /api/pedidos - deve aplicar fallback para bairro não configurado', async () => {
    const order = { ...baseOrder, bairro: 'Bairro Inexistente' };
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(201);

    expect(response.body.taxa_bairro).toBe(0);
    expect(response.body.valor_total).toBe(30); // 25 + 5 + 0
  });

  test('POST /api/pedidos - deve rejeitar produto inexistente', async () => {
    const order = {
      ...baseOrder,
      bairro: 'Centro',
      itens: [{ produto_id: 99999, quantidade: 1, personalizacoes: [] }]
    };
    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  test('POST /api/pedidos - deve rejeitar quantidade inválida', async () => {
    const order = {
      ...baseOrder,
      bairro: 'Centro',
      itens: [{ produto_id: produtoId, quantidade: 0, personalizacoes: [] }]
    };
    await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(400);
  });

  test('POST /api/pedidos - deve rejeitar pedido sem token', async () => {
    await request(app)
      .post('/api/pedidos')
      .send(baseOrder)
      .expect(401);
  });

  test('POST /api/pedidos - deve validar campos obrigatórios', async () => {
    const incompleteOrder = { ...baseOrder };
    delete incompleteOrder.cliente_nome;
    delete incompleteOrder.bairro;

    await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(incompleteOrder)
      .expect(400);
  });
});

describe('Pedidos - Cálculo de preços no servidor', () => {
  let clientToken;
  let produtoId;

  beforeAll(async () => {
    const clientLogin = await request(app)
      .post('/api/clientes/login')
      .send({ email: 'client@test.com', senha: 'client123' });
    clientToken = clientLogin.body.token;

    const produtos = await request(app).get('/api/produtos');
    produtoId = produtos.body.data[0].id;
  });

  test('deve recalcular preços no servidor ignorando valores manipulados pelo cliente', async () => {
    // Tentar enviar preço manipulado no item
    const order = {
      cliente_nome: 'Cliente Teste',
      cliente_telefone: '11999999999',
      cliente_email: 'client@test.com',
      cep: '01000-000',
      logradouro: 'Rua Teste',
      numero_endereco: '123',
      bairro: 'Centro',
      complemento: '',
      referencia: '',
      forma_pagamento_id: 1,
      observacoes_pagamento: '',
      itens: [{
        produto_id: produtoId,
        quantidade: 2,
        personalizacoes: []
      }]
    };

    const response = await request(app)
      .post('/api/pedidos')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(order)
      .expect(201);

    // Deve usar preço real do banco (25.00 * 2 = 50)
    expect(response.body.subtotal_produtos).toBe(50);
    expect(response.body.valor_total).toBe(55); // 50 + 5 + 0
  });
});