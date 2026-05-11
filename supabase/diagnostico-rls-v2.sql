-- Lista policies separadamente por tabela
select
  c.relname as tabela,
  p.polname as policy_name,
  case p.polcmd
    when 'r' then 'SELECT'
    when 'a' then 'INSERT'
    when 'w' then 'UPDATE'
    when 'd' then 'DELETE'
    when '*' then 'ALL'
    else p.polcmd::text
  end as comando,
  c.relrowsecurity as rls_ativo
from pg_policy p
join pg_class c on c.oid = p.polrelid
where c.relname in ('producoes_social_media', 'producoes_social_media_items')
order by c.relname, p.polname;
