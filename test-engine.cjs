const assert = require('node:assert/strict');
const E = require('./src/engine');
const data = require('./data.json');
const fixture = require('./test-fixtures.json');
let assertions = 0;
function near(a,b,tol=1e-9){assert.ok(Math.abs(a-b)<=tol,`${a} differs from ${b}`);assertions++;}
for(const test of fixture.matches){
  const result=E.match(test.q,test.r,{width:test.width,alpha:test.alpha,normalized:test.normalized});
  assert.equal(result.matches.length,test.matches.length);
  result.matches.forEach((m,i)=>{const ref=test.matches[i];assert.equal(m.qi,ref.query_index);assert.equal(m.ri,ref.reference_index);near(m.cost,ref.cost);});
  for(const a of result.matches)for(const b of result.matches)assert.ok((a.q-b.q)*(a.r-b.r)>=0);
}
fixture.sapp.points.forEach((p,i)=>near(E.scorePoint(fixture.sapp.q,E.features(p,data),data).score,fixture.sapp.scores[i]));
for(const location of [0,.05,12,24.95,25]){
  let integral=0;const dx=.001;
  for(let d=dx/2;d<25;d+=dx)integral+=E.density(d,location,.18)*dx;
  near(integral,1,2e-6);
}
const truth=[4.6,2.4],query=E.observations(truth,data.sources,0);
const refined=E.smart(query,data.sources,[4.5,2.5]);near(E.dist(refined.estimate,truth),0,1e-5);
for(const r of refined.rounds)for(const h of r.fit?.history||[])assert.ok(h.after<=h.before);
const refs=[{xy:[4,2],delays:E.observations([4,2],data.sources,0)},{xy:[5,3],delays:E.observations([5,3],data.sources,0)}];
const exact=E.mapLocalize(refs[0].delays,refs,1);near(E.dist(exact.estimate,refs[0].xy),0);
near(E.sum(E.mapLocalize(query,refs,2).chosen.map(r=>r.weight)),1);
const sapp=E.sapp(query,data),permuted=E.sapp([...query].reverse(),data);
near(E.sum(sapp.weights),1);near(E.dist(sapp.estimate,permuted.estimate),0,1e-8);
sapp.scores.forEach((v,i)=>near(v.score,E.scorePoint(query,sapp.fs[i],data).score));
const med=E.geometricMedian([[0,0],[0,0],[10,0]],[.4,.4,.2]);near(E.dist(med,[0,0]),0,1e-6);
assert.deepEqual(E.match([],[]).matches,[]);
assert.equal(E.mapLocalize([],refs).estimate,null);
assert.ok(E.sapp([],data).weights.every(Number.isFinite));
const r=E.match([2.1,3.4,5.8,6.2,10.3,13.6],[2.4,3.2,5.5,8.9,10.6,13.2,18.4]);
assert.ok(r.trace.some(s=>s.active?.rejected));assert.ok(r.trace.some(s=>s.round===2));
const training = E.trainingResponsibilities(data);
training.passes.forEach(pass => pass.rows.forEach(row => {
  row.peaks.forEach(peak => near(E.sum(peak.shares), 1));
  near(E.sum(row.counts), row.peaks.length);
}));
training.passes.at(-1).rows.forEach((row,i) => data.model.softCounts[i].forEach((count,j) => near(row.counts[j],count)));
training.globalCounts.forEach((count,j) => near(count,data.model.globalCounts[j]));
near(training.clutter,data.model.clutterRate);
console.log(`PASS: 60 Python association cases, SAPP Python likelihood and training counts, kernel normalization, solver objective, median, permutation and edge checks (${assertions} numeric comparisons).`);
