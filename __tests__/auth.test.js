import request from 'supertest';
import app from '../test-app.js';

describe('Autenticação - Admin', () => {
  const validCredentials = {
    email: 'admin@test.com',
    senha: 'admin123'
  };

  test('POST /api/auth/login - deve autenticar admin válido', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send(validCredentials)
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(validCredentials.email);
    expect(response.body.user.perfil).toBe('administrador');
  });

  test('POST /api/auth/login - deve rejeitar senha incorreta', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: validCredentials.email, senha: 'wrong' })
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Credenciais inválidas');
  });

  test('POST /api/auth/login - deve rejeitar email inexistente', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@test.com', senha: 'admin123' })
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Credenciais inválidas');
  });

  test('POST /api/auth/login - deve rejeitar campos obrigatórios ausentes', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({})
      .expect(400);

    await request(app)
      .post('/api/auth/login')
      .send({ email: validCredentials.email })
      .expect(400);
  });
});

describe('Autenticação - Cliente', () => {
  const validClient = {
    email: 'client@test.com',
    senha: 'client123'
  };

  test('POST /api/clientes/login - deve autenticar cliente válido', async () => {
    const response = await request(app)
      .post('/api/clientes/login')
      .send(validClient)
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('cliente');
    expect(response.body.cliente.email).toBe(validClient.email);
  });

  test('POST /api/clientes/login - deve rejeitar senha incorreta', async () => {
    const response = await request(app)
      .post('/api/clientes/login')
      .send({ email: validClient.email, senha: 'wrong' })
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Credenciais inválidas');
  });

  test('POST /api/clientes/login - deve rejeitar email inexistente', async () => {
    const response = await request(app)
      .post('/api/clientes/login')
      .send({ email: 'nonexistent@test.com', senha: 'client123' })
      .expect(401);

    expect(response.body).toHaveProperty('error', 'Credenciais inválidas');
  });
});

describe('Autorização - Middleware de autenticação', () => {
  let adminToken;
  let clientToken;

  beforeAll(async () => {
    // Login admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', senha: 'admin123' });
    adminToken = adminLogin.body.token;

    // Login client
    const clientLogin = await request(app)
      .post('/api/clientes/login')
      .send({ email: 'client@test.com', senha: 'client123' });
    clientToken = clientLogin.body.token;
  });

  test('GET /api/auth/verify - deve aceitar token admin válido', async () => {
    const response = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user.perfil).toBe('administrador');
  });

  test('GET /api/auth/verify - deve rejeitar token inexistente', async () => {
    await request(app)
      .get('/api/auth/verify')
      .expect(401);
  });

  test('GET /api/auth/verify - deve rejeitar token inválido', async () => {
    await request(app)
      .get('/api/auth/verify')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  test('GET /api/auth/verify - deve rejeitar token cliente em rota admin', async () => {
    await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(401);
  });

  test('GET /api/clientes/perfil - deve aceitar token cliente válido', async () => {
    const response = await request(app)
      .get('/api/clientes/perfil')
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    expect(response.body.cliente).toHaveProperty('id');
    expect(response.body.cliente.email).toBe('client@test.com');
  });

  test('GET /api/clientes/perfil - deve rejeitar token admin em rota cliente', async () => {
    await request(app)
      .get('/api/clientes/perfil')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(401);
  });

  test('POST /api/auth/register - deve bloquear não administrador', async () => {
    await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        email: 'newadmin@test.com',
        senha: 'password123',
        nome: 'New Admin',
        perfil: 'atendente'
      })
      .expect(401);
  });
});