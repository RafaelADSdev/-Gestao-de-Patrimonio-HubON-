import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(res, status, body) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
  return res.status(status).json(body);
}

function hubonEmailFromUser(user) {
  const trimmed = String(user || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  const slug = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
  return `${slug}@hubon.com`;
}

function normalizeEmail(value) {
  return hubonEmailFromUser(value);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return jsonResponse(res, 405, { error: 'Método não permitido' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey     = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse(res, 500, {
      error: 'API não configurada. Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY na Vercel.'
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(res, 401, { error: 'Não autenticado' });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse(res, 401, { error: 'Sessão inválida' });
  }

  if (user.app_metadata?.role !== 'admin') {
    return jsonResponse(res, 403, { error: 'Acesso negado: apenas administradores' });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { action, ...body } = req.body || {};

  try {
    if (action === 'create') {
      const email = normalizeEmail(body.email);
      const password = String(body.password || '');
      const role = body.role === 'admin' ? 'admin' : 'viewer';

      if (!email || password.length < 6) {
        return jsonResponse(res, 400, { error: 'Informe usuário e senha com pelo menos 6 caracteres.' });
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role }
      });

      if (error) return jsonResponse(res, 400, { error: error.message });

      return jsonResponse(res, 200, {
        user: {
          id: data.user.id,
          email: data.user.email,
          role
        }
      });
    }

    if (action === 'delete') {
      const userId = body.userId;
      if (!userId) return jsonResponse(res, 400, { error: 'ID do usuário é obrigatório' });
      if (userId === user.id) {
        return jsonResponse(res, 400, { error: 'Você não pode excluir seu próprio usuário.' });
      }

      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) return jsonResponse(res, 400, { error: error.message });

      return jsonResponse(res, 200, { success: true });
    }

    return jsonResponse(res, 400, { error: 'Ação inválida' });
  } catch (err) {
    return jsonResponse(res, 500, { error: err.message || 'Erro interno' });
  }
}
