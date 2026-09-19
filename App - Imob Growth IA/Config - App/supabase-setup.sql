-- ============================================================
-- IMOB GROWTH AI — Setup do Banco de Dados Supabase
-- ============================================================
-- Execute este script no SQL Editor do Supabase Dashboard
-- (https://supabase.com/dashboard → seu projeto → SQL Editor)
-- ============================================================

-- 1. Tabela de Perfis (estende o auth.users do Supabase)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'corretor' CHECK (role IN ('corretor', 'admin', 'incorporadora')),
    credits_images INT DEFAULT 50 CHECK (credits_images >= 0),
    credits_videos INT DEFAULT 10 CHECK (credits_videos >= 0),
    plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'profissional', 'incorporadora')),
    accepted_terms_at TIMESTAMPTZ,
    accepted_terms_ip TEXT,
    accepted_terms_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Histórico de Artes Geradas
CREATE TABLE IF NOT EXISTS generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    template_id TEXT,
    prompt TEXT,
    image_url TEXT,
    used_ai BOOLEAN DEFAULT FALSE,
    format TEXT DEFAULT 'feed' CHECK (format IN ('feed', 'story', 'carrossel')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Histórico de Vídeos Renderizados
CREATE TABLE IF NOT EXISTS video_renders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    template_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'rendering', 'completed', 'failed')),
    json2video_project_id TEXT,
    video_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) — Cada usuário só vê seus dados
-- ============================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_renders ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

CREATE POLICY "profiles_select_policy" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_policy" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_policy" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_policy" ON profiles FOR DELETE USING (auth.uid() = id);

-- Políticas para generations
DROP POLICY IF EXISTS "Users can view own generations" ON generations;
DROP POLICY IF EXISTS "Users can insert own generations" ON generations;
DROP POLICY IF EXISTS "generations_select_policy" ON generations;
DROP POLICY IF EXISTS "generations_insert_policy" ON generations;
DROP POLICY IF EXISTS "generations_update_policy" ON generations;
DROP POLICY IF EXISTS "generations_delete_policy" ON generations;

CREATE POLICY "generations_select_policy" ON generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "generations_insert_policy" ON generations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "generations_update_policy" ON generations FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "generations_delete_policy" ON generations FOR DELETE USING (auth.uid() = user_id);

-- Políticas para video_renders
DROP POLICY IF EXISTS "Users can view own videos" ON video_renders;
DROP POLICY IF EXISTS "Users can insert own videos" ON video_renders;
DROP POLICY IF EXISTS "video_renders_select_policy" ON video_renders;
DROP POLICY IF EXISTS "video_renders_insert_policy" ON video_renders;
DROP POLICY IF EXISTS "video_renders_update_policy" ON video_renders;
DROP POLICY IF EXISTS "video_renders_delete_policy" ON video_renders;

CREATE POLICY "video_renders_select_policy" ON video_renders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "video_renders_insert_policy" ON video_renders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "video_renders_update_policy" ON video_renders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "video_renders_delete_policy" ON video_renders FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: Criar perfil automaticamente quando usuário se registra
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role, credits_images, credits_videos, plan)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
        NEW.raw_user_meta_data->>'phone',
        'corretor',
        50,  -- créditos iniciais de imagem
        10,  -- créditos iniciais de vídeo
        'starter'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNÇÃO RPC: Descontar crédito atomicamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.decrement_credit(
    p_user_id UUID,
    p_credit_type TEXT
)
RETURNS INT AS $$
DECLARE
    current_value INT;
BEGIN
    IF p_credit_type = 'credits_images' THEN
        UPDATE profiles
        SET credits_images = credits_images - 1,
            updated_at = NOW()
        WHERE id = p_user_id AND credits_images > 0
        RETURNING credits_images INTO current_value;
    ELSIF p_credit_type = 'credits_videos' THEN
        UPDATE profiles
        SET credits_videos = credits_videos - 1,
            updated_at = NOW()
        WHERE id = p_user_id AND credits_videos > 0
        RETURNING credits_videos INTO current_value;
    ELSE
        RAISE EXCEPTION 'Tipo de crédito inválido: %', p_credit_type;
    END IF;

    IF current_value IS NULL THEN
        RAISE EXCEPTION 'Créditos insuficientes';
    END IF;

    RETURN current_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNÇÃO RPC: Reembolsar/Incrementar crédito atomicamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_credit(
    p_user_id UUID,
    p_credit_type TEXT
)
RETURNS INT AS $$
DECLARE
    current_value INT;
BEGIN
    IF p_credit_type = 'credits_images' THEN
        UPDATE profiles
        SET credits_images = credits_images + 1,
            updated_at = NOW()
        WHERE id = p_user_id
        RETURNING credits_images INTO current_value;
    ELSIF p_credit_type = 'credits_videos' THEN
        UPDATE profiles
        SET credits_videos = credits_videos + 1,
            updated_at = NOW()
        WHERE id = p_user_id
        RETURNING credits_videos INTO current_value;
    ELSE
        RAISE EXCEPTION 'Tipo de crédito inválido: %', p_credit_type;
    END IF;

    RETURN current_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_renders_user_id ON video_renders(user_id);
CREATE INDEX IF NOT EXISTS idx_video_renders_status ON video_renders(status);

-- ============================================================
-- 4. Tabela de Tokens de Redefinição de Senha
-- ============================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS por segurança
ALTER TABLE password_resets ENABLE ROW LEVEL SECURITY;

-- Índices adicionais para performance e busca rápida
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
CREATE INDEX IF NOT EXISTS idx_password_resets_email ON password_resets(email);

-- ============================================================
-- 5. Tabela de Chaves de Idempotência para Webhooks
-- ============================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
    response_body JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS por segurança
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Índices adicionais para performance e busca rápida
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_event_id ON idempotency_keys(event_id);

-- ✅ Setup completo! Agora configure as variáveis de ambiente no Vercel.
