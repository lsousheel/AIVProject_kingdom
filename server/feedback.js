import { createHash, createHmac } from 'node:crypto';
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const choice = (v, values, name) => {
  if (!values.includes(v)) throw new HttpError(400, 'Choose a valid ' + name + '.');
  return v;
};
export function shortText(v, max, name, required = false) {
  if (typeof v !== 'string' || v.length > max || (required && !v.trim()))
    throw new HttpError(400, name + ' is missing or too long (maximum ' + max + ' characters).');
  return v.trim();
}
export function validateFeedback(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !UUID.test(body.id)) throw new HttpError(400, 'Invalid response ID.');
  if (body.website) throw new HttpError(400, 'Submission rejected.');
  if (!Number.isInteger(body.controls) || body.controls < 1 || body.controls > 10)
    throw new HttpError(400, 'Controls rating must be an integer from 1 to 10.');
  const data = {
    nickname: shortText(body.nickname, 80, 'Name or nickname', true),
    classmate: choice(body.classmate, ['Yes','No'], 'classmate answer'),
    controls: body.controls,
    confusing: shortText(body.confusing, 2000, 'Confusing or frustrating part', true),
    problems: choice(body.problems, ['None','Lag','Visual glitches','Both'], 'problem type'),
    problemContext: shortText(body.problemContext ?? '', 2000, 'Problem details'),
    objective: choice(body.objective, ['Yes','Partly','No'], 'objective answer'),
    help: choice(body.help, ['Yes','No'], 'help answer'),
    helpDetails: shortText(body.helpDetails ?? '', 1000, 'Help explanation'),
    improvement: shortText(body.improvement ?? '', 2000, 'Improvement'),
    tutorialHelpful: shortText(body.tutorialHelpful ?? '', 2000, 'Tutorial comments'),
    tutorialStatus: choice(body.tutorialStatus, ['not_started','in_progress','completed','skipped'], 'tutorial status'),
    tutorialStep: shortText(body.tutorialStep ?? '', 80, 'Tutorial step'),
    phase: choice(body.phase, ['PREPARATION','BATTLE','DEMONSTRATION','VICTORY','DEFEAT','DRAW'], 'game phase'),
    build: shortText(body.build ?? 'unknown', 100, 'Build'),
    viewport: shortText(body.viewport ?? '', 100, 'Viewport'),
    browser: shortText(body.browser ?? '', 500, 'Browser'),
    level: shortText(body.level ?? 'Original battlefield', 120, 'Level'),
  };
  return { id: body.id, data };
}
export function configuration(env) {
  const names = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_ANON_KEY','FEEDBACK_ADMIN_USER_ID','FEEDBACK_RATE_SALT','APP_ORIGIN'];
  if (names.some(n => !env[n])) throw new HttpError(503, 'Feedback storage is not configured yet. Please try later; your answers are kept in this tab.');
  if (!env.SUPABASE_URL.startsWith('https://') || env.FEEDBACK_RATE_SALT.length < 32)
    throw new HttpError(503, 'Feedback storage configuration needs attention.');
  return env;
}
export function createStore(env, request = fetch) {
  async function call(path, { method = 'GET', body, auth, token } = {}) {
    const key = auth ? env.SUPABASE_ANON_KEY : env.SUPABASE_SERVICE_ROLE_KEY;
    const response = await request(env.SUPABASE_URL.replace(/\/$/,'') + path, {
      method, headers: { apikey: key, Authorization: 'Bearer ' + (token || key),
        'Content-Type':'application/json', Prefer:'return=representation' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      if (auth && [400,401,403,422].includes(response.status)) throw new HttpError(401, 'Sign in with the authorized administrator account.');
      throw new HttpError(503, 'Feedback service is temporarily unavailable. Please retry.');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  return {
    async rate(key, limit) {
      const allowed = await call('/rest/v1/rpc/kw_feedback_rate', { method:'POST', body:{p_key:key,p_limit:limit} });
      if (!allowed) throw new HttpError(429, 'Too many requests. Please wait up to an hour and try again.');
    },
    async submit(value, ipKey) {
      const hash = createHash('sha256').update(JSON.stringify(value.data)).digest('hex');
      const result = await call('/rest/v1/rpc/kw_submit_feedback', {method:'POST',body:{
        p_id:value.id,p_data:value.data,p_hash:hash,p_ip:ipKey,p_test:env.FEEDBACK_TEST_MODE === 'true',
      }});
      if (result === 'conflict') throw new HttpError(409, 'This response ID already has different answers. Use the original retry or start a new review.');
      if (result === 'limited') throw new HttpError(429, 'Too many reviews from this connection. Please try again in an hour.');
      return {id:value.id};
    },
    async login(email,password) {
      const session = await call('/auth/v1/token?grant_type=password',{method:'POST',auth:true,body:{email,password}});
      if (session.user?.id !== env.FEEDBACK_ADMIN_USER_ID) throw new HttpError(403,'This account is not authorized.');
      return session;
    },
    async authorize(token) {
      if (!token) throw new HttpError(401,'Please sign in.');
      const user = await call('/auth/v1/user',{auth:true,token});
      if (user.id !== env.FEEDBACK_ADMIN_USER_ID) throw new HttpError(403,'This account is not authorized.');
    },
    logout: token => call('/auth/v1/logout',{method:'POST',auth:true,token}),
    async list() {
      const rows = [];
      // Fetch every page, including projects with PostgREST's default row limit.
      for (let offset=0;;offset+=500) {
        const page = await call('/rest/v1/kw_feedback?select=*&order=created_at.asc,id.asc&limit=500&offset='+offset);
        rows.push(...page);
        if (page.length<500) return rows;
      }
    },
    async note(id,notes) {
      const rows = await call('/rest/v1/kw_feedback?id=eq.'+id,{method:'PATCH',body:{notes}});
      if (!rows.length) throw new HttpError(404,'Response not found.');
    },
  };
}
export function stats(rows) {
  const people = new Map();
  for (const row of rows) if (!row.is_test && row.data.classmate === 'Yes')
    people.set(row.data.nickname.trim().toLowerCase(),row);
  const ratings = [...people.values()].map(r=>r.data.controls);
  return { responses:rows.filter(r=>!r.is_test).length, qualifying:ratings.length,
    average:ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : null,
    tests: rows.filter(r=>r.is_test).length };
}
export function csv(rows) {
  const fields = [
    ['Response ID',r=>r.id],['Submitted at (UTC)',r=>r.created_at],
    ['Development test',r=>r.is_test ? 'Yes':'No'],['Name / nickname',r=>r.data.nickname],
    ['Classmate outside project group',r=>r.data.classmate],['Controls rating (1-10)',r=>r.data.controls],
    ['Confusing / frustrating part',r=>r.data.confusing],['Lag / visual glitches',r=>r.data.problems],
    ['What was happening',r=>r.data.problemContext],['Understood objective',r=>r.data.objective],
    ['Needed help',r=>r.data.help],['Help explanation',r=>r.data.helpDetails],
    ['Requested improvement',r=>r.data.improvement],['Tutorial feedback',r=>r.data.tutorialHelpful],
    ['Tutorial status',r=>r.data.tutorialStatus],['Last tutorial step',r=>r.data.tutorialStep],
    ['Phase when opened',r=>r.data.phase],['Build',r=>r.data.build],
    ['Browser',r=>r.data.browser],['Viewport',r=>r.data.viewport],['Level',r=>r.data.level],
    ['Private observation notes',r=>r.notes],
  ];
  const escape = v => {
    let s = String(v ?? '');
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+[fields.map(([name])=>escape(name)).join(','),
    ...rows.map(row=>fields.map(([,get])=>escape(get(row))).join(','))].join('\r\n')+'\r\n';
}
export const ipHash = (ip,env) => createHmac('sha256',env.FEEDBACK_RATE_SALT).update(ip).digest('hex');
