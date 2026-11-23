import { configuration, createStore, validateFeedback, shortText, stats, csv, UUID, HttpError, ipHash } from '../server/feedback.js';

export function createHandler({ env = process.env, storeFactory = createStore } = {}) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store, private');
    res.setHeader('X-Content-Type-Options','nosniff');
    const send=(status,value)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
    try {
      configuration(env);
      const url = new URL(req.url,'https://local.invalid');
      const action = url.searchParams.get('action') || '';
      if (!['GET','POST','PATCH'].includes(req.method)) throw new HttpError(405,'Method not allowed.');
      if (req.method !== 'GET' && req.headers.origin !== new URL(env.APP_ORIGIN).origin)
        throw new HttpError(403,'Please use the feedback form on the game website.');
      const store = storeFactory(env);
      let body = req.body ?? {};
      if (typeof body === 'string') {
        if (Buffer.byteLength(body)>24000) throw new HttpError(413,'Request too large.');
        try {body=JSON.parse(body);} catch {throw new HttpError(400,'Invalid JSON.');}
      }
      if (Buffer.byteLength(JSON.stringify(body))>24000) throw new HttpError(413,'Request too large.');
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400,'Expected a JSON object.');
      if (req.method !== 'GET' && !String(req.headers['content-type']).startsWith('application/json'))
        throw new HttpError(415,'Send JSON.');
      const token = (req.headers.cookie || '').split(';').map(v=>v.trim()).find(v=>v.startsWith('kw_admin='))?.slice(9);
      // Vercel overwrites this header at the edge; never trust a form-supplied address.
      const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const key=ipHash(ip,env);
      const cookie=(value,age)=>res.setHeader('Set-Cookie',`kw_admin=${value}; Path=/api/feedback; HttpOnly; SameSite=Strict; Max-Age=${age}${env.APP_ORIGIN.startsWith('https:') ? '; Secure':''}`);
      if (req.method==='POST' && action==='login') {
        await store.rate('login:'+key,10);
        shortText(body.password,256,'Password',true);
        const session=await store.login(shortText(body.email,254,'Email',true),body.password);
        cookie(session.access_token,Math.min(session.expires_in || 3600,3600));
        return send(200,{ok:true});
      }
      if (req.method==='POST' && !action) {
        return send(201,await store.submit(validateFeedback(body),key));
      }
      if (req.method==='POST' && action==='logout') {
        cookie('',0);
        if (token) await store.logout(token);
        return send(200,{ok:true});
      }
      await store.authorize(token);
      if (req.method==='GET' && ['','export'].includes(action)) {
        const rows = await store.list();
        if (action==='export') {
          res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');
          res.setHeader('Content-Disposition','attachment; filename="kingdom-wars-feedback.csv"');
          return res.end(csv(rows));
        }
        return send(200,{rows,stats:stats(rows)});
      }
      if (req.method==='PATCH' && !action) {
        if (!UUID.test(body.id)) throw new HttpError(400,'Invalid response ID.');
        await store.note(body.id,shortText(body.notes,5000,'Observation notes'));
        return send(200,{ok:true});
      }
      throw new HttpError(404,'Not found.');
    } catch(error) {
      return send(error.status || 503,{error:error.status ? error.message : 'Feedback service is unavailable. Your answers are kept; please retry.'});
    }
  };
}
export default createHandler();
