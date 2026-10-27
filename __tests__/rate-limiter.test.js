import request from 'supertest';
import app from '../test-app.js';

describe('Rate Limiter', () => {
  test('POST /api/auth/login - deve aplicar rate limiting após limite configurado', async () => {
    const credentials = {
      email: 'admin@test.com',
      senha: 'wrongpassword'
    };

    // Primeira requisição para obter o limite configurado
    const firstResponse = await request(app)
      .post('/api/auth/login')
      .send(credentials);

    expect(firstResponse.headers).toHaveProperty('ratelimit-limit');
    expect(firstResponse.headers).toHaveProperty('ratelimit-remaining');
    expect(firstResponse.headers).toHaveProperty('ratelimit-reset');

    const maxRequests = parseInt(firstResponse.headers['ratelimit-limit']);
    let remaining = parseInt(firstResponse.headers['ratelimit-remaining']);

    // Fazer requisições até atingir o limite
    for (let i = 1; i < maxRequests; i++) {
      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials);

      expect([401, 429]).toContain(response.status);
      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
      expect(response.headers).toHaveProperty('ratelimit-reset');

      if (i < maxRequests - 1) {
        expect(response.status).toBe(401);
        expect(parseInt(response.headers['ratelimit-remaining'])).toBeLessThanOrEqual(remaining);
        remaining = parseInt(response.headers['ratelimit-remaining']);
      }
    }

    // A próxima requisição deve ser bloqueada (429)
    const blockedResponse = await request(app)
      .post('/api/auth/login')
      .send(credentials)
      .expect(429);

    expect(blockedResponse.body).toHaveProperty('error', 'Muitas tentativas de login. Tente novamente em 15 minutos.');
    expect(blockedResponse.headers).toHaveProperty('retry-after');
  });

  test('POST /api/clientes/register - deve ter rate limiting próprio', async () => {
    const clientData = {
      nome: 'Novo Cliente',
      email: 'novo@test.com',
      telefone: '11888888888',
      senha: 'password123',
      cep: '01000-000',
      logradouro: 'Rua Nova',
      numero: '456',
      bairro: 'Centro'
    };

    // Primeira requisição para obter o limite
    const firstResponse = await request(app)
      .post('/api/clientes/register')
      .send({ ...clientData, email: 'novo0@test.com', telefone: '11888888880' });

    expect(firstResponse.headers).toHaveProperty('ratelimit-limit');
    const maxRequests = parseInt(firstResponse.headers['ratelimit-limit']);

    // Fazer requisições até o limite
    for (let i = 1; i < maxRequests; i++) {
      const response = await request(app)
        .post('/api/clientes/register')
        .send({ ...clientData, email: `novo${i}@test.com`, telefone: `1188888888${i}` });

      expect([201, 400]).toContain(response.status);
    }

    // A próxima deve ser bloqueada
    const blockedResponse = await request(app)
      .post('/api/clientes/register')
      .send({ ...clientData, email: `novo${maxRequests}@test.com`, telefone: `1188888888${maxRequests}` })
      .expect(429);

    expect(blockedResponse.body).toHaveProperty('error', 'Muitos registros. Tente novamente em 1 hora.');
  });
});