// Normaliza usuário de login para e-mail @hubon.com
// Ex.: "Rafael Arcanjo" → "rafael.arcanjo@hubon.com"
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
