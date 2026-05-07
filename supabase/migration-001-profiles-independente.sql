-- =========================================================
-- Migration 001: profiles independente de auth.users
-- =========================================================
-- Objetivo: permitir cadastrar membros da equipe pela UI do admin
-- sem precisar criar primeiro um usuário no Supabase Auth.
--
-- O profile passa a ter ID próprio (auto-gerado) e ganha um campo
-- opcional `auth_user_id` que liga ao auth.users quando a pessoa
-- de fato se registra para login.
--
-- COMO RODAR:
-- 1. Abra o painel do Supabase do seu projeto
-- 2. Vá em SQL Editor → New query
-- 3. Cole tudo abaixo e clique em "Run"
-- =========================================================

-- 1. Remove o trigger antigo que assume profiles.id == auth.users.id
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Remove a foreign key de profiles.id → auth.users.id
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. Define default UUID auto-gerado para profiles.id
ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 4. Adiciona coluna auth_user_id (opcional, link ao auth.users quando houver login)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. Backfill: profiles que já existem e têm o mesmo ID que algum auth.users
--    (esse era o vínculo implícito anterior) ganham o auth_user_id agora explícito
UPDATE profiles p
   SET auth_user_id = u.id
  FROM auth.users u
 WHERE p.id = u.id
   AND p.auth_user_id IS NULL;

-- 6. Recria o trigger: quando um auth.user novo é criado,
--    tenta linkar a um profile existente com mesmo e-mail.
--    Se não achar nenhum, cria um profile novo.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  matched_profile_id uuid;
BEGIN
  -- Tenta achar profile existente com mesmo e-mail que ainda não tem auth vinculado
  SELECT id INTO matched_profile_id
    FROM public.profiles
   WHERE lower(email) = lower(NEW.email) AND auth_user_id IS NULL
   LIMIT 1;

  IF matched_profile_id IS NOT NULL THEN
    -- Profile já existia (criado pelo admin) — só vincula o auth user
    UPDATE public.profiles
       SET auth_user_id = NEW.id
     WHERE id = matched_profile_id;
  ELSE
    -- Não havia profile pré-existente — cria um novo (auto-signup do usuário)
    INSERT INTO public.profiles (auth_user_id, nome, email, role, aprovado, ativo)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
      NEW.email,
      'gestor',
      false, -- aguarda aprovação do admin
      true
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Index para acelerar busca por auth_user_id
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(lower(email));

-- =========================================================
-- Pronto! Após rodar:
-- - Você pode criar membros pela UI sem auth (como admin estava tentando)
-- - Quando essa pessoa for usar o sistema, basta criar um auth user
--   no Dashboard com o mesmo e-mail e o trigger faz o link automático
-- =========================================================
