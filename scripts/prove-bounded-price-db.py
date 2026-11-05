# Fictional local PostgreSQL only. Never reads production configuration.
import pgserver,tempfile,subprocess,concurrent.futures,json,atexit
srv=pgserver.get_server(tempfile.mkdtemp(prefix='inference-price-proof-'));atexit.register(srv.cleanup)
def sql(q):
 r=subprocess.run(['/usr/lib/postgresql/14/bin/psql',srv.get_uri(),'-qtAX','-v','ON_ERROR_STOP=1','-c',q],capture_output=True,text=True)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
sql('create role anon;create role authenticated;create role service_role;')
sql(open('scripts/bounded-price-draft.sql').read())
sql("insert into inference_price_budgets(principal,budget_micros)values('fictional',500)")
def quote(i):
 id='00000000-0000-4000-8000-'+f'{i:012d}'
 sql(f"insert into inference_price_quotes(id,principal,digest,revision,expires_at,max_cost_micros)values('{id}','fictional','digest-{i}','revision',now()+interval '1 minute',300)")
 return id
q=quote(1)
def consume(id=q):return sql(f"select inference_price_consume('{id}','fictional','digest-{int(id[-12:])}','revision',300)")
with concurrent.futures.ThreadPoolExecutor(8)as pool:out=list(pool.map(lambda _:consume(),range(8)))
assert out.count('t')==1 and out.count('f')==7,out
other=quote(2);assert consume(other)=='f'
assert sql(f"select inference_price_consume('{other}','other','digest','revision',300)")=='f'
assert sql(f"select inference_price_consume('{other}','fictional','changed','revision',300)")=='f'
assert sql(f"select inference_price_settle('{q}',60)")=='t'
assert sql(f"select inference_price_settle('{q}',60)")=='f'
try:sql(f"select inference_price_settle('{q}',61)");raise AssertionError('conflicting settle accepted')
except RuntimeError:pass
assert consume()=='f';assert consume(other)=='t'
sql(f"update inference_price_quotes set state='reconcile'where id='{other}'")
third=quote(3);assert consume(third)=='f'
assert sql("select spent_micros from inference_price_budgets where principal='fictional'")=='60'
duplicate=quote(4);sql(f"update inference_price_quotes set digest='digest-1'where id='{duplicate}'");assert sql(f"select inference_price_consume('{duplicate}','fictional','digest-1','revision',300)")=='f'
print(json.dumps({'localPostgresOnly':True,'eightConcurrentConsumesOneWinner':True,'concurrentBudgetHeld':True,'changedPrincipalOrDigestRefused':True,'settlementIdempotent':True,'conflictingSettlementRefused':True,'unknownChargeRetainsHold':True,'replayNeverServes':True,'productionApplied':False}))
