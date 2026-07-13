/* ============================================================
   ArznStoreSP — Camada de dados (Supabase)
   ============================================================
   Este arquivo é compartilhado por catalogo.html, admin.html e kanban.html.
   Preencha SUPABASE_URL e SUPABASE_ANON_KEY com os dados do seu projeto
   (Supabase > Project Settings > API).

   A chave "anon" é pública por natureza — pode ficar no site. Quem protege
   os dados são as RLS policies do banco (ver supabase-schema.sql).
   ============================================================ */

const SUPABASE_URL = 'https://thpzvkxoqrhqydqzdffv.supabase.co';       // ex: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_E2YLvIuSANlr0YkaR0uguw_SDwM44eg';  // a chave "anon public"
const STORAGE_BUCKET = 'produtos';

// Cria o cliente (a lib supabase-js é carregada via <script> antes deste arquivo)
let sb = null;
function dbPronto(){
  return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
}
if (dbPronto() && typeof supabase !== 'undefined') {
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/* ---------- Conversão banco (snake_case) <-> site (camelCase) ---------- */
function produtoDoBanco(r){
  return {
    id: String(r.id),
    categoria: r.categoria,
    subcategoria: r.subcategoria || '',
    nome: r.nome,
    descricao: r.descricao || '',
    imagens: r.imagens || [],
    badge: r.badge || '',
    tipoPreco: r.tipo_preco || 'variacao',
    variacoes: r.variacoes || [],
    precoM2: Number(r.preco_m2) || 0,
    extras: r.extras || [],
    prazoProducao: r.prazo_producao || '',
    qtdMinima: Number(r.qtd_minima) || 1,
    ativo: r.ativo !== false
  };
}
function produtoParaBanco(p){
  return {
    categoria: p.categoria,
    subcategoria: p.subcategoria || '',
    nome: p.nome,
    descricao: p.descricao || '',
    imagens: p.imagens || [],
    badge: p.badge || '',
    tipo_preco: p.tipoPreco || 'variacao',
    variacoes: p.variacoes || [],
    preco_m2: p.precoM2 || 0,
    extras: p.extras || [],
    prazo_producao: p.prazoProducao || '',
    qtd_minima: p.qtdMinima || 1,
    ativo: p.ativo !== false
  };
}
function pedidoDoBanco(r){
  return {
    id: r.codigo || String(r.id),
    _rowId: r.id,
    timestamp: r.criado_em,
    status: r.status,
    cliente_nome: r.cliente_nome,
    cliente_telefone: r.cliente_telefone,
    itens: r.itens || [],
    subtotal: r.subtotal,
    desconto: r.desconto,
    cupom: r.cupom,
    frete: r.frete,
    frete_regiao: r.frete_regiao,
    cep: r.cep,
    total: r.total,
    observacoes: r.observacoes
  };
}

/* ============ PRODUTOS ============ */
async function dbGetProdutos(){ // só ativos (loja)
  const { data, error } = await sb.from('produtos').select('*').eq('ativo', true).order('criado_em', { ascending:false });
  if(error){ console.error(error); return []; }
  return data.map(produtoDoBanco);
}
async function dbGetProdutosAdmin(){ // todos (painel)
  const { data, error } = await sb.from('produtos').select('*').order('criado_em', { ascending:false });
  if(error){ console.error(error); return []; }
  return data.map(produtoDoBanco);
}
async function dbSalvarProduto(p){
  const registro = produtoParaBanco(p);
  if(p.id){
    const { error } = await sb.from('produtos').update(registro).eq('id', p.id);
    if(error) return { ok:false, error:error.message };
    return { ok:true, editado:true };
  }else{
    const { error } = await sb.from('produtos').insert(registro);
    if(error) return { ok:false, error:error.message };
    return { ok:true, editado:false };
  }
}
async function dbExcluirProduto(id){
  const { error } = await sb.from('produtos').delete().eq('id', id);
  if(error) return { ok:false, error:error.message };
  return { ok:true };
}

/* ============ PEDIDOS ============ */
async function dbCriarPedido(body){
  const codigo = 'PED-' + new Date().toISOString().slice(2,19).replace(/[-:T]/g,'').slice(0,12);
  const registro = {
    codigo, status:'Novo',
    cliente_nome: body.cliente_nome, cliente_telefone: body.cliente_telefone,
    itens: body.itens || [], subtotal: body.subtotal||0, desconto: body.desconto||0,
    cupom: body.cupom||'', frete: body.frete||0, frete_regiao: body.frete_regiao||'',
    cep: body.cep||'', total: body.total||0, observacoes: body.observacoes||''
  };
  const { error } = await sb.from('pedidos').insert(registro);
  if(error){ console.error(error); return { ok:false, id:codigo, error:error.message }; }
  return { ok:true, id:codigo };
}
async function dbGetPedidos(){
  const { data, error } = await sb.from('pedidos').select('*').order('criado_em', { ascending:false });
  if(error){ console.error(error); return []; }
  return data.map(pedidoDoBanco);
}
async function dbAtualizarStatus(rowId, status){
  const { error } = await sb.from('pedidos').update({ status }).eq('id', rowId);
  if(error) return { ok:false, error:error.message };
  return { ok:true };
}

/* ============ MÉTRICAS ============ */
async function dbRegistrarView(id, nome){
  try{ await sb.rpc('incrementar_view', { p_id:String(id), p_nome:nome||'' }); }catch(e){}
}
async function dbGetMetricas(){
  const { data:views } = await sb.from('metricas').select('*').order('visualizacoes', { ascending:false });
  const { data:pedidos } = await sb.from('pedidos').select('status,total');
  const lista = (views||[]).map(v=>({ id:v.produto_id, nome:v.produto_nome, visualizacoes:v.visualizacoes }));
  const totalViews = lista.reduce((s,v)=>s+v.visualizacoes,0);
  const porStatus = { 'Novo':0,'Em Produção':0,'Pronto':0,'Entregue':0 };
  let totalVendido = 0;
  (pedidos||[]).forEach(p=>{ totalVendido += Number(p.total)||0; if(porStatus[p.status]!==undefined) porStatus[p.status]++; });
  return { maisVistos:lista.slice(0,10), totalViews, totalPedidos:(pedidos||[]).length, totalVendido, porStatus };
}

/* ============ AUTENTICAÇÃO (admin) ============ */
async function dbLogin(email, senha){
  const { data, error } = await sb.auth.signInWithPassword({ email, password:senha });
  if(error) return { ok:false, error:error.message };
  return { ok:true, user:data.user };
}
async function dbLogout(){ await sb.auth.signOut(); }
async function dbUsuarioLogado(){
  const { data } = await sb.auth.getSession();
  return data.session ? data.session.user : null;
}

/* ============ UPLOAD DE IMAGEM (Storage) ============ */
async function dbUploadImagem(file){
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const nome = `produto-${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(nome, file, { cacheControl:'3600', upsert:false });
  if(error) return { ok:false, error:error.message };
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(nome);
  return { ok:true, url:data.publicUrl };
}
