const { Pool } = require("pg");
(async()=>{
const p = new Pool({connectionString:"postgresql://postgres:postgres@127.0.0.1:5433/postgres", max:1});
const w = await p.query("select u.full_name, w.available_cents, w.pending_cents, w.lifetime_credit_cents from wallets w join users u on u.id=w.user_id where u.role='MEMBER' order by u.member_id");
console.table(w.rows);
const s = await p.query("select status, count(*)::int from ad_sessions group by 1");
console.table(s.rows);
await p.end();
})().catch(e=>{console.error(e);process.exit(1)});
