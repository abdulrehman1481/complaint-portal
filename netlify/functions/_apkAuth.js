const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const getBearerToken = (headers = {}) => {
  const authHeader = headers.authorization || headers.Authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
};

const requireEnvVars = () => {
  const missing = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
};

const createSupabaseAdmin = () => {
  requireEnvVars();
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const ensureSuperAdmin = async (headers) => {
  const token = getBearerToken(headers);
  if (!token) {
    return {
      ok: false,
      response: jsonResponse(401, { error: 'Missing Bearer token.' }),
    };
  }

  const supabaseAdmin = createSupabaseAdmin();

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return {
      ok: false,
      response: jsonResponse(401, { error: 'Invalid or expired token.' }),
    };
  }

  const { data: userData, error: roleError } = await supabaseAdmin
    .from('users')
    .select('id, roles:role_id(name)')
    .eq('id', authData.user.id)
    .single();

  if (roleError) {
    return {
      ok: false,
      response: jsonResponse(500, { error: 'Failed to validate user role.' }),
    };
  }

  if (userData?.roles?.name !== 'Super Admin') {
    return {
      ok: false,
      response: jsonResponse(403, { error: 'Only Super Admin can upload APK files.' }),
    };
  }

  return {
    ok: true,
    userId: authData.user.id,
  };
};

module.exports = {
  jsonResponse,
  ensureSuperAdmin,
};
