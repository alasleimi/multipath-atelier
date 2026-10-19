(() => {
  'use strict';
  const E = LabEngine, $ = id => document.getElementById(id);
  const fmt = (v, n = 3) => Number.isFinite(v) ? (Math.abs(v)<.5*10**-n?0:Number(v)).toFixed(n) : '—';
  const xy = p => p ? `(${fmt(p[0], 2)}, ${fmt(p[1], 2)})` : 'unavailable';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const colors = ['#537e61','#be794d','#678ba0','#a29a55','#907f9f'];
  const defaultQ = [2.1,3.4,5.8,6.2,10.3,13.6], defaultR = [2.4,3.2,5.5,8.9,10.6,13.2,18.4];
  const state = { lesson:'mpurge', t:0, playing:false, timer:null, speed:2200, q:[...defaultQ], r:[...defaultR], alpha:.5,
    point:[4.6,2.4], noise:.08, missing:false, clutter:0, k:3, initial:[3.8,2.8], scale:.18,
    selectedRef:null, selectedCandidate:null, cell:null, source:0, showTruth:true, answer:null,
    trainingRow:27, trainingPeak:4, trainingPass:3 };
  const training = E.trainingResponsibilities(LAB_DATA);
  const meta = {
    mpurge: { n:'01', eyebrow:'THE ART OF ASSOCIATION', title:'Find the path in the pattern.', subtitle:'Two fingerprints. Unlabeled echoes. Watch MPUrge discover which paths belong together, one decision at a time.', breadcrumb:'Path association', phases:['Prepare','Compare','Merge','Purge','Urge','Result'],
      input:'INPUT · Two sets of path lengths', output:'OUTPUT · Consistent path pairs', takeaway:'A close delay is only part of the story.', take:'MPUrge also compares the spacing around a path. Two nearby peaks can belong to different reflections; a similar neighborhood supplies another clue.', challenge:'Try it: use only absolute distance →' },
    map: { n:'02', eyebrow:'FROM CORRESPONDENCE TO COORDINATES', title:'Let the fingerprints find you.', subtitle:'Follow a query across the survey map. See how match quality, coverage and weighted neighbors become a position.', breadcrumb:'Fingerprint positioning', phases:['Observe','Match & score','Rank','Weight','Locate'],
      input:'INPUT · Query + 12 surveyed fingerprints', output:'OUTPUT · A weighted position', takeaway:'A good match needs enough evidence.', take:'A reference with one excellent pair should not automatically beat a reference explaining almost the entire fingerprint. Coverage changes that comparison.', challenge:'Try it: keep only the best neighbor →' },
    smart: { n:'03', eyebrow:'POSITIONING AS A FEEDBACK LOOP', title:'A better guess, one circle closer.', subtitle:'Start with an approximate position. Predict the paths, associate the observations and let geometry move the estimate.', breadcrumb:'Geometric refinement', phases:['Initialize','Predict','Associate','Trilaterate','Repeat','Result'],
      input:'INPUT · Query + known virtual transmitters + initial position', output:'OUTPUT · A refined position', takeaway:'Geometry helps after association.', take:'The radius of each circle comes from a measured path. Assigning that path to the wrong virtual transmitter changes the problem the solver is trying to solve.', challenge:'Try it: begin farther from the receiver →' },
    sapp: { n:'04', eyebrow:'A PROBABILISTIC VIEW OF MULTIPATH', title:'Give every possible place a voice.', subtitle:'Explore how SAPP learns sources from a survey, models disappearing paths and turns a set of echoes into a position distribution.', breadcrumb:'Point-process inference', phases:['Survey','Sources','Intensity','Evidence','Posterior','Decode'],
      input:'INPUT · Survey-trained model + an unlabeled query', output:'OUTPUT · Position distribution + geometric median', takeaway:'Missing paths are evidence, too.', take:'SAPP scores both where peaks appear and how many peaks the model expected. Its count term prevents a candidate from winning simply by predicting many paths.', challenge:'Try it: remove a path and add clutter →' }
  };
  const refs = Array.from({length:12},(_,id) => { const p=[1+2*(id%4),1+2*Math.floor(id/4)]; return {xy:p,delays:E.observations(p,LAB_DATA.sources,.02),label:`R${id+1}`}; });
  let run, steps;
  const stage = (phase, title, text, formula, why, extra={}) => ({phase,title,text,formula,why,...extra});
  function matchText(s, result) {
    const a=s.active, count=result.originalQ.length, d=s.droppedQ.length+s.droppedR.length;
    if(s.phase==='prepare') return stage(0,'Start with unlabeled echoes.',`Each dot is a measured path length, not a known reflection. Sort both sets and keep the best ordered subset of the longer set. ${d ? `${d} extra path${d>1?'s are':' is'} set aside before matching.` : 'The two sets already have the same size.'}`,'path length d = c × delay τ','The labels A and B are measurement IDs. They do not reveal which wall produced a path.',{quiz:['Does the first sorted peak always represent the same reflection?','No','Yes','Correct. Order can change and paths can disappear; sorted rank is not a physical identity.']});
    if(s.phase==='cost') return stage(1,'Compare a path and its neighbors.',`Round ${s.round}: evaluate all ${s.q.length*s.r.length} possible pairs still in play. Mix the absolute path-length difference with the difference between local spacing patterns.`, `δ = ${fmt(result.opts.alpha,2)} × distance + ${fmt(1-result.opts.alpha,2)} × pattern`,'Open the inspector and select a cell to see its neighborhoods and exact cost. Smaller values indicate a closer match.');
    if(s.phase==='merge') return stage(2,'Make the choice mutual.',`${s.candidates.length} pair${s.candidates.length===1?' is':'s are'} mutual best matches. A chooses B as its cheapest partner, and B independently chooses A. Dashed links show these proposals.`, 'j = argmin δ[i, ·]\ni = argmin δ[·, j]','A one-way preference is not enough. Mutual choices make the correspondence one-to-one within this round.');
    if(s.phase==='purge') return stage(3,a.rejected?'This pair would cross. Reject it.':'This pair preserves the order.',`Consider A${a.qi+1} (${fmt(a.q,2)} m) and B${a.ri+1} (${fmt(a.r,2)} m), with cost ${fmt(a.cost)}. ${a.rejected?`Their ordering conflicts with accepted pair A${a.crossing.qi+1} ↔ B${a.crossing.ri+1}.`:'No previously accepted link has the opposite path-length ordering.'}`,'(dA − dA′) × (dB − dB′) ≥ 0',a.rejected?'The red link is excluded. A low numerical cost alone does not guarantee a consistent correspondence.':'The green link is retained. This is an ordering check, not proof that the physical reflection is correct.');
    if(s.phase==='urge') return stage(4,'Let the remaining paths try again.',`Remove both members of every mutual proposal, including rejected ones. ${s.remainingQ.length} path${s.remainingQ.length===1?' remains':'s remain'} in each set. ${s.remainingQ.length?'Rebuild their neighborhoods and recompute the costs.':'There are no remaining candidates.'}`,'remaining ← remaining ∖ proposed','The neighborhood changes after removal. A pair that was not a mutual choice can become one in the next round.');
    return stage(5,'A correspondence, with a reason.',`${s.accepted.length} pair${s.accepted.length===1?' survives':'s survive'} from ${count} paths in A and ${result.originalR.length} in B. These pairs can connect fingerprints across survey positions; consistent tracks can then support virtual-transmitter reconstruction.`, `mean accepted cost = ${fmt(E.mean(s.accepted.map(p=>p.cost)))}`,'This lesson visualizes the matching engine. Full multi-survey tracking and virtual-transmitter reconstruction are outside this walkthrough.');
  }
  function buildRun(reset=true) {
    pause(); state.cell=null; state.answer=null;
    if(reset) state.t=0;
    if(state.lesson==='mpurge') {
      run=E.match(state.q,state.r,{alpha:state.alpha});
      steps=run.trace.map(s=>({...matchText(s,run),scene:'match',matchState:s}));
    } else {
      const query=E.observations(state.point,LAB_DATA.sources,state.noise,state.missing,state.clutter);
      if(state.lesson==='map') {
        run={...E.mapLocalize(query,refs,state.k),query};
        steps=[stage(0,'Listen at an unknown position.',`The receiver observes ${query.length} unlabeled paths. We will compare them with fingerprints at 12 surveyed positions. The receiver truth is displayed only so you can judge the result.`, 'query = {d₁, d₂, …, dₙ}','The localizer sees the path lengths and the survey. It does not use the true receiver coordinates.',{scene:'room',mode:'observe'})];
        refs.forEach((ref,id)=> { const r=run.ranked.find(v=>v.id===id); steps.push(stage(1,`Ask reference ${ref.label}.`,`${r.count} pairs survive MPUrge. Their mean cost is ${fmt(r.avg)} and coverage is ${fmt(100*r.coverage,1)}%. Divide the cost by coverage to penalize partial explanations.`,`score = ${fmt(r.avg)} / ${fmt(r.coverage)}\n      = ${fmt(r.score)}`,'The pattern term is normalized here. Each reference runs its own full Merge–Purge–Urge loop; inspect a reference to follow that loop.',{scene:'room',mode:'score',ref:id})); });
        steps.push(stage(2,'Keep the strongest explanations.',`Rank the 12 reference scores from low to high. Select the best ${run.chosen.length} reference${run.chosen.length===1?'':'s'}; the others contribute no coordinate weight.`,`selected = ${run.chosen.map(r=>r.label).join(', ')}`,'A score is a dissimilarity, not a calibrated probability.',{scene:'room',mode:'rank',quiz:['With k = 1, can the estimate fall between reference points?','No','Yes','Correct. A single selected reference has weight one, so its coordinates are the estimate.']}));
        steps.push(stage(3,'Let better matches pull harder.',`Convert each selected score into an inverse-score weight. Normalize the weights so they sum to one. ${run.chosen[0].label} contributes ${fmt(run.chosen[0].weight*100,1)}% of the weighted position.`, 'wᵢ = (1 / scoreᵢ) / Σⱼ(1 / scoreⱼ)','The strongest reference has the largest influence. Increase k to see how additional neighbors move the estimate.',{scene:'room',mode:'weight'}));
        steps.push(stage(4,'Meet at the weighted position.',`The coordinate average is ${xy(run.estimate)} m. In this synthetic example its distance to the receiver truth is ${fmt(E.dist(run.estimate,state.point))} m.`, 'x̂ = Σᵢ wᵢ xᵢ','The weighted estimate can lie between surveyed locations. Its error in this scene is not a benchmark result.',{scene:'room',mode:'final'}));
      } else if(state.lesson==='smart') {
        run={...E.smart(query,LAB_DATA.sources,state.initial),query};
        steps=[stage(0,'Begin with an imperfect guess.',`Our starting position is ${xy(state.initial)} m. Five ideal image sources are supplied in this teaching scene. The actual receiver remains hidden from the optimizer.`, 'x₀ = initial position','A practical system needs calibrated or reconstructed virtual transmitters. Here they are known exactly so you can isolate the refinement loop.',{scene:'room',mode:'smart',position:state.initial,round:0})];
        run.rounds.forEach((r,idx)=> {
          steps.push(stage(1,`Predict from guess ${idx+1}.`,`Measure the geometric distance from ${xy(r.initial)} to every virtual transmitter. These predicted path lengths carry source identities; the query paths do not.`, 'd̃ⱼ = ‖x − VTⱼ‖','The dashed rays are predictions from the current guess, not new measurements.',{scene:'room',mode:'predict',position:r.initial,round:idx,quiz:['Does a smaller range residual always mean less position error?','No','Yes','Correct. A wrong association can fit well numerically while placing the receiver in the wrong location.']}));
          steps.push(stage(2,'Attach measurements to sources.',`MPUrge associates ${r.association.matches.length} measured paths with predicted paths. The source identity of each prediction transfers to its matched measurement.`, 'measured path ↔ predicted range ↔ VT','Open the inspector to replay this association or examine every residual.',{scene:'room',mode:'associate',position:r.initial,round:idx}));
          if(r.stopped) { steps.push(stage(5,'Too few constraints to continue.',`Only ${r.association.matches.length} pairs survived. This 2D walkthrough requires at least three. The last position is retained.`, 'accepted pairs < 3 → stop','Having three pairs is necessary here; degenerate geometry can still make positioning ambiguous.',{scene:'room',mode:'smart',position:r.initial,round:idx})); return; }
          const history=r.fit.history;
          if(!history.length) steps.push(stage(3,'The fitted position is stationary.','The least-squares solver found no improving update for these associations.','minₓ Σⱼ (‖x − VTⱼ‖ − dⱼ)²','The objective measures range disagreement, not distance to the true receiver.',{scene:'room',mode:'solve',position:r.fit.position,round:idx}));
          history.forEach((h,i)=>steps.push(stage(3,`Move toward the circle intersections.`,`Iteration ${idx+1}, solver update ${i+1}: the sum of squared range residuals changes from ${fmt(h.before,5)} to ${fmt(h.after,5)} m². The position moves to ${xy(h.to)} m.`, 'minₓ Σⱼ (‖x − VTⱼ‖ − dⱼ)²','Circles use measured ranges. With noise or wrong associations, they need not share an intersection; least squares finds a compromise.',{scene:'room',mode:'solve',position:h.to,from:h.from,round:idx,inner:i})));
          steps.push(stage(4,'Feed the new guess back in.',`Position changed by ${fmt(E.dist(r.initial,r.fit.position),6)} m. ${idx<run.rounds.length-1?'Predict fresh ranges and reassociate before the next fit.':'The configured stopping condition has been reached.'}`, 'predict → associate → fit → repeat','An improved numerical fit does not always imply a better physical location. Initial position and association quality still matter.',{scene:'room',mode:'smart',position:r.fit.position,round:idx}));
        });
        if(!run.rounds.at(-1)?.stopped) steps.push(stage(5,'Inspect the position you reached.',`After ${run.rounds.length} outer iterations, the estimate is ${xy(run.estimate)} m. The teaching-only truth comparison gives an error of ${fmt(E.dist(run.estimate,state.point))} m.`, `x̂ = ${xy(run.estimate)} m`,'Try starting farther away. The same observations can lead to different associations and a different final solution.',{scene:'room',mode:'final',position:run.estimate,round:run.rounds.length-1}));
      } else {
        run={...E.sapp(query,LAB_DATA,{scale:state.scale}),query};
        state.selectedCandidate=E.argmin(run.points.map(p=>E.dist(p,[4.5,2.5])));
        const m=LAB_DATA.model;
        steps=[stage(0,'Survey first. Localize later.',`At 35 known positions, collect sets of path lengths without reflection labels. The fitted model in this file was learned from these survey sets using the project's SAPP implementation.`, 'training data = {(positionᵢ, delay setᵢ)}','Survey training is precomputed and replayed here. Query generation, scoring and position decoding run live in your browser.',{scene:'room',mode:'survey'})];
        m.anchors.forEach((a,i)=>steps.push(stage(1,`Discover source ${i+1} from consensus.`,`The fitted source at (${fmt(a[0],2)}, ${fmt(a[1],2)}, |h|=${fmt(a[2],2)}) predicts a nearby observed path at ${m.support[i]} of 35 survey positions. Its retained discovery residual is ${fmt(m.residual[i],4)} m.`, 'ρⱼ(x) = √((x−aⱼ)² + (y−bⱼ)² + hⱼ²)','Training proposes sources from triples of survey measurements, scores their support, then refines them. These are the actual retained fit outputs, not individual RANSAC trials.',{scene:'room',mode:'discover',source:i})));
        steps.push(stage(2,'Share one peak between possible explanations.','At a known survey position, the sources found in steps 2–6 predict five path lengths. Compare one measured peak with every prediction: a closer length usually gives that source more support. Also keep an unexplained option for peaks that none of the sources fit well.', 'rⱼ = gⱼ k(d | ρⱼ) / Z\nZ = κ/L + Σₐ gₐ k(d | ρₐ)\nrᵤ = (κ/L) / Z',
          'These are fractions of one observed peak, not pieces of a radio wave. Two sources may share it; another peak can also support those same sources. Nothing is removed after choosing a best match.',{scene:'room',mode:'responsibility',
          explain:['Multiply each source’s closeness curve by its current expected count. Add the five results and the unexplained option. Divide each result by that total, so all six shares add to 1.', 'Repeat for every peak in the survey set. Add a source’s fractions down the column to get its soft count. A count of 0.95 means about 0.95 of the observed peaks are attributed to it.', 'Recompute the overall source counts from all 35 survey positions, then repeat. This fit uses four passes. The diagram replays these count updates using the learned sources; the initial counts are 0.35 per source and 1 unexplained peak.'],refs:['discover']}));
        steps.push(stage(2,'How many echoes should this source contribute?','Step 7 gave each source a fractional peak count at every surveyed position. To predict its count at a new position, average nearby survey counts, giving closer survey positions more influence. A small contribution from the overall source count stabilizes this average.', 'νⱼ(x) = expected peaks from source j\n         at receiver position x','Each square is a possible receiver position. Darker green means more expected peaks from the selected source. A count near 1 means about one echo per observation, on average; fractions and counts slightly above 1 are allowed. Try Source 5 to see a larger change across the room.',{scene:'room',mode:'visibility',refs:['responsibility']}));
        steps.push(stage(2,'Keep what geometry did not explain.','Step 7 also left an unexplained fraction on each survey peak. After the last count update, recompute those fractions with the final overall counts. Keep each peak’s measured length and its remaining fraction, instead of discarding it.', 'b(d | x) = learned unexplained-echo curve',
          'The amber curve remembers where unexplained survey peaks occurred. It is different from the flat allowance for extra peaks added in step 10: that allowance has no preferred path length.',{scene:'density',mode:'background',explain:['Place a small smooth curve at each of these measured lengths, with area equal to its unexplained fraction. Combine curves from the survey, weighting nearby survey positions more strongly.', 'At the candidate shown, the amber curve is the resulting expected peaks per metre. The green curve is the contribution from learned sources, using the counts from step 8. Neither curve has been reduced for missed echoes yet.'],refs:['responsibility','visibility']}));
        steps.push(stage(3,'Build the expected echo curve.',`The new receiver measurement has ${query.length} peaks, with no source labels. Test each of the ${run.points.length} candidate positions separately. At a candidate, ask: which path lengths should produce peaks here, and how many?`, 's(d | x) = Σⱼ νⱼ(x) k(d | ρⱼ(x)) + b(d | x)\nλ(d | x) = 0.75 s(d | x) + 2 / 25',
          'The 75% and 2-peak settings are fixed assumptions in this example, not estimates of which query peaks are missing or extra. The measured peaks are used to score the completed curve in steps 11 onward.',{scene:'density',mode:'density',explain:['Use the source positions from steps 2–6 to predict path lengths here. Put a smooth curve around each prediction, with area equal to that source’s expected count from step 8. Add the learned unexplained-echo curve from step 9.', 'Some echoes represented in the survey may not be detected in the new measurement. Multiply the entire learned curve by 0.75: on average, retain 75% of those expected peaks. A learned total of 4 becomes 3; no specific peak is deleted.', 'Allow 2 additional, unrelated peaks on average anywhere in the 0–25 m window. Spread that count evenly: 2 ÷ 25 = 0.08 expected peaks per metre. Add this flat blue line to get the dark total curve.'],refs:['discover','visibility','background']}));
        steps.push(stage(3,'Start with how many peaks you expect.','The area under the total curve from step 10 is the number of peaks a candidate expects in one measurement. Start its score by subtracting that count. For example, expecting 6 peaks starts the score at −6. The next steps add support for the peaks actually measured.', 'ℓ₀(x) = −0.75 ∫s(d | x) dd − 2','This count penalty matters: a candidate cannot get a good score merely by predicting peaks everywhere. It must also explain the measured lengths. Both parts belong to the Poisson model used here.',{scene:'room',mode:'evidence',used:0,quiz:['Can a position lose score for predicting too many peaks?','Yes','No','Correct. The starting score subtracts the expected number of detections.']}));
        query.forEach((d,i)=>steps.push(stage(3,`Add evidence from peak ${i+1}.`,`Evaluate the intensity at ${fmt(d)} m for every candidate. Add its logarithm to the running score. The map now includes ${i+1} of ${query.length} observed peaks.`, `ℓ${i+1}(x) = ℓ${i}(x) + log λ(${fmt(d)} | x)`,'A peak supports positions whose predicted intensity is high at its delay. This updates all candidates rather than selecting one path pairing.',{scene:'room',mode:'evidence',used:i+1,peak:i})));
        steps.push(stage(4,'Normalize the competing explanations.',`Turn the complete log scores on ${run.points.length} equally spaced candidates into weights. Subtract the largest log score before exponentiation for numerical stability.`, 'pᵢ = exp(ℓᵢ − max ℓ) / Σⱼ exp(ℓⱼ − max ℓ)','This is a discrete posterior under a uniform candidate prior. Multiple bright regions indicate remaining ambiguity.',{scene:'room',mode:'posterior',used:query.length}));
        steps.push(stage(5,'Choose the geometric median.',`Find the position minimizing posterior expected Euclidean distance: ${xy(run.estimate)} m. The cross marks the highest-weight candidate; the green ring is the geometric median.`, 'x̂ = argminₓ Σᵢ pᵢ ‖x − xᵢ‖','The median summarizes the distribution. It need not coincide with the mode or the coordinate-wise median.',{scene:'room',mode:'final',used:query.length}));
      }
    }
    state.t=Math.min(state.t,steps.length-1);
    renderAll();
  }
  function stepLink(mode, label) {
    const i=steps.findIndex(s=>s.mode===mode);
    return `<button class="step-link" data-goto-step="${i}">Step ${i+1} · ${esc(label)}</button>`;
  }
  function symbolKey(s) {
    const position=['x','Receiver position being tested (two coordinates, in metres).'];
    const length=['d','Measured path length in metres; delay multiplied by propagation speed.'];
    const range=['ρⱼ(x)','Path length predicted from position x to learned source j (metres).'];
    const kernel=['k(d | ρⱼ(x))','Smooth curve centered on the predicted length. Its area is 1; height is per metre. “|” means “given”.'];
    const count=['νⱼ(x)','Expected peaks from source j at x, learned in step 8.'];
    const background=['b(d | x)','Unexplained-echo curve learned in step 9, in expected peaks per metre.'];
    const intensity=['λ(d | x)','Total expected peaks per metre at length d, after allowing missed and extra peaks.'];
    const learned=['s(d | x)','Sum of all source curves and the unexplained-echo curve, before the 75% adjustment.'];
    const definitions={
      survey:[['i','Survey record, from 1 to 35.'],['positionᵢ','Known receiver coordinates for survey record i (metres).'],['delay setᵢ','Unlabeled measured path lengths at that position, expressed in metres.'],['{…}','The collection of survey records.']],
      discover:[['x = (x, y)','Receiver position; x and y inside the square root are its horizontal coordinates (metres).'],['j','Learned source number, from 1 to 5.'],['aⱼ, bⱼ','Horizontal coordinates of source j (metres).'],['hⱼ','Nonnegative fitted height offset (metres).'],range,['√','Square root: converts squared coordinate differences to a distance.']],
      responsibility:[['rⱼ / rᵤ','Fraction of this peak assigned to source j / to the unexplained option.'],['j, a','Source indices. Σₐ adds the terms for all five sources.'],length,['ρⱼ','Predicted path length from the known survey position to source j (metres).'],['gⱼ','Current overall expected count for source j in this training pass.'],['k(d | ρⱼ)','Closeness curve evaluated at d; area 1, units per metre, training scale 0.18 m.'],['κ','Current overall unexplained-peak count in this training pass.'],['L','Path-length window width: 25 m. κ/L is a flat unexplained-peak density.'],['Z','Sum of the five source strengths and κ/L. Dividing by Z makes the six shares sum to 1.']],
      visibility:[count,['j','The selected learned source, from 1 to 5.'],position],
      background:[background,length,position,['|','“Given”: read b(d | x) as the curve at path length d, given receiver position x.']],
      density:[learned,intensity,length,position,['j, Σⱼ','Source number; sum over all five learned sources.'],count,range,kernel,background,['0.75','Assumed fraction of survey-like peaks detected in a new measurement: 75%.'],['2 / 25','2 expected extra peaks spread across a 25 m window: 0.08 peaks per metre.']],
      evidence:s.used===0?[['ℓ₀(x)','Starting log score at candidate x, before adding observed peaks.'],position,learned,['∫s(d | x) dd','Area under the learned curve from 0 to 25 m: its total expected peak count. d is path length; dd means integrate along that axis.'],['−0.75 … − 2','Retain 75% of the learned count, add 2 expected extra peaks, then subtract that total from the score.']]:[['ℓₙ(x)','Running log score after n measured peaks. The numbered subscripts in the formula count processed peaks.'],position,intensity,['Numeric argument of λ','The current peak’s measured path length in metres.'],['log','Natural logarithm; converts multiplication of peak contributions into addition.']],
      posterior:[['i, j','Candidate position indices, from 1 to 609.'],['pᵢ','Normalized probability weight of candidate i. All weights sum to 1.'],['ℓᵢ','Complete log score at candidate i, including every observed peak and the count penalty.'],['max ℓ','Largest log score among all candidates; subtract it to avoid numerical overflow.'],['exp','Exponential function, the inverse of the natural logarithm.'],['Σⱼ','Sum over all 609 candidates; this denominator normalizes the weights.']],
      final:[['x̂','The reported receiver position: the geometric median (metres).'],['x','A possible output position being optimized, allowed between grid points.'],['xᵢ','Coordinates of grid candidate i (metres).'],['pᵢ','Candidate i’s probability weight from the Posterior step.'],['‖x − xᵢ‖','Straight-line distance between the output position and candidate i (metres).'],['Σᵢ','Sum over all 609 grid candidates.'],['argminₓ','Choose the position x making the weighted sum of distances smallest.']]
    };
    return `<div class="formula-key" role="group" aria-label="Symbols in this equation"><span class="key-title">READ THE SYMBOLS</span><dl>${(definitions[s.mode]||[]).map(([symbol,meaning])=>`<div><dt>${esc(symbol)}</dt><dd>${esc(meaning)}</dd></div>`).join('')}</dl></div>`;
  }
  function methodOverview() {
    const node=(mode,title,text)=>{const i=steps.findIndex(s=>s.mode===mode);return `<button class="method-node ${steps[state.t].mode===mode?'current':''}" data-goto-step="${i}"><span>STEP ${i+1}${mode==='discover'?'–6':''}</span><b>${title}</b><small>${text}</small></button>`;};
    return `<div class="method-heading"><div><span class="eyebrow">SAPP · THE COMPLETE PATH</span><h2>From surveyed echoes to a position.</h2></div><span>Choose a card to explore its step ↗</span></div>
      <div class="method-lane"><h3><b>01</b> Learn from known positions <small>Training · kept fixed while you change the query</small></h3><div class="method-flow">
      ${node('survey','Collect survey sets','35 known receiver positions + their unlabeled peak lengths.')}
      ${node('discover','Find source positions','Find geometry that predicts peaks across many survey sets.')}
      ${node('responsibility','Share each peak','Divide its support among sources and an unexplained option. Add shares into counts.')}
      <div class="method-split">${node('visibility','Learn source counts','Nearby survey counts → expected count for each source at x.')}${node('background','Keep unexplained echoes','Remaining peak shares → a curve of their path lengths at x.')}</div></div></div>
      <div class="method-transfer"><span aria-hidden="true">↓</span><p><b>Carry the source positions, source-count maps and unexplained-echo curves into positioning.</b><br>A new measurement supplies only its peak lengths; its receiver position is unknown.</p></div>
      <div class="method-lane query-lane"><h3><b>02</b> Test possible receiver positions <small>Positioning · recomputed for each new query</small></h3><div class="method-flow">
      ${node('density','Build the echo curve','At each candidate: source curves + unexplained curve. Keep 75%; add 2 expected extra peaks.')}
      <div class="method-split">${node('evidence','Start with the count','Subtract the total number of peaks the curve expects.')}<button class="method-node ${steps[state.t].mode==='evidence'&&steps[state.t].used>0?'current':''}" data-goto-step="${steps.findIndex(s=>s.mode==='evidence'&&s.used===1)}"><span>THEN EACH OBSERVED PEAK</span><b>Add its evidence</b><small>Read the curve at that measured length. Add the log of its height to the candidate’s score.</small></button></div>
      ${node('posterior','Compare positions','Turn the completed scores into weights that add to 1 over the grid.')}
      ${node('final','Report a position','Find the geometric median: the position with the smallest weighted distance to the candidates.')}
      </div></div><p class="method-note">Training uses known survey coordinates. Positioning uses the learned model and the new peak lengths. The orange receiver-truth marker is only a teaching aid.</p>`;
  }
  function trainingSelection() {const pass=training.passes[state.trainingPass],row=pass.rows[state.trainingRow];return {pass,row,peak:row.peaks[state.trainingPeak]};}
  function responsibilityDiagram() {
    const {row,peak}=trainingSelection(),n=LAB_DATA.model.anchors.length;
    let out=`<text x="28" y="30" font-size="15">One measured peak → six possible explanations</text><rect x="24" y="57" width="206" height="209" rx="6" fill="#f0f3e9"/><text x="42" y="83" font-size="13">Survey S${state.trainingRow+1} · pass ${state.trainingPass+1} of 4</text><text x="42" y="118" font-size="26" class="mono">${fmt(peak.d)} m</text><text x="42" y="141" font-size="13">Measured peak ${state.trainingPeak+1}</text><text x="42" y="177" font-size="13">Compare all predictions,</text><text x="42" y="197" font-size="13">then divide each strength</text><text x="42" y="217" font-size="13">by their total.</text><text x="42" y="248" font-size="13" class="mono">Shares sum to ${fmt(E.sum(peak.shares),3)}</text><path d="M238 163H262" stroke="#8da384" stroke-width="1.5"/><path d="M256 158L263 163L256 168" fill="none" stroke="#8da384"/><text x="280" y="56" font-size="12">Explanation</text><text x="435" y="56" text-anchor="end" font-size="12">Predicts (m)</text><text x="470" y="56" font-size="12">Share of this peak</text>`;
    peak.shares.forEach((share,j)=>{const y=84+j*33,c=colors[j]||'#9b9e92';out+=`<text x="280" y="${y}" font-size="13">${j<n?'Source '+(j+1):'Unexplained'}</text><text x="422" y="${y}" text-anchor="end" class="mono" font-size="13">${j<n?fmt(row.ranges[j]):'any'}</text><rect x="448" y="${y-12}" width="172" height="17" rx="2" fill="#edf0e7"/><rect class="share-bar" x="448" y="${y-12}" width="${172*share}" height="17" rx="2" fill="${c}"/><text x="687" y="${y}" text-anchor="end" class="mono" font-size="13">${fmt(100*share,2)}%</text>`;});
    out+=`<path d="M24 289H696" stroke="#dce0d6"/><text x="28" y="315" font-size="14">Add shares from all ${row.peaks.length} peaks → counts at S${state.trainingRow+1}</text>`;
    row.counts.forEach((v,j)=>{const x=28+j*111;out+=`<text x="${x}" y="342" font-size="12">${j<n?'Source '+(j+1):'Unexplained'}</text><text x="${x}" y="368" class="mono" font-size="21">${fmt(v)}</text>`;});
    out+=`<text x="28" y="398" font-size="12">Total count = ${fmt(E.sum(row.counts),0)} peaks. Change the peak above to see where each fraction goes.</text>`;
    return svg(out,`Training responsibility at survey S${state.trainingRow+1}: peak ${state.trainingPeak+1} has six fractional explanations which sum to one.`);
  }
  function trainingInspector() {
    const {pass,row,peak}=trainingSelection(),n=LAB_DATA.model.anchors.length;
    return `<div class="numbers-grid"><div><h3>Where this peak’s fractions come from</h3><p>S${state.trainingRow+1}, peak ${state.trainingPeak+1} (${fmt(peak.d,6)} m), pass ${state.trainingPass+1}. Each strength is divided by the same total Z = ${fmt(peak.total,8)} m⁻¹.</p><div class="table-scroll"><table><thead><tr><th>Explanation</th><th>Count g / κ</th><th>Curve k / 1/L</th><th>Strength</th><th>Share</th></tr></thead><tbody>${peak.shares.map((share,j)=>`<tr><td>${j<n?'Source '+(j+1):'Unexplained'}</td><td>${fmt(j<n?pass.globalCounts[j]:pass.clutter,6)}</td><td>${fmt(j<n?peak.kernels[j]:1/25,6)}</td><td>${fmt(peak.strengths[j],6)}</td><td>${fmt(share,6)}</td></tr>`).join('')}</tbody></table></div><p>Count × curve height = strength. Strength ÷ Z = share. Curve heights and strengths have units per metre; shares have no units.</p></div><div><h3>Sum each source’s column</h3><div class="table-scroll"><table><thead><tr><th>Peak (m)</th>${row.counts.map((_,j)=>`<th>${j<n?'Src '+(j+1):'Unexpl.'}</th>`).join('')}</tr></thead><tbody>${row.peaks.map((p,i)=>`<tr class="${i===state.trainingPeak?'active':''}"><td><button data-training-peak="${i}">${fmt(p.d,4)}</button></td>${p.shares.map(v=>`<td>${fmt(v,4)}</td>`).join('')}</tr>`).join('')}<tr><th>Soft count</th>${row.counts.map(v=>`<td>${fmt(v,6)}</td>`).join('')}</tr></tbody></table></div><p>Each row adds to 1. Each column total is that explanation’s fractional peak count at this survey position. The pass-4 source totals match the stored Python training outputs.</p><p>The next pass’s overall source count is (sum across 35 survey positions + 0.25) ÷ 35.5, limited to [0.015, 1.8]. For unexplained peaks, add 0.5 instead and limit to [0.05, 6]. These small additions stabilize the counts.</p></div></div>`;
  }
  function curveInspector(s) {
    const idx=state.selectedCandidate??run.mode,f=run.fs[idx],sc=run.scores[idx];
    const selector=`<div class="inspect-select"><label for="candidateX">Inspect candidate x</label><input id="candidateX" type="number" min=".5" max="7.5" step=".25" value="${f.point[0]}" style="width:75px"><label for="candidateY">y</label><input id="candidateY" type="number" min=".5" max="5.5" step=".25" value="${f.point[1]}" style="width:75px"><button id="inspectCandidate" class="text-button">Inspect ↗</button></div>`;
    if(s.mode==='background') {
      const counts=LAB_DATA.model.background.map(row=>E.sum(row.map(p=>p.w))),global=.5*E.mean(counts)/f.denominator;
      return selector+`<div class="numbers-grid"><div><h3>Build the unexplained-echo curve</h3><p>Each stored survey peak contributes a smooth curve centered on its measured length. Its area is the peak’s final unexplained fraction. At ${xy(f.point)} m, multiply those curves by the survey’s proximity weight, sum them, add a small overall contribution, then divide by ${fmt(f.denominator,6)}.</p><div class="table-scroll"><table><thead><tr><th>Survey</th><th>Proximity weight</th><th>Unexplained count</th><th>Area contributed here</th></tr></thead><tbody>${counts.map((v,i)=>`<tr><td>S${i+1} ${xy(LAB_DATA.survey[i])}</td><td>${fmt(f.spatial[i],6)}</td><td>${fmt(v,6)}</td><td>${fmt(f.spatial[i]*v/f.denominator,6)}</td></tr>`).join('')}</tbody></table></div><p>The denominator is the sum of proximity weights + 0.5. The overall contribution adds ${fmt(global,6)} expected peaks. Summing this and the last column gives ${fmt(f.bgIntegral,6)} unexplained peaks.</p></div><div><h3>Read areas as expected counts</h3><div class="code">Green: source curves from step 8\narea = ${fmt(E.sum(f.intensities),6)} expected peaks\n\nAmber: unexplained survey echoes\narea = ${fmt(f.bgIntegral,6)} expected peaks\n\nLearned total before missed echoes\n= ${fmt(f.integral,6)} expected peaks</div><p>All curves use smooth Student-t kernels (3 degrees of freedom), normalized to area 1 over 0–25 m. The query-scale control chooses their width. The survey fractions stay fixed.</p><p>The new measurement is introduced in step 10. Position scores start in step 11.</p></div></div>`;
    }
    return selector+`<div class="numbers-grid"><div><h3>Build the total curve at each measured length</h3><p>For each row: add the source and unexplained-echo heights, multiply by 0.75, then add 0.08. Every value below is expected peaks per metre. No source is assigned to a query peak.</p><div class="table-scroll"><table><thead><tr><th>Measured length (m)</th><th>Source curves</th><th>Unexplained curve</th><th>Total after adjustment</th></tr></thead><tbody>${run.query.map((d,j)=>`<tr><td>${fmt(d,5)}</td><td>${fmt(sc.source[j],6)}</td><td>${fmt(sc.background[j],6)}</td><td>${fmt(sc.lambda[j],6)}</td></tr>`).join('')}</tbody></table></div><p>The source curves use the learned positions from steps 2–6 and counts from step 8. The unexplained curve comes from step 9. These heights will contribute to the position score in the following steps.</p></div><div><h3>From the learned count to the new count</h3><div class="code">Source-curve area = ${fmt(E.sum(f.intensities),6)}\nUnexplained-curve area = ${fmt(f.bgIntegral,6)}\nLearned total = ${fmt(f.integral,6)} peaks\n\nAllow some learned echoes to be missed:\n0.75 × ${fmt(f.integral,6)} = ${fmt(.75*f.integral,6)}\n\nAdd 2 expected unrelated peaks:\nnew total = ${fmt(sc.expectedCount,6)} peaks</div><p>The 75% setting reduces the expected count; it does not remove particular measured peaks. The extra-peak allowance has area 2, because its height is 0.08 across the 25 m window.</p><p>Both settings are fixed assumptions in this teaching example. The count penalty and measured-peak scores are introduced next.</p></div></div>`;
  }
  function svg(content, label, extra='') { return `<svg viewBox="0 0 720 405" role="img" aria-label="${esc(label)}" ${extra}><defs><pattern id="dotgrid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#dce2d5"/></pattern><clipPath id="plotClip"><rect x="45" y="30" width="630" height="335"/></clipPath></defs>${content}</svg>`; }
  function matchDiagram(result,s) {
    const oq=result.originalQ,or=result.originalR;
    const y=(i,n)=>87+i*(248/Math.max(1,n-1));
    const pos=(id,arr)=>y(arr.findIndex(p=>p.id===id),arr.length);
    let out=`<rect x="32" y="37" width="656" height="328" rx="6" fill="url(#dotgrid)"/><text x="155" y="35" font-size="11" letter-spacing="1.6">FINGERPRINT A</text><text x="460" y="35" font-size="11" letter-spacing="1.6">FINGERPRINT B</text><line x1="205" x2="205" y1="57" y2="353" stroke="#d5decf"/><line x1="515" x2="515" y1="57" y2="353" stroke="#d5decf"/>`;
    const accepted=s.accepted||[];
    accepted.forEach(p=>{out+=`<path class="edge" d="M205 ${pos(p.qi,oq)} C320 ${pos(p.qi,oq)} 400 ${pos(p.ri,or)} 515 ${pos(p.ri,or)}" stroke="#729467" stroke-width="2.1"/>`;});
    if(s.phase==='cost') (s.q||[]).forEach(q=>(s.r||[]).forEach(r=>{out+=`<line x1="205" y1="${pos(q.id,oq)}" x2="515" y2="${pos(r.id,or)}" stroke="#8f9d86" opacity=".13"/>`;}));
    (s.candidates||[]).forEach(p=>{
      if(accepted.some(a=>a.qi===p.qi&&a.ri===p.ri)&&!p.rejected) return;
      const yy=pos(p.qi,oq),ry=pos(p.ri,or),c=p.rejected?'#b86842':'#678ba0';
      out+=`<path class="${p.rejected?'edge':'candidate'}" d="M205 ${yy} C320 ${yy} 400 ${ry} 515 ${ry}" stroke="${c}" stroke-width="${p.rejected?2.5:2}" fill="none"/>`;
      if(p.rejected)out+=`<circle cx="360" cy="${(yy+ry)/2}" r="10" fill="#fff9ef"/><text x="360" y="${(yy+ry)/2+4}" text-anchor="middle" font-size="15" fill="#b86842">×</text>`;
    });
    [oq,or].forEach((arr,side)=>arr.forEach((p,i)=>{
      const drop=(side?result.droppedR:result.droppedQ).some(d=>d.id===p.id), matched=accepted.some(a=>(side?a.ri:a.qi)===p.id), x=side?515:205, yy=y(i,arr.length);
      const active=s.active&&(side?s.active.ri:s.active.qi)===p.id;
      const remaining=s.phase==='urge'?(side?s.remainingR:s.remainingQ):null;
      const dim=remaining&&!remaining.some(v=>v.id===p.id)&&!matched;
      out+=`<g opacity="${(drop||dim)?0.25:1}" class="appear"><circle cx="${x}" cy="${yy}" r="${active?11:8}" fill="${drop?'#f6f5ef':matched?'#567d50':'#fffefa'}" stroke="${drop?'#bcc3b6':active&&s.active.rejected?'#b86842':'#77966d'}" stroke-width="${active?2.5:1.5}"/>${matched?`<circle cx="${x}" cy="${yy}" r="2.6" fill="#fffefa"/>`:''}<text x="${side?x+23:x-23}" y="${yy+4}" text-anchor="${side?'start':'end'}" class="mono" font-size="13">${fmt(p.d,2)} <tspan fill="#889280" font-size="9">m</tspan></text><text x="${side?643:77}" y="${yy+4}" class="small" text-anchor="middle">${side?'B':'A'}${p.id+1}</text>${drop?`<line x1="${x-7}" y1="${yy+7}" x2="${x+7}" y2="${yy-7}" stroke="#8f9889"/>`:''}</g>`;
    }));
    if(s.active)out+=`<rect x="280" y="370" width="160" height="25" rx="3" fill="${s.active.rejected?'#f4e6dc':'#eaf0e3'}"/><text x="360" y="387" text-anchor="middle" font-size="10">A${s.active.qi+1} ↔ B${s.active.ri+1} · ${s.active.rejected?'REJECTED':'ACCEPTED'}</text>`;
    else out+=`<text x="360" y="388" text-anchor="middle" class="small">${s.phase==='done'?`${accepted.length} accepted pairs · ${result.droppedQ.length+result.droppedR.length} pruned before matching`:'Path lengths increase from top to bottom'}</text>`;
    return svg(out,'Path correspondence diagram, with measured lengths and current accepted or rejected links');
  }
  function patternDiagram(result,s) {
    let [i,j]=state.cell||[0,s.rows[0]];i=E.clamp(i,0,s.q.length-1);j=E.clamp(j,0,s.r.length-1);
    const d=s.details[i][j],values=[...d.qWindow,...d.rWindow],low=Math.min(0,...values),high=Math.max(0,...values),span=Math.max(high-low,.0001);
    const X=v=>120+(v-low)/span*485;
    let out=`<rect x="35" y="45" width="650" height="276" rx="5" fill="url(#dotgrid)"/><text x="360" y="30" text-anchor="middle" font-size="12">Compare the spacing around A${s.q[i].id+1} and B${s.r[j].id+1}</text><line x1="${X(0)}" y1="66" x2="${X(0)}" y2="298" stroke="#9cae91" stroke-dasharray="4 4"/><text x="${X(0)}" y="63" text-anchor="middle" class="small">center each path at zero</text>`;
    [d.qWindow,d.rWindow].forEach((window,row)=>{
      const y=row?248:141,c=row?'#678ba0':'#61824e';
      out+=`<text x="62" y="${y-9}" font-size="12">${row?'B'+(s.r[j].id+1):'A'+(s.q[i].id+1)}</text><text x="62" y="${y+8}" class="mono" font-size="9">${fmt(row?s.r[j].d:s.q[i].d,2)} m</text><line x1="116" y1="${y}" x2="610" y2="${y}" stroke="#a8b69e"/>`;
      const groups=[];window.forEach(v=>{const old=groups.find(g=>Math.abs(g.v-v)<1e-6);if(old)old.n++;else groups.push({v,n:1});});
      // Keep ticks at their true coordinates; spread labels and connect them with leaders.
      const gap=65, positions=groups.map(g=>X(g.v));
      for(let k=1;k<positions.length;k++)positions[k]=Math.max(positions[k],positions[k-1]+gap);
      if(positions.at(-1)>620){positions[positions.length-1]=620;for(let k=positions.length-2;k>=0;k--)positions[k]=Math.min(positions[k],positions[k+1]-gap);}
      groups.forEach((g,k)=>{const label=fmt(g.v,span<.1?3:2)+(g.n>1?` ×${g.n}`:'');out+=`<line x1="${X(g.v)}" y1="${y-30}" x2="${X(g.v)}" y2="${y}" stroke="${c}" stroke-width="2"/><circle class="appear" cx="${X(g.v)}" cy="${y-30}" r="${Math.abs(g.v)<1e-6?6:4}" fill="${c}"/><path d="M${X(g.v)} ${y+3}L${positions[k]} ${y+14}" stroke="${c}" stroke-width=".6" opacity=".55"/><text class="pattern-value mono" x="${positions[k]}" y="${y+27}" text-anchor="middle" font-size="11">${label}</text>`;});
      out+=`<path d="M${X(window[0])} ${y-48}v-6H${X(window.at(-1))}v6" fill="none" stroke="${c}" stroke-width="1.3"/><text x="${(X(window[0])+X(window.at(-1)))/2}" y="${y-61}" text-anchor="middle" class="mono" font-size="10">outer gap ${fmt(window.at(-1)-window[0],2)} m</text>`;
    });
    out+=`<text x="360" y="307" text-anchor="middle" class="small">Relative path length (m) · repeated boundary padding is grouped as ×n</text><rect x="55" y="337" width="610" height="49" rx="4" fill="#edf1e7"/><text x="80" y="358" font-size="9">ABSOLUTE DIFFERENCE</text><text x="80" y="375" class="mono" font-size="12">${fmt(d.abs)} m</text><text x="290" y="358" font-size="9">PATTERN DIFFERENCE</text><text x="290" y="375" class="mono" font-size="12">${fmt(d.pattern)} m</text><text x="510" y="358" font-size="9">COMBINED COST</text><text x="510" y="375" class="mono" font-size="12">${fmt(d.cost)}</text>`;
    return svg(out,'Actual relative neighborhood spacings for the selected candidate pair, with absolute difference, pattern difference and combined cost');
  }
  function transform(extended=false) {
    const bounds=extended?[-2.6,15.7,-2.2,11.7]:[-.5,8.5,-.3,6.3];
    const scale=Math.min(630/(bounds[1]-bounds[0]),335/(bounds[3]-bounds[2]));
    const ox=360-(bounds[0]+bounds[1])/2*scale, oy=199+(bounds[2]+bounds[3])/2*scale;
    return {x:v=>ox+v*scale,y:v=>oy-v*scale,s:scale,bounds};
  }
  function pointMark(t,p,{color='#34694d',label='',type='dot',size=6,extra='',move=null,labelDx=10,labelDy=-10,anchor='start'}={}) {
    const x=t.x(p[0]),y=t.y(p[1]);
    const motion=move?`class="move-point" style="--dx:${t.x(move[0])-x}px;--dy:${t.y(move[1])-y}px"`:'';
    return `<g pointer-events="none" ${motion} ${extra}>${type==='cross'?`<path d="M${x-5} ${y-5}l10 10m-10 0l10-10" stroke="${color}" stroke-width="2"/>`:`<circle cx="${x}" cy="${y}" r="${size}" fill="${type==='hollow'?'#fffefa':color}" stroke="${color}" stroke-width="2"/>`}${label?`<text x="${x+labelDx}" y="${y+labelDy}" text-anchor="${anchor}" font-size="10" style="fill:${color};paint-order:stroke;stroke:#fffefa;stroke-width:3;stroke-linejoin:round">${esc(label)}</text>`:''}</g>`;
  }
  function visibilityStats(source=state.source){
    const values=run.fs.map(f=>f.intensities[source]),low=E.argmin(values),high=E.argmin(values.map(v=>-v));
    return {values,low,high,min:values[low],max:values[high],spread:values[high]-values[low]};
  }
  function visibilityDiagram(){
    const stats=visibilityStats(),idx=state.selectedCandidate??run.mode,p=run.points[idx],value=stats.values[idx];
    const X=x=>54+x*40,Y=y=>316-y*40;
    const alternatives=LAB_DATA.model.anchors.map((_,j)=>visibilityStats(j).spread),contrast=E.argmin(alternatives.map(v=>-v));
    let out=`<rect x="35" y="57" width="365" height="280" rx="4" fill="url(#dotgrid)"/><text x="54" y="28" font-size="19">Expected echoes from source ${state.source+1}</text><text x="54" y="49" font-size="13" fill="#637067">Each cell is a possible receiver position.</text><rect x="54" y="76" width="320" height="240" fill="#f8faf3" stroke="#a6b39c" stroke-width="1.5"/>`;
    for(let x=0;x<=8;x+=2)out+=`<text x="${X(x)}" y="335" text-anchor="middle" font-size="12">${x}</text>`;
    for(let y=0;y<=6;y+=2)out+=`<text x="43" y="${Y(y)+4}" text-anchor="end" font-size="12">${y}</text>`;
    out+='<g data-key="heatmap" role="group" aria-label="Expected source counts across receiver positions. Tab to a cell, then use the arrow keys.">';
    stats.values.forEach((v,i)=>{const q=run.points[i],a=v/1.8,label=`Candidate ${xy(q)} metres; source ${state.source+1} expected count ${fmt(v)}`;out+=`<rect class="heat-cell diagram-link" role="button" tabindex="${i===idx?0:-1}" aria-pressed="${i===idx}" aria-label="${label}" data-candidate="${i}" x="${X(q[0]-.125)}" y="${Y(q[1]+.125)}" width="10.3" height="10.3" fill="rgb(${Math.round(243-a*167)},${Math.round(246-a*129)},${Math.round(232-a*162)})"><title>${label}</title></rect>`;});
    out+=`</g><rect data-key="selection" x="${X(p[0]-.15)}" y="${Y(p[1]+.15)}" width="12" height="12" class="selected-halo"/><path pointer-events="none" d="M${X(p[0])} ${Y(p[1])}H403V143H431" fill="none" stroke="#b86842" stroke-width="1.2" stroke-dasharray="3 3"/><text x="374" y="354" text-anchor="end" font-size="12">receiver x (m)</text><text x="39" y="68" font-size="12">y (m)</text><text x="54" y="378" font-size="13">Darker green = more expected echo peaks.</text>`;
    out+=`<g pointer-events="none" data-key="visibility-reading"><rect x="432" y="83" width="245" height="211" rx="6" fill="#f2f5ed" stroke="#d7e0ce"/><text x="448" y="108" font-size="12" style="fill:#a25b37">INSPECTED CELL ${xy(p)} m</text><text id="visibilityValue" x="448" y="158" class="mono" font-size="40">${fmt(value)}</text><text x="448" y="181" font-size="13">expected peaks from this source</text><line x1="448" x2="661" y1="197" y2="197" stroke="#d7e0ce"/><text x="448" y="219" font-size="13">${value>=.95&&value<=1.05?'About one echo per observation.':`About ${fmt(value,2)} echoes per observation.`}</text><text x="448" y="239" font-size="12">Before the 75% adjustment in step 10.</text><text x="448" y="276" font-size="12">Receiver location is inferred later.</text><text x="432" y="323" font-size="15">Room range: <tspan class="mono">${fmt(stats.min)}–${fmt(stats.max)}</tspan></text><text x="432" y="348" font-size="13">${stats.spread<.15?'Similar counts throughout the room.':'This source contributes less in some areas.'}</text><text x="432" y="371" font-size="12">${stats.spread<.15?`Compare source ${contrast+1} for more variation.`:'Use Low count / High count to compare.'}</text></g>`;
    return svg(out,`Source ${state.source+1} expected peak counts across possible receiver positions. Selected cell ${xy(p)} has count ${fmt(value)}. This is a learned source-count map; receiver inference comes later.`).replace('role="img"','role="group"');
  }
  function roomDiagram(s) {
    if(state.lesson==='sapp'&&s.mode==='visibility')return visibilityDiagram();
    const smart=state.lesson==='smart', sapp=state.lesson==='sapp';
    const extended=smart||(sapp&&s.mode==='discover'),t=transform(extended);
    let out=`<rect x="35" y="20" width="650" height="355" fill="url(#dotgrid)"/>`;
    out+=`<rect x="${t.x(0)}" y="${t.y(6)}" width="${8*t.s}" height="${6*t.s}" fill="#f8faf3" stroke="#a6b39c" stroke-width="1.7"/>`;
    for(let x=0;x<=8;x+=2)out+=`<line x1="${t.x(x)}" y1="${t.y(0)}" x2="${t.x(x)}" y2="${t.y(6)}" stroke="#dce4d6" stroke-width=".6"/><text x="${t.x(x)}" y="${t.y(0)+17}" text-anchor="middle" class="axis-label">${x}</text>`;
    for(let y=0;y<=6;y+=2)out+=`<line x1="${t.x(0)}" y1="${t.y(y)}" x2="${t.x(8)}" y2="${t.y(y)}" stroke="#dce4d6" stroke-width=".6"/><text x="${t.x(0)-12}" y="${t.y(y)+3}" text-anchor="end" class="axis-label">${y}</text>`;
    out+=`<text x="${t.x(8)+10}" y="${t.y(0)+17}" class="axis-label">m</text>`;
    if(state.lesson==='map') {
      const done=s.mode==='rank'||s.mode==='weight'||s.mode==='final';
      refs.forEach((ref,i)=>{
        const r=run.ranked.find(v=>v.id===i), scored=s.ref!==undefined&&i<=s.ref, chosen=done&&r.weight>0, active=i===s.ref;
        if((s.mode==='weight'||s.mode==='final')&&chosen)out+=`<line class="edge" x1="${t.x(ref.xy[0])}" y1="${t.y(ref.xy[1])}" x2="${t.x(run.estimate[0])}" y2="${t.y(run.estimate[1])}" stroke="#608259" stroke-width="${1+5*r.weight}" opacity=".6"/>`;
        out+=`<g class="diagram-link" role="button" tabindex="0" data-ref="${i}" aria-label="Inspect reference ${ref.label}"><circle cx="${t.x(ref.xy[0])}" cy="${t.y(ref.xy[1])}" r="${chosen?11+14*r.weight:active?14:10}" fill="${chosen?'#d8e7cd':active?'#e6eddc':scored?'#ebf0e4':'#fffefa'}" stroke="${active||chosen?'#4d7650':'#aab99c'}" stroke-width="${active?2:1}"/><text x="${t.x(ref.xy[0])}" y="${t.y(ref.xy[1])+3}" text-anchor="middle" font-size="8">${ref.label}</text><text x="${t.x(ref.xy[0])+16}" y="${t.y(ref.xy[1])-10}" class="mono" font-size="9">${chosen?`${fmt(r.weight*100,1)}%`:scored?fmt(r.score,2):''}</text></g>`;
      });
      if(state.selectedRef!==null){const r=refs[state.selectedRef],v=run.ranked.find(r=>r.id===state.selectedRef);out+=`<circle data-key="selected-reference" class="selected-halo" cx="${t.x(r.xy[0])}" cy="${t.y(r.xy[1])}" r="${Math.max(19,15+14*v.weight)}"/>`;}
      if(s.mode==='weight'||s.mode==='final') out+=pointMark(t,run.estimate,{label:'estimate',type:'hollow',size:8});
    } else if(smart) {
      const r=run.rounds[s.round||0];
      if(s.mode==='predict')LAB_DATA.sources.forEach((a,i)=>{out+=`<line class="candidate" x1="${t.x(s.position[0])}" y1="${t.y(s.position[1])}" x2="${t.x(a[0])}" y2="${t.y(a[1])}" stroke="${colors[i]}" stroke-width="1.3"/>`;});
      if(['associate','solve','final'].includes(s.mode)&&!r.stopped){
        r.association.matches.forEach(m=>{const a=LAB_DATA.sources[m.ri],c=colors[m.ri];out+=`<g clip-path="url(#plotClip)"><circle class="ring" cx="${t.x(a[0])}" cy="${t.y(a[1])}" r="${m.q*t.s}" fill="none" stroke="${c}" stroke-width="1.5" opacity=".75"/></g>`;});
        const path=run.rounds.slice(0,(s.round||0)+1).flatMap((round,idx)=>[round.initial,...(round.fit?.history||[]).filter((_,j)=>idx<(s.round||0)||s.inner===undefined||j<=s.inner).map(h=>h.to)]);
        out+=`<path class="trajectory" d="${path.map((p,i)=>`${i?'L':'M'}${t.x(p[0])} ${t.y(p[1])}`).join(' ')}" fill="none" stroke="#344e39" stroke-width="2" stroke-dasharray="3 3"/>`;
      }
      LAB_DATA.sources.forEach((a,i)=>{out+=pointMark(t,a,{color:colors[i],size:5,label:i?'VT '+i:'AP'});});
      out+=pointMark(t,state.initial,{color:'#7f8577',size:4,label:'start',type:'hollow',labelDx:-11,labelDy:16,anchor:'end'});
      out+=pointMark(t,s.position||state.initial,{label:'estimate',size:7,type:'hollow',move:s.from});
    } else if(sapp) {
      if(['visibility','evidence','posterior','final'].includes(s.mode)) {
        let weights;
        if(s.mode==='visibility')weights=run.fs.map(f=>f.intensities[state.source]);
        else {const scores=run.scores.map(p=>p.penalty+E.sum(p.lambda.slice(0,s.used??run.query.length).map(Math.log))), max=Math.max(...scores);weights=scores.map(p=>Math.exp(p-max));}
        out+='<g data-key="heatmap" role="group" aria-label="Candidate map. Tab to a candidate, use arrow keys to inspect adjacent positions.">';
        weights.forEach((w,i)=>{const p=run.points[i],a=s.mode==='visibility'?w/1.8:Math.pow(w,.28),label=`Candidate ${xy(p)} metres; ${s.mode==='visibility'?'source count '+fmt(w):'relative likelihood '+fmt(w,6)}`;out+=`<rect class="heat-cell diagram-link" role="button" tabindex="${i===(state.selectedCandidate??run.mode)?0:-1}" aria-label="${label}" aria-pressed="${i===state.selectedCandidate}" data-candidate="${i}" x="${t.x(p[0]-.125)}" y="${t.y(p[1]+.125)}" width="${t.s*.25+.3}" height="${t.s*.25+.3}" fill="rgb(${Math.round(243-a*167)},${Math.round(246-a*129)},${Math.round(232-a*162)})"><title>${label}</title></rect>`;});
        out+='</g>';
        const idx=state.selectedCandidate??run.mode,p=run.points[idx];out+=`<rect data-key="selection" x="${t.x(p[0]-.15)}" y="${t.y(p[1]+.15)}" width="${.3*t.s}" height="${.3*t.s}" class="selected-halo"/>`;
      } else {
        LAB_DATA.survey.forEach((p,i)=>{out+=pointMark(t,p,{color:'#95ab80',size:3.5,label:s.mode==='survey'&&[0,6,28,34].includes(i)?`S${i+1}`:''});});
      }
      if(s.mode==='discover') {
        const a=LAB_DATA.model.anchors[s.source];
        LAB_DATA.survey.forEach((p,i)=>{const predicted=E.dist(p,a),nearest=Math.min(...LAB_DATA.sets[i].map(d=>Math.abs(d-predicted)));out+=`<line class="edge" x1="${t.x(a[0])}" y1="${t.y(a[1])}" x2="${t.x(p[0])}" y2="${t.y(p[1])}" stroke="${nearest<=.18?'#729467':'#ba805b'}" opacity=".25"/>`;});
        out+=pointMark(t,a,{label:`source ${s.source+1}`,color:colors[s.source],size:8});
      }
      if(s.mode==='final') {out+=pointMark(t,run.points[run.mode],{type:'cross',label:'mode',color:'#6f7898',labelDx:-14,labelDy:-13,anchor:'end'});out+=pointMark(t,run.estimate,{type:'hollow',label:'geometric median',size:8,labelDx:13,labelDy:24});}
    }
    if(state.showTruth&&(!sapp||['evidence','posterior','final'].includes(s.mode)))out+=pointMark(t,state.point,{type:'cross',color:'#b86842',label:'receiver truth',labelDx:state.lesson==='map'?-12:12,labelDy:state.lesson==='map'?-10:sapp?-26:26,anchor:state.lesson==='map'?'end':'start'});
    if(!extended)out+=`<text x="${t.x(0)}" y="22" class="small">8 × 6 m teaching room</text>`;
    else out+=`<text x="45" y="392" class="small">Unfolded source geometry · axes in metres · wall reflections represented by image sources</text>`;
    return svg(out,'Geometric view of the current algorithm step. Candidate and reference details are available in the numerical inspector.').replace('role="img"','role="group"');
  }
  function densityDiagram(s) {
    const idx=state.selectedCandidate??run.mode, f=run.fs[idx], d=LAB_DATA, samples=[];
    const adjustment=s.mode==='background'?1:.75;
    for(let x=0;x<=25;x+=.08){const v=E.scorePoint([x],f,d);samples.push({x,source:adjustment*v.source[0],bg:adjustment*v.background[0],total:s.mode==='background'?v.source[0]+v.background[0]:v.lambda[0]});}
    const max=Math.max(...samples.map(v=>v.total))*1.12, X=x=>55+x/25*615,Y=y=>325-y/max*255;
    const path=key=>samples.map((v,i)=>`${i?'L':'M'}${X(v.x)} ${Y(v[key])}`).join(' ');
    let out=`<rect x="45" y="30" width="635" height="305" fill="url(#dotgrid)"/><line x1="55" y1="325" x2="670" y2="325" stroke="#a9b59f"/><path d="${path('source')} L670 325 L55 325Z" fill="#d9e7cc" opacity=".7"/><path class="edge" d="${path('source')}" stroke="#678755" stroke-width="1.6"/><path d="${path('bg')} L670 325 L55 325Z" fill="#e9cbb5" opacity=".6"/><path class="edge" d="${path('bg')}" stroke="#b8784a" stroke-width="1.6"/>`;
    if(s.mode!=='background')out+=`<path class="edge" d="${path('total')}" stroke="#2e4f3c" stroke-width="2"/><line x1="55" y1="${Y(.08)}" x2="670" y2="${Y(.08)}" stroke="#648aa1" stroke-dasharray="4 4"/>`;
    const peakLabels=(s.mode==='background'?[]:run.query).map((v,i)=>({v,i,x:X(v)})).sort((a,b)=>a.v-b.v);
    for(let i=1;i<peakLabels.length;i++)peakLabels[i].x=Math.max(peakLabels[i].x,peakLabels[i-1].x+42);
    if(peakLabels.at(-1)?.x>660){peakLabels.at(-1).x=660;for(let i=peakLabels.length-2;i>=0;i--)peakLabels[i].x=Math.min(peakLabels[i].x,peakLabels[i+1].x-42);}
    peakLabels.forEach(({v,x})=>{out+=`<line class="candidate" x1="${X(v)}" x2="${X(v)}" y1="60" y2="337" stroke="#9da38d" stroke-width=".8"/><circle cx="${X(v)}" cy="325" r="4" fill="#b86842"/><path d="M${X(v)} 337L${x} 344" stroke="#b86842" stroke-width=".6"/><text x="${x}" y="357" text-anchor="middle" class="density-peak mono" font-size="10">${fmt(v,2)}</text>`;});
    for(let y=0;y<=4;y++){const v=max*y/4;out+=`<line x1="55" x2="670" y1="${Y(v)}" y2="${Y(v)}" stroke="#aab99c" opacity=".3"/><text class="density-tick mono" x="48" y="${Y(v)+4}" text-anchor="end" font-size="10">${fmt(v,2)}</text>`;}
    for(let x=0;x<=25;x+=5)out+=`<text x="${X(x)}" y="375" text-anchor="middle" class="axis-label">${x}</text>`;
    out+=`<text x="55" y="28" font-size="11">Delay intensity at candidate ${xy(f.point)} m</text><text x="670" y="397" text-anchor="end" class="small">path length (m)</text><text x="18" y="190" transform="rotate(-90 18 190)" text-anchor="middle" class="small">expected peaks per metre</text>`;
    return svg(out,s.mode==='background'?'Learned source and unexplained-echo curves before the adjustment for missed peaks.':'Delay intensity curve: learned sources, unexplained survey echoes, extra peaks and new measured peak locations.');
  }
  const range = (id,label,value,min,max,step,unit='') => `<label class="control" for="${id}"><span class="control-title"><span>${label}</span><output for="${id}">${fmt(value,step<1?2:0)}${unit}</output></span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}"></label>`;
  function renderControls() {
    let content;
    if(state.lesson==='mpurge') {
      content=`<div class="control-grid"><label class="control" for="queryInput"><span class="control-title">Fingerprint A · metres</span><textarea id="queryInput" spellcheck="false">${state.q.join(', ')}</textarea></label><label class="control" for="referenceInput"><span class="control-title">Fingerprint B · metres</span><textarea id="referenceInput" spellcheck="false">${state.r.join(', ')}</textarea></label>${range('alpha','Absolute-distance weight α',state.alpha,0,1,.05)}<label class="control" for="preset"><span>Example</span><select id="preset"><option value="default">Ambiguous neighbors + an extra path</option><option value="clean">Clean correspondence</option><option value="ties">Equal delays / stable tie breaking</option></select></label></div><div class="apply-row"><button class="apply-button" id="applyPaths">Apply path lengths ↗</button><span>1–12 values per set · comma or space separated</span></div>`;
      $('experimentNote').textContent='Half-window p = 2 (five local values). Changing α reruns matching. Edited path lists take effect when you select Apply.';
    } else {
      content=`<div class="control-grid">${range('receiverX','Receiver x',state.point[0],.5,7.5,.1,' m')}${range('receiverY','Receiver y',state.point[1],.5,5.5,.1,' m')}${range('noise','Path perturbation amplitude',state.noise,0,.8,.02,' m')}<label class="control" for="clutter"><span>Extra query peaks</span><select id="clutter"><option value="0" ${state.clutter===0?'selected':''}>None</option><option value="1" ${state.clutter===1?'selected':''}>One · 9.30 m</option><option value="2" ${state.clutter===2?'selected':''}>Two · 9.30 and 16.20 m</option></select></label>`;
      if(state.lesson==='map')content+=range('neighbors','Neighbors k',state.k,1,5,1);
      if(state.lesson==='smart')content+=range('initialX','Initial guess x',state.initial[0],.5,7.5,.1,' m')+range('initialY','Initial guess y',state.initial[1],.5,5.5,.1,' m');
      if(state.lesson==='sapp')content+=range('scale','Query kernel scale σ',state.scale,.06,.6,.02,' m');
      content+=`<div class="control"><label class="check-row"><input id="missing" type="checkbox" ${state.missing?'checked':''}>Remove the west-reflection path</label><label class="check-row"><input id="truth" type="checkbox" ${state.showTruth?'checked':''}>Show receiver truth for comparison</label></div></div>`;
      $('experimentNote').textContent=state.lesson==='sapp'?'Survey training stays fixed. Moving the receiver generates a new query; every candidate score and the geometric median are recalculated.':'The receiver controls generate the observations. The estimators receive the path lengths, not the true receiver coordinates. Perturbations are deterministic for reproducible runs.';
    }
    $('controls').innerHTML=content;
    $('inputError').textContent='';
  }
  function renderAll() {
    const m=meta[state.lesson];
    $('eyebrow').textContent=`EXPERIMENT ${m.n} / ${m.eyebrow}`;
    $('title').textContent=m.title; $('subtitle').textContent=m.subtitle; $('chapterIndex').textContent=m.n;
    $('breadcrumb').textContent=m.breadcrumb; $('inputSummary').textContent=m.input;
    $('takeawayTitle').textContent=m.takeaway; $('takeawayText').textContent=m.take; $('challenge').textContent=m.challenge;
    $('challengeResult').textContent='';
    const sapp=state.lesson==='sapp';$('methodMap').hidden=!sapp;$('teachingTag').hidden=sapp;$('sappOverview').hidden=!sapp;
    document.querySelectorAll('[data-lesson]').forEach(a=>{const current=a.dataset.lesson===state.lesson;a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    document.title=`${state.lesson==='mpurge'?'MPUrge':state.lesson==='map'?'MPUrge-MAP':state.lesson==='smart'?'SMART-LEA':'SAPP'} — Multipath Atelier`;
    renderControls(); renderStep();
  }
  function renderStep() {
    const s=steps[state.t],m=meta[state.lesson];
    preserveFocus($('phases'),()=>{$('phases').innerHTML=m.phases.map((p,i)=>`<button class="phase ${i===s.phase?'active':i<s.phase?'complete':''}" data-phase="${i}" ${i===s.phase?'aria-current="step"':''}><span class="phase-dot">${i<s.phase?'✓':i+1}</span>${p}</button>`).join('');});
    document.querySelector('.explanation').scrollTop=0;
    $('phaseName').textContent=m.phases[s.phase].toUpperCase(); $('stepCounter').textContent=`${String(state.t+1).padStart(2,'0')} / ${steps.length}`;
    renderExplanation(s);
    if(state.lesson==='sapp')preserveFocus($('sappOverview'),()=>{$('sappOverview').innerHTML=methodOverview();});
    $('prediction').innerHTML=s.quiz?`<p><b>Pause & predict.</b> ${esc(s.quiz[0])}</p><button data-answer="correct">${esc(s.quiz[1])}</button><button data-answer="wrong">${esc(s.quiz[2])}</button><div class="answer" id="answerText"></div>`:'';
    renderLegend(s);
    $('sceneTitle').textContent=s.scene==='match'?'THE CORRESPONDENCE CANVAS':s.scene==='density'?'THE DELAY LANDSCAPE':state.lesson==='sapp'?(s.mode==='visibility'?'SOURCE VISIBILITY':s.mode==='responsibility'?'SHARING A SURVEY PEAK':'THE EVIDENCE LANDSCAPE'):state.lesson==='smart'?'THE UNFOLDED ROOM':'THE FINGERPRINT MAP';
    $('sceneMeta').textContent=s.scene==='match'?`${run.originalQ.length} × ${run.originalR.length} paths`:state.lesson==='sapp'?`${LAB_DATA.survey.length} survey points`:state.lesson==='map'?'12 reference points':'5 known sources';
    $('sceneHint').textContent=state.lesson==='map'?'Select a reference to inspect':state.lesson==='sapp'&&['visibility','evidence','posterior','final'].includes(s.mode)?'Click a cell · or Tab, then arrow keys':s.scene==='match'?(s.matchState.phase==='cost'?'Ticks show actual relative distances':'Length order, not physical space'):'Coordinates and path lengths in metres';
    renderScene();
    $('previous').disabled=state.t===0; $('next').disabled=state.t===steps.length-1;
    $('timeline').max=steps.length-1; $('timeline').value=state.t; $('timeline').setAttribute('aria-valuetext',`Step ${state.t+1}: ${s.title}`);
    $('timelineLabel').textContent=`${state.t+1} / ${steps.length}`;
    updatePlay(); if($('inspector').open)renderNumerical();
  }
  function renderExplanation(s) {
    let worked='';
    if(state.lesson==='sapp'&&s.mode==='responsibility'){
      const {peak}=trainingSelection(),ranked=peak.shares.slice(0,-1).map((v,j)=>({v,j})).sort((a,b)=>b.v-a.v),a=ranked[0],b=ranked[1];
      worked=`<div class="worked-example"><b>Follow the selected peak</b><p>At S${state.trainingRow+1}, peak ${state.trainingPeak+1} (${fmt(peak.d)} m) contributes ${fmt(a.v,3)} to Source ${a.j+1} and ${fmt(b.v,3)} to Source ${b.j+1}. The unexplained fraction is ${fmt(peak.shares.at(-1),3)}. All six fractions, including the other sources, add to 1.</p></div>`;
    }
    if(state.lesson==='sapp'&&s.mode==='density'){
      const i=state.selectedCandidate??run.mode,sc=run.scores[i];
      worked=`<div class="worked-example"><b>A number from this curve</b><p>At candidate ${xy(run.points[i])} m and the first measured length, ${fmt(run.query[0])} m:</p><div class="mono">(${fmt(sc.source[0],4)} sources<br>+ ${fmt(sc.background[0],4)} unexplained)<br>× 0.75 + 0.08<br>= ${fmt(sc.lambda[0],4)} peaks / metre</div><p>This is a curve height. The next steps use these heights and the area under the curve to score a position.</p></div>`;
    }
    const refNames={discover:'Learn source positions',responsibility:'Share each survey peak',visibility:'Learn source counts',background:'Learn the unexplained-echo curve'};
    $('explanationContent').innerHTML=`<h2>${esc(s.title)}</h2><p>${esc(s.text)}</p>${worked}${s.explain?`<ol class="step-detail">${s.explain.map(v=>`<li>${esc(v)}</li>`).join('')}</ol>`:''}${s.refs?`<div class="step-references"><span>BUILT FROM</span>${s.refs.map(v=>stepLink(v,refNames[v])).join('')}</div>`:''}<div class="equation-block"><div class="formula">${esc(s.formula).replace(/\n/g,'<br>')}</div>${state.lesson==='sapp'?symbolKey(s):''}</div><p class="reason">${esc(s.why)}</p>${state.lesson==='sapp'?'<button class="text-button open-method-map">See the complete SAPP method ↗</button>':''}`;
    requestAnimationFrame(updateExplanationHint);
  }
  function updateExplanationHint(){const panel=document.querySelector('.explanation'),hint=$('explanationScrollHint');hint.hidden=state.lesson!=='sapp'||panel.scrollHeight-panel.clientHeight<20||panel.scrollHeight-panel.clientHeight-panel.scrollTop<20;hint.style.width=panel.clientWidth+'px';}
  function renderLegend(s){
    const dot=(name,cls='')=>`<span><i class="${cls}"></i>${name}</span>`;
    let html='';
    if(state.lesson==='mpurge')html=s.matchState.phase==='cost'?dot('Neighborhood A')+dot('Neighborhood B','blue'):dot('Accepted')+dot('Proposed','blue')+dot('Rejected','amber');
    else if(state.lesson==='map')html=dot('Survey point','hollow')+dot('Estimate')+dot('Truth','amber');
    else if(state.lesson==='smart')html=dot('Estimate','hollow')+dot('Source / range circle','blue')+dot('Truth','amber');
    else if(s.scene==='density')html=s.mode==='background'?dot('Learned sources')+dot('Unexplained survey echoes','amber'):dot('Sources × 0.75')+dot('Unexplained × 0.75','amber')+dot('Extra peaks = 0.08','blue')+dot('Total intensity','total');
    else if(s.mode==='responsibility')html='<span>One peak’s shares sum to 1</span><span>Column totals give expected counts</span>';
    else if(['visibility','evidence','posterior','final'].includes(s.mode)){
      const visibility=s.mode==='visibility',labels=visibility?['0','0.45','0.90','1.35','1.80']:['0','0.007','0.084','0.358','1'];
      html=`<div class="color-key"><span>${visibility?'Expected source peaks · fixed scale':'Relative likelihood · best in this frame = 1'}</span><div class="color-ramp"></div><div class="color-ticks">${labels.map(v=>`<b>${v}</b>`).join('')}</div></div>`;
      if(!visibility)html+='<span class="scale-note">Shading is not posterior mass. Inspect a cell for its weight.</span>';
    }else html=dot('Survey position')+(s.mode==='discover'?dot('Fitted source','blue'):'');
    $('legend').innerHTML=html;
  }
  // Preserve DOM identity for retained edges and heatmap cells so updates can animate smoothly.
  function nodeKey(n){if(n.nodeType!==1)return null;for(const name of ['data-key','data-ref','data-candidate'])if(n.hasAttribute(name))return name+':'+n.getAttribute(name);if(n.matches('.edge,.candidate,.ring,.appear'))return n.tagName+':'+(n.getAttribute('d')||[n.getAttribute('cx'),n.getAttribute('cy'),n.getAttribute('x1'),n.getAttribute('y1'),n.getAttribute('x2'),n.getAttribute('y2'),n.getAttribute('r'),n.textContent].join(':'));return null;}
  function reconcile(current,next){
    if(current.nodeType!==next.nodeType||current.nodeName!==next.nodeName){current.replaceWith(next);return;}
    if(current.nodeType===3){if(current.nodeValue!==next.nodeValue)current.nodeValue=next.nodeValue;return;}
    if(current.nodeType!==1)return;
    for(const a of [...current.attributes])if(!next.hasAttribute(a.name))current.removeAttribute(a.name);
    for(const a of [...next.attributes])if(current.getAttribute(a.name)!==a.value)current.setAttribute(a.name,a.value);
    const old=[...current.childNodes],incoming=[...next.childNodes],keyed=new Map(old.map(n=>[nodeKey(n),n]).filter(([k])=>k)),used=new Set();
    incoming.forEach((n,i)=>{const key=nodeKey(n),candidate=key?keyed.get(key):old[i];let retained=candidate&&!used.has(candidate)&&(!nodeKey(candidate)||key===nodeKey(candidate))&&candidate.nodeName===n.nodeName?candidate:null;if(retained){used.add(retained);reconcile(retained,n);}else retained=n;const at=current.childNodes[i];if(at!==retained)current.insertBefore(retained,at||null);});
    while(current.childNodes.length>incoming.length)current.lastChild.remove();
  }
  function preserveFocus(container,update){
    const el=document.activeElement,inside=container.contains(el);let selector;
    if(inside){if(el.id)selector='#'+CSS.escape(el.id);else for(const key of ['cell','ref','candidate','phase','source','sourcepoint'])if(el.dataset[key]!==undefined){selector=`[data-${key}="${el.dataset[key]}"]`;break;}}
    update();if(selector){const target=container.querySelector(selector);if(target&&!target.disabled)target.focus({preventScroll:true});}
  }
  function renderSelection(s){
    let text='';
    if(state.lesson==='map'&&state.selectedRef!==null){const r=run.ranked.find(r=>r.id===state.selectedRef);text=`Inspecting ${r.label} ${xy(r.xy)} m · ${r.count} pairs · score ${fmt(r.score)} · weight ${fmt(r.weight*100,1)}%`;}
    if(state.lesson==='sapp'&&['visibility','evidence','posterior','final','density','background'].includes(s.mode)){const i=state.selectedCandidate??run.mode;let value;if(s.mode==='visibility')value=`source ${state.source+1} count ${fmt(run.fs[i].intensities[state.source])}`;else if(['density','background'].includes(s.mode))value=s.mode==='background'?'learned curves, before missed echoes':'expected total '+fmt(run.scores[i].expectedCount)+' peaks';else{const scores=run.scores.map(v=>v.penalty+E.sum(v.lambda.slice(0,s.used??run.query.length).map(Math.log))),max=Math.max(...scores),mass=Math.exp(scores[i]-max)/E.sum(scores.map(v=>Math.exp(v-max)));value=`grid mass ${fmt(mass*100,4)}%${s.mode==='evidence'?' · evidence so far':''}`;}text=`Inspecting ${xy(run.points[i])} m · ${value}`;}
    $('selectionSummary').innerHTML=text?`<span>${esc(text)}</span><button id="jumpToNumbers" class="text-button">Inspect numbers ↓</button>`:'';
  }
  function renderScene(){
    const s=steps[state.t],scene=$('scene'),markup=s.scene==='match'?(s.matchState.phase==='cost'?patternDiagram(run,s.matchState):matchDiagram(run,s.matchState)):s.scene==='density'?densityDiagram(s):s.mode==='responsibility'?responsibilityDiagram():roomDiagram(s),template=document.createElement('template');template.innerHTML=markup;
    scene.classList.toggle('static-frame',!state.playing);
    preserveFocus(scene,()=>{if(scene.firstElementChild)reconcile(scene.firstElementChild,template.content.firstElementChild);else scene.append(template.content);});renderSelection(s);
    const visibility=state.lesson==='sapp'&&s.mode==='visibility',responsibility=state.lesson==='sapp'&&s.mode==='responsibility';$('sceneTools').hidden=!(visibility||responsibility);$('sceneMeta').hidden=visibility||responsibility;
    preserveFocus($('sceneTools'),()=>{$('sceneTools').innerHTML=visibility?`<span>Source</span>${LAB_DATA.model.anchors.map((_,j)=>`<button data-source="${j}" aria-label="Show source ${j+1}" aria-pressed="${j===state.source}">${j+1}</button>`).join('')}<button data-sourcepoint="low" class="count-jump">Low count</button><button data-sourcepoint="high" class="count-jump">High count</button>`:responsibility?`<label>Survey <select id="trainingRow" aria-label="Survey position for responsibility example">${LAB_DATA.survey.map((_,i)=>`<option value="${i}" ${i===state.trainingRow?'selected':''}>S${i+1}</option>`).join('')}</select></label><label>Peak <select id="trainingPeak" aria-label="Measured survey peak">${LAB_DATA.sets[state.trainingRow].map((d,i)=>`<option value="${i}" ${i===state.trainingPeak?'selected':''}>${i+1} · ${fmt(d,2)} m</option>`).join('')}</select></label><label>Pass <select id="trainingPass" aria-label="Training count update pass">${training.passes.map((_,i)=>`<option value="${i}" ${i===state.trainingPass?'selected':''}>${i+1} / 4</option>`).join('')}</select></label>`:'';});
  }
  function pause(finish=false){state.playing=false;clearTimeout(state.timer);$('scene')?.getAnimations({subtree:true}).forEach(a=>{if(finish&&a.effect.getTiming().iterations!==Infinity)a.finish();else a.pause();});if($('play'))updatePlay();}
  function updatePlay(){$('play').innerHTML=state.playing?'<span aria-hidden="true">Ⅱ</span> Pause':state.t===steps?.length-1?'<span aria-hidden="true">↺</span> Replay':'<span aria-hidden="true">▶</span> Play';$('play').setAttribute('aria-label',state.playing?'Pause animation':state.t===steps?.length-1?'Replay animation':'Play animation');}
  function schedule(){clearTimeout(state.timer);if(!state.playing)return;state.timer=setTimeout(()=>{if(state.t<steps.length-1){state.t++;state.cell=null;renderStep();if(state.t===steps.length-1)pause(true);else schedule();}else pause();},state.speed);}
  function play(){if(state.playing){pause();return;}if(state.t===steps.length-1){state.t=0;renderStep();}state.playing=true;$('scene').classList.remove('static-frame');$('scene').getAnimations({subtree:true}).forEach(a=>a.play());updatePlay();schedule();}
  function goto(index){pause();state.t=E.clamp(index,0,steps.length-1);state.cell=null;renderStep();}
  function metric(value,label){return `<div class="metric"><strong>${value}</strong><small>${label}</small></div>`;}
  function pairsTable(matches){return `<div class="table-scroll"><table><thead><tr><th>A path</th><th>B path</th><th>A (m)</th><th>B (m)</th><th>Cost</th></tr></thead><tbody>${matches.map(p=>`<tr><td>A${p.qi+1}</td><td>B${p.ri+1}</td><td>${fmt(p.q)}</td><td>${fmt(p.r)}</td><td>${fmt(p.cost,5)}</td></tr>`).join('')}</tbody></table></div>`;}
  function matchInspector(result,s) {
    if(!s.costs) return `<div class="numbers-grid"><div><h3>${s.phase==='done'?'The accepted pairs':'Input preparation'}</h3><p>${s.phase==='done'?'Costs are retained from the round in which the pair was accepted.':'Original IDs stay attached when values are sorted. The longer set is reduced by a monotone minimum-L1 subset selection.'}</p>${s.phase==='done'?pairsTable(s.accepted):`<div class="code">A: ${result.originalQ.map(p=>`A${p.id+1}=${fmt(p.d)}`).join(', ')}\nB: ${result.originalR.map(p=>`B${p.id+1}=${fmt(p.d)}`).join(', ')}</div>`}</div><div><h3>Account for every path</h3><p>Pruned from A: ${result.droppedQ.map(p=>'A'+(p.id+1)).join(', ')||'none'}<br>Pruned from B: ${result.droppedR.map(p=>'B'+(p.id+1)).join(', ')||'none'}</p><p>Accepted: ${s.accepted.length}. ${s.phase==='done'?`Unmatched A: ${result.originalQ.filter(p=>!s.accepted.some(a=>a.qi===p.id)).map(p=>'A'+(p.id+1)).join(', ')||'none'}.`:''}</p><div class="code">p = ${result.opts.width}\nα = ${result.opts.alpha}\npattern normalized = ${result.opts.normalized}\nties: first minimum in sorted order</div></div></div>`;
    let [i,j]=state.cell||[s.active?.i??0,s.active?.j??s.rows[0]];
    i=E.clamp(i,0,s.q.length-1);j=E.clamp(j,0,s.r.length-1);
    const d=s.details[i][j],a=result.opts.alpha;
    return `<div class="numbers-grid"><div><h3>Round ${s.round} · dissimilarity matrix</h3><p>Rows are A, columns are B. Tinted cells are mutual minima. Select any cell for its arithmetic.</p><div class="table-scroll"><table class="cost-matrix"><thead><tr><th>δ (m)</th>${s.r.map(p=>`<th>B${p.id+1}<br>${fmt(p.d,2)}</th>`).join('')}</tr></thead><tbody>${s.q.map((p,ri)=>`<tr><th>A${p.id+1} · ${fmt(p.d,2)}</th>${s.r.map((r,cj)=>`<td class="${s.rows[ri]===cj&&s.cols[cj]===ri?'best':''} ${ri===i&&cj===j?'selected-cell':''}"><button data-cell="${ri},${cj}" aria-label="Inspect A${p.id+1} to B${r.id+1} cost ${fmt(s.costs[ri][cj])}">${fmt(s.costs[ri][cj])}</button></td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="scroll-hint">Values shown to 3 decimals; comparisons use full precision.</p></div><div><h3>A${s.q[i].id+1} ↔ B${s.r[j].id+1}</h3><div class="code">distance = |${fmt(s.q[i].d)} − ${fmt(s.r[j].d)}|\n         = ${fmt(d.abs,6)} m\npattern  = Σ |pairwise gaps A − B| / ${d.normalizer}\n         = ${fmt(d.pattern,6)} m\nδ = ${fmt(a,2)} × ${fmt(d.abs,6)}\n  + ${fmt(1-a,2)} × ${fmt(d.pattern,6)}\n  = ${fmt(d.cost,8)}</div><p>Centered neighborhood A:<br><span class="mono">[${d.qWindow.map(v=>fmt(v,3)).join(', ')}]</span></p><p>Centered neighborhood B:<br><span class="mono">[${d.rWindow.map(v=>fmt(v,3)).join(', ')}]</span></p><p>${d.terms.length} upper-triangle gap comparisons. Boundary values use tiny ordered padding; displayed zeroes can be nonzero at machine precision.</p><span class="pill">${s.rows[i]===j&&s.cols[j]===i?'Mutual minimum':'Not a mutual minimum'}</span></div></div>${s.active?`<p class="debug-note">${s.active.rejected?`Crossing product with A${s.active.crossing.qi+1} ↔ B${s.active.crossing.ri+1}: (${fmt(s.active.q)} − ${fmt(s.active.crossing.q)}) × (${fmt(s.active.r)} − ${fmt(s.active.crossing.r)}) = ${fmt((s.active.q-s.active.crossing.q)*(s.active.r-s.active.crossing.r),6)} &lt; 0 → reject.`:'This proposal passes the ordering test against all previously accepted pairs.'}</p>`:''}`;
  }
  function renderNumerical() {
    const s=steps[state.t];let html='';
    if(state.lesson==='mpurge')html=matchInspector(run,s.matchState);
    else if(state.lesson==='map') {
      const r=run.ranked.find(r=>r.id===(state.selectedRef??s.ref??run.ranked[0].id));
      html=`<div class="numbers-grid"><div><h3>Reference scores & coordinate weights</h3><p>Full computed run; the current reference is highlighted. Select a row to inspect its independent association.</p><div class="table-scroll"><table><thead><tr><th>Reference</th><th>Pairs</th><th>Mean δ</th><th>Coverage</th><th>Score</th><th>Weight</th></tr></thead><tbody>${run.ranked.map(v=>`<tr class="${v.id===r.id?'active':''}"><td><button data-ref="${v.id}">${v.label} ${xy(v.xy)}</button></td><td>${v.count}</td><td>${fmt(v.avg)}</td><td>${fmt(v.coverage)}</td><td>${fmt(v.score,5)}</td><td>${fmt(v.weight*100,2)}%</td></tr>`).join('')}</tbody></table></div></div><div><h3>${r.label} · follow the evidence</h3><div class="code">matched pairs = ${r.count}\nmax input count = ${Math.max(run.query.length,r.delays.length)}\ncoverage = ${fmt(r.coverage,6)}\nmean cost = ${fmt(r.avg,6)}\nscore = mean cost / coverage\n      = ${fmt(r.score,6)}\nweight = ${fmt(r.weight,6)}</div><p>Reference fingerprint (m):<br><span class="mono">${r.delays.map(v=>fmt(v)).join(', ')}</span></p><button class="apply-button" id="replayAssociation" data-ref="${r.id}">Follow this MPUrge association ↗</button><div class="metric-row">${metric(xy(run.estimate),'weighted estimate (m)')}${metric(fmt(E.dist(run.estimate,state.point))+' m','synthetic truth error')}</div></div></div>`;
    } else if(state.lesson==='smart') {
      const r=run.rounds[s.round||0],p=s.position||r.initial;
      html=`<div class="numbers-grid"><div><h3>Iteration ${(s.round||0)+1} · matched range constraints</h3><p>Predicted values below are recomputed at the position visible in this frame. Source IDs survive sorting.</p><div class="table-scroll"><table><thead><tr><th>Source</th><th>Measured (m)</th><th>Predicted (m)</th><th>Residual (m)</th><th>Squared (m²)</th></tr></thead><tbody>${r.association.matches.map(m=>{const predicted=E.dist(p,LAB_DATA.sources[m.ri]),res=predicted-m.q;return `<tr><td>${m.ri?'VT '+m.ri:'AP'}</td><td>${fmt(m.q,5)}</td><td>${fmt(predicted,5)}</td><td>${fmt(res,6)}</td><td>${fmt(res*res,6)}</td></tr>`;}).join('')}</tbody></table></div><p class="mono">Σ residual² = ${fmt(E.sum(r.association.matches.map(m=>(E.dist(p,LAB_DATA.sources[m.ri])-m.q)**2)),8)} m²</p><button class="apply-button" id="replayAssociation">Follow this MPUrge association ↗</button></div><div><h3>The numerical update</h3><div class="code">current x = ${xy(p)} m\nquery peaks = ${run.query.length}\nmatched constraints = ${r.association.matches.length}\nouter iteration = ${(s.round||0)+1}\nsolver = damped Gauss–Newton\nstep accepted only if SSE decreases\nstop: movement &lt; 10⁻⁵ m\n      or 4 outer iterations</div><p>The browser solves the same range least-squares objective as the teaching Python code, with a small damped solver instead of SciPy’s trust-region implementation.</p>${s.from?`<p>Δx = ${fmt(p[0]-s.from[0],7)} m<br>Δy = ${fmt(p[1]-s.from[1],7)} m</p>`:''}<p class="debug-note">Wrong associations can decrease the fitting objective while increasing localization error. Ground truth is never part of the objective.</p></div></div>`;
    } else {
      const idx=state.selectedCandidate??run.mode,f=run.fs[idx],sc=run.scores[idx],used=s.used??run.query.length;
      const scores=run.scores.map(v=>v.penalty+E.sum(v.lambda.slice(0,used).map(Math.log))),max=Math.max(...scores),raw=scores.map(v=>Math.exp(v-max)),den=E.sum(raw),weights=raw.map(w=>w/den);
      const order=run.points.map((p,i)=>({p,i,w:weights[i]})).sort((a,b)=>b.w-a.w).slice(0,10);
      if(['background','density'].includes(s.mode)) {
        html=curveInspector(s);
      } else if(s.mode==='responsibility') {
        html=trainingInspector();
      } else if(s.mode==='discover') {
        const a=LAB_DATA.model.anchors[s.source];
        html=`<h3>Source ${s.source+1} · survey consensus</h3><p>Retained fitted source: (${a.map(v=>fmt(v,7)).join(', ')}) m. The third coordinate is a nonnegative height offset, not an identified floor height. Fitted coordinates can move slightly after discovery support is recorded.</p><div class="table-scroll"><table><thead><tr><th>Survey</th><th>Position</th><th>Predicted range</th><th>Nearest peak</th><th>Absolute residual</th><th>Within 0.18 m?</th></tr></thead><tbody>${LAB_DATA.survey.map((p,i)=>{const pred=E.dist(p,a),di=E.argmin(LAB_DATA.sets[i].map(v=>Math.abs(v-pred))),v=LAB_DATA.sets[i][di],diff=Math.abs(v-pred);return `<tr><td>S${i+1}</td><td>${xy(p)}</td><td>${fmt(pred,6)}</td><td>${fmt(v,6)}</td><td>${fmt(diff,6)}</td><td>${diff<=.18?'yes':'no'}</td></tr>`;}).join('')}</tbody></table></div>`;
      } else {
        html=`<div class="inspect-select"><label for="candidateX">Inspect candidate x</label><input id="candidateX" type="number" min=".5" max="7.5" step=".25" value="${f.point[0]}" style="width:75px"><label for="candidateY">y</label><input id="candidateY" type="number" min=".5" max="5.5" step=".25" value="${f.point[1]}" style="width:75px"><button id="inspectCandidate" class="text-button">Inspect ↗</button></div>`;
        if(['visibility','responsibility','survey'].includes(s.mode))html+=`<div class="inspect-select"><label for="sourceSelect">Visibility source</label><select id="sourceSelect">${LAB_DATA.model.anchors.map((a,i)=>`<option value="${i}" ${i===state.source?'selected':''}>Source ${i+1} · ${xy(a)}</option>`).join('')}</select></div><div class="numbers-grid"><div><h3>Spatially interpolated source counts</h3><div class="table-scroll"><table><thead><tr><th>Source</th><th>Range ρ (m)</th><th>Global count</th><th>Local count ν</th></tr></thead><tbody>${f.ranges.map((v,j)=>`<tr><td>${j+1}</td><td>${fmt(v,6)}</td><td>${fmt(LAB_DATA.model.globalCounts[j],6)}</td><td>${fmt(f.intensities[j],6)}</td></tr>`).join('')}</tbody></table></div></div><div><h3>Spatial smoothing at ${xy(f.point)}</h3><div class="code">wᵢ = exp(−‖x − surveyᵢ‖² / (2h²))\nh = 1.1 m\nνⱼ = (Σᵢ wᵢ countᵢⱼ + 0.5 globalⱼ)\n      / (Σᵢ wᵢ + 0.5)\nΣᵢ wᵢ + 0.5 = ${fmt(f.denominator,7)}\nclip νⱼ to [0.015, 1.8]\nresidual integral = ${fmt(f.bgIntegral,7)}</div></div></div>`;
        else html+=`<div class="numbers-grid"><div><h3>Peak-by-peak evidence at ${xy(f.point)}</h3><p>The source and unexplained-echo columns show the learned curves before the 75% adjustment for missed echoes. λ includes that adjustment and a flat allowance for extra peaks: 0.080000 m⁻¹.</p><div class="table-scroll"><table><thead><tr><th>Peak (m)</th><th>Source</th><th>Residual</th><th>λ</th><th>log λ</th></tr></thead><tbody>${run.query.map((d,j)=>`<tr class="${j===s.peak?'active':''}" style="opacity:${j<used?1:.35}"><td>${fmt(d,5)}</td><td>${fmt(sc.source[j],6)}</td><td>${fmt(sc.background[j],6)}</td><td>${fmt(sc.lambda[j],6)}</td><td>${fmt(Math.log(sc.lambda[j]),6)}</td></tr>`).join('')}</tbody></table></div><div class="code">Λ = 0.75 × ${fmt(f.integral,7)} + 2\n  = ${fmt(sc.expectedCount,7)} expected peaks\nℓ = −Λ + Σ first ${used} log λ\n  = ${fmt(scores[idx],8)}\nposterior grid mass = ${fmt(weights[idx]*100,6)}%</div></div><div><h3>Leading candidates · ${used} peaks</h3><p>Current log scores use the count penalty and ${used} observed peaks. Heatmap shades use relative likelihood with a visual contrast adjustment; numeric weights below sum to one over the full grid.</p><div class="table-scroll"><table><thead><tr><th>Position (m)</th><th>log score</th><th>Mass</th></tr></thead><tbody>${order.map(v=>`<tr class="${v.i===idx?'active':''}"><td><button data-candidate="${v.i}">${xy(v.p)}</button></td><td>${fmt(scores[v.i],4)}</td><td>${fmt(v.w*100,3)}%</td></tr>`).join('')}</tbody></table></div><p>Grid: 0.25 m, 609 candidates, uniform prior. Each Student-t kernel has 3 degrees of freedom and is normalized over [0,25] m.</p></div></div>`;
      }
    }
    preserveFocus($('numerical'),()=>{$('numerical').innerHTML=html;});
  }
  let detailResult=null,detailIndex=0;
  function openAssociation(result){pause();detailResult=result;detailIndex=0;renderAssociation();$('modal').showModal();}
  function renderAssociation(){const s=detailResult.trace[detailIndex],d=matchText(s,detailResult);$('modalContent').innerHTML=`<h2>Inside the association</h2><div class="inline-heading"><span class="pill">${meta.mpurge.phases[d.phase]} · step ${detailIndex+1} / ${detailResult.trace.length}</span><span><button id="detailPrev" class="icon-button" aria-label="Previous association step" ${detailIndex===0?'disabled':''}>←</button> <button id="detailNext" class="icon-button" aria-label="Next association step" ${detailIndex===detailResult.trace.length-1?'disabled':''}>→</button></span></div>${matchDiagram(detailResult,s)}<h3>${d.title}</h3><p>${d.text}</p><div class="formula">${esc(d.formula).replace(/\n/g,'<br>')}</div><p>${d.why}</p>${s.costs?`<div class="table-scroll"><table><thead><tr><th>δ</th>${s.r.map(p=>`<th>B${p.id+1}</th>`).join('')}</tr></thead><tbody>${s.costs.map((row,i)=>`<tr><th>A${s.q[i].id+1}</th>${row.map((v,j)=>`<td class="${s.rows[i]===j&&s.cols[j]===i?'best':''}">${fmt(v,5)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:pairsTable(s.accepted)}`;}
  function modal(content){pause();detailResult=null;$('modalContent').innerHTML=content;$('modal').showModal();}
  function openMethodMap(){ $('modal').classList.add('method-dialog');modal(methodOverview()); }
  function followStep(e) {
    const button=e.target.closest('[data-goto-step]');
    if(!button)return;
    if($('modal').open)$('modal').close();
    goto(+button.dataset.gotoStep);
    document.querySelector('.workspace').scrollIntoView({behavior:'instant',block:'nearest'});
    document.querySelector('.explanation').focus({preventScroll:true});
  }
  function fundamentals(){modal(`<h2>One transmission.<br>Several arrivals.</h2><p>A radio signal can reach the receiver directly, or bounce off a wall first. Each route has a different length, so copies of the same signal arrive at different times. The list of these arrivals is a <b>multipath delay profile (MDP)</b>.</p><svg viewBox="0 0 600 230" role="img" aria-label="A direct path and a reflected path have different travel lengths"><line x1="45" y1="40" x2="550" y2="40" stroke="#849779" stroke-width="4"/><text x="295" y="25" font-size="12">reflecting wall</text><path d="M85 180 L280 40 L495 180" stroke="#be794d" stroke-width="2" fill="none"/><line x1="85" y1="180" x2="495" y2="180" stroke="#537e61" stroke-width="2"/><circle cx="85" cy="180" r="7" fill="#537e61"/><circle cx="495" cy="180" r="7" fill="#be794d"/><text x="65" y="210" font-size="12">transmitter</text><text x="470" y="210" font-size="12">receiver</text><text x="250" y="167" font-size="12">direct path</text><text x="320" y="92" font-size="12">longer reflected path</text></svg><h3>Why everything is in metres</h3><p>Multiply time delay by propagation speed to get path length: <b>d = cτ</b>. With c ≈ 0.3 m/ns, a 10 ns delay represents approximately 3 m. These lessons use absolute path lengths; unknown clock offsets are not modeled.</p><h3>A virtual transmitter unfolds the reflection</h3><p>Imagine reflecting the transmitter across the wall. The bent reflected route has the same length as the straight line from that mirror image to the receiver. This image is a <b>virtual transmitter (VT)</b>. Its position can be outside the room.</p><h3>What makes the problem hard?</h3><p>The measured peaks do not arrive with wall labels. Paths can disappear, extra peaks can appear, and similar lengths can belong to different routes. The four lessons explore different ways to reason about that incomplete evidence.</p><h3>How to use the lab</h3><p>Play slowly, or advance one step at a time. The phase strip jumps to a concept. Change the inputs to test a prediction, then open <b>Under the surface</b> for exact costs, residuals and probabilities. Export saves the current inputs and complete numerical run as JSON.</p>`);}
  function projectSource(path,label){return location.protocol==='file:'?`<a href="${esc(path)}">${esc(label)}</a>`:`<span>${esc(label)}</span>`;}
  function about(){modal(`<h2>Made to explain.<br>Grounded in the project.</h2><p>This is an executable teaching model, with synthetic examples and explicitly reduced scope. Every displayed online result is computed from the current inputs. Values are rounded only for display.</p><h3>MPUrge & MPUrge-MAP</h3><p>The JavaScript association and map equations follow ${projectSource("../basic_mdp_localization_lab/basic_methods.py","basic_mdp_localization_lab/basic_methods.py")}: monotone minimum-L1 size unification, epsilon boundary padding, mutual minima, cost-ordered proposals, noncrossing accepted pairs, and removal of all mutual proposals. This is the project's readable teaching interpretation; the papers contain ambiguities discussed elsewhere in the repository.</p><p>MPUrge uses p=2, α=0.5 by default and an unnormalized sum over upper-triangle neighborhood gap differences. MPUrge-MAP uses p=6, α=0.7, normalized pattern costs, score = mean cost / coverage, and inverse-score top-k coordinate weights. The standalone MPUrge lesson ends at path association; it does not reconstruct a full VT map.</p><p>Paper sources: ${projectSource("../Majid_papers/MPUrge_Merge_Purge_and_Urge_Multipath_Fingerprints_into_Virtual_Transmitters.pdf","MPUrge")} · ${projectSource("../Majid_papers/MPUrge-MAP_A_White-Box_Multipath-Assisted_Positioning_for_Indoor_Localization_in_6G_Networks.pdf","MPUrge-MAP")}.</p><h3>SMART-LEA</h3><p>The predict–associate–trilaterate loop follows the same teaching file and the ${projectSource("../Majid_papers/SMART-LEA_Scalable_Multipath-Aware_Localization_Enhancement_for_IoT_and_6G_Sensor_Networks.pdf","SMART-LEA paper")}. Five ideal 2D sources are supplied, including the physical AP. The initial position is user-selected. The browser uses damped Gauss–Newton for the range least-squares objective, up to 40 inner attempts and 4 outer iterations, stopping early when the outer position change is below 10⁻⁵ m. This differs from the Python trust-region solver and fixed outer iteration count.</p><h3>SAPP</h3><p>${projectSource("../publication/sapp/README.md","The project's SAPP package")} fitted the embedded model using only 35 synthetic survey positions and unlabeled path sets. It was not given the generating source coordinates. Source discovery shows the retained fitted sources. The four responsibility passes are recomputed in the browser using those sources and checked against the stored Python soft counts; source discovery itself is not a live RANSAC execution trace. The source-discovery budget is reduced to 5,000 trials with at most 5 sources (seed 42).</p><p>Online source intensity, spatial residual density, truncated Student-t kernels (ν=3), and the fixed-nuisance Poisson likelihood follow <code>fields.py</code>, <code>kernels.py</code>, and <code>likelihood.py</code> in <code>publication/sapp/src/sapp/</code>. This example assumes that 75% of the survey-like peaks are detected in a new measurement, plus 2 unrelated peaks on average across the [0,25] m path-length window. These settings stay fixed when you change the query. This is the fixed-nuisance variant, not the beta/gamma-marginalized variant also present in the package.</p><p>The teaching decoder uses a fixed 0.25 m rectangular grid inside the surveyed room, a uniform candidate prior and a geometric median with modified Weiszfeld updates. It omits the package's adaptive support construction, temperature tuning and support projection. The visibility bandwidth is fixed at 1.1 m. Changing the query kernel scale leaves training responsibilities fixed.</p><h3>How the examples are generated</h3><p>The ideal room is 8 × 6 m, with AP (1.2, 1.1) m and four first-order wall image sources. The observation generator knows these sources; the SAPP trainer does not. Query perturbations are deterministic, not random Gaussian noise. Truth markers and error readouts are evaluation aids, never estimator inputs. The MPUrge path-list example is illustrative and is not tied to this room.</p><h3>Reproducibility & privacy</h3><p>This HTML is self-contained and uses no network requests, cookies or external fonts. The source and tests are in this folder. <code>generate_data.py</code> rebuilds the embedded fitted survey using NumPy and SciPy; <code>node build.cjs</code> rebuilds the single HTML file. Paper PDFs and original Python packages remain in the research project. Local paper links work in the original checkout; the hosted visualizer lists the references without linking to those local files.</p>`);}
  function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),2500);}
  function exportRun(){
    const payload={format:'multipath-atelier-run-v1',lesson:state.lesson,step:state.t,inputs:{q:state.q,r:state.r,alpha:state.alpha,receiver:state.point,perturbation:state.noise,missingWest:state.missing,extraPeaks:state.clutter,k:state.k,initial:state.initial,kernelScale:state.scale},teachingModel:true,provenance:LAB_DATA.provenance,currentStep:steps[state.t],run};
    const blob=new Blob([JSON.stringify(payload,(_k,v)=>Number.isFinite(v)||typeof v!=='number'?v:null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`multipath-${state.lesson}-run.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('Run exported with inputs, decisions and numerical results.');
  }
  function applyPaths(){
    const parse=id=>{const text=$(id).value.trim();if(!text)throw Error('Both fingerprints need at least one path length.');const values=text.split(/[\s,;]+/).map(Number);if(values.length>12||values.length<1||values.some(v=>!Number.isFinite(v)||v<0||v>100))throw Error('Use 1–12 finite path lengths between 0 and 100 metres in each fingerprint.');return values;};
    try{const q=parse('queryInput'),r=parse('referenceInput');state.q=q;state.r=r;buildRun();toast('New fingerprints applied. The walkthrough starts again.');}catch(e){$('inputError').textContent=e.message;}
  }
  function updateControls(e){
    const id=e.target.id,v=+e.target.value;
    if(id==='preset') {
      const examples={default:[defaultQ,defaultR],clean:[[2,4,6,9,12],[2.1,4.1,6.1,9.1,12.1]],ties:[[2,2,5,8],[2,2,5.2,8.1]]};
      const ex=examples[e.target.value];state.q=[...ex[0]];state.r=[...ex[1]];buildRun();$('preset').value=e.target.value;return;
    }
    const scalar={alpha:'alpha',noise:'noise',neighbors:'k',scale:'scale',clutter:'clutter'};
    if(scalar[id])state[scalar[id]]=v;
    else if(id==='receiverX')state.point[0]=v;else if(id==='receiverY')state.point[1]=v;
    else if(id==='initialX')state.initial[0]=v;else if(id==='initialY')state.initial[1]=v;
    else if(id==='missing')state.missing=e.target.checked;
    else if(id==='truth'){state.showTruth=e.target.checked;renderScene();return;}
    else return;
    buildRun();$(id)?.focus({preventScroll:true});
  }
  function updateQRVariant(){
    const stochastic=document.querySelector('input[name="qrVariant"]:checked').value==='s';
    $('qrLatentTitle').innerHTML=stochastic?'Shared latent z<sub>k</sub> ∈ ℝ⁴':'Fixed zero code z = 0';
    $('qrLatentText').textContent=stochastic?'One code per draw k, shared by every reference.':'One deterministic pass, with zero code for every reference.';
    $('qrReadoutTitle').textContent=stochastic?'32 hypotheses → one mean':'One hypothesis → one position';
    $('qrReadoutFormula').innerHTML=stochastic?'ŷ = (1 / 32) ∑<sub>k=1…32</sub> ŷ<sub>k</sub>':'ŷ = ŷ<sub>1</sub>';
    $('qrReadoutText').textContent=stochastic?'QR-S repeats the vote-and-consensus stages with 32 fixed antithetic Gaussian codes (z and −z), then takes the uniform mean of the 32 corrected global hypotheses.':'QR-D fixes the latent code to zero. All references still cast learned, weighted votes; their context-corrected consensus is returned directly. There is no averaging across latent draws.';
    $('qrVoteCount').textContent=stochastic?'M × 32':'M × 1';
    $('qrGlobalCount').textContent=stochastic?'32':'1';
  }
  function changeLesson(){
    const value=location.hash.slice(1).split('?')[0];
    // The skip link changes the fragment without changing the current lesson.
    if(value==='main'&&document.title!=='Multipath Atelier — an interactive localization lab')return;
    pause();
    const qr=value==='qr';state.lesson=qr?'qr':meta[value]?value:'mpurge';state.selectedRef=null;state.cell=null;
    $('qrArchitecture').hidden=!qr;
    document.querySelectorAll('.workspace,.below-grid,#inspector,#export,#playbackHelp').forEach(el=>{el.hidden=qr;});
    document.querySelector('.teaching-tag').textContent=qr?'ARCHITECTURE GUIDE · NO LIVE NEURAL INFERENCE':'LIVE COMPUTATION · SYNTHETIC TEACHING EXAMPLE';
    if(!qr){buildRun();return;}
    $('methodMap').hidden=true;$('sappOverview').hidden=true;$('teachingTag').hidden=false;
    $('eyebrow').textContent='METHOD 05 / QUERY–REFERENCE POINTNET';
    $('title').textContent='From path sets to a position.';
    $('subtitle').textContent='Follow the components of QR-PointNet: shared set encoding, reference-relative votes, learned consensus and the stochastic hypotheses in between.';
    $('chapterIndex').textContent='05';$('breadcrumb').textContent='Query-reference architecture';
    $('inputSummary').textContent='INPUT · Query paths + surveyed reference bank + AP metadata';
    document.querySelectorAll('[data-lesson]').forEach(a=>{const current=a.dataset.lesson==='qr';a.classList.toggle('active',current);if(current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    document.title='QR-PointNet — Multipath Atelier';updateQRVariant();
  }
  $('qrArchitecture').addEventListener('change',e=>{if(e.target.name==='qrVariant')updateQRVariant();});
  $('play').addEventListener('click',play);$('next').addEventListener('click',()=>goto(state.t+1));$('previous').addEventListener('click',()=>goto(state.t-1));$('restart').addEventListener('click',()=>goto(0));
  $('timeline').addEventListener('input',e=>goto(+e.target.value));$('speed').addEventListener('change',e=>{state.speed=+e.target.value;schedule();});
  $('phases').addEventListener('click',e=>{const p=e.target.closest('[data-phase]');if(p)goto(steps.findIndex(s=>s.phase===+p.dataset.phase));});
  $('controls').addEventListener('input',e=>{if(e.target.type==='range'){const out=e.target.closest('label').querySelector('output');out.textContent=fmt(+e.target.value,+e.target.step<1?2:0)+(e.target.dataset.unit||'');}});
  $('controls').addEventListener('change',updateControls);$('controls').addEventListener('click',e=>{if(e.target.id==='applyPaths')applyPaths();});
  $('resetInputs').addEventListener('click',()=>{Object.assign(state,{q:[...defaultQ],r:[...defaultR],alpha:.5,point:[4.6,2.4],noise:.08,missing:false,clutter:0,k:3,initial:[3.8,2.8],scale:.18,source:0,selectedRef:null,showTruth:true});buildRun();toast('Default experiment restored.');});
  $('challenge').addEventListener('click',()=>{
    if(state.lesson==='mpurge'){state.alpha=state.alpha===1?.5:1;buildRun();$('challengeResult').textContent=`α is now ${state.alpha}. Replay and compare which pairs survive.`;}
    if(state.lesson==='map'){state.k=state.k===1?3:1;buildRun();goto(steps.length-1);$('challengeResult').textContent=`k = ${state.k}. The estimate is ${xy(run.estimate)} m. Compare its position with the highlighted references.`;}
    if(state.lesson==='smart'){state.initial=state.initial[0]===7.2?[3.8,2.8]:[7.2,5.2];buildRun();$('challengeResult').textContent=`Starting at ${xy(state.initial)} m. Predict whether the first path associations will still be correct.`;}
    if(state.lesson==='sapp'){state.missing=!state.missing;state.clutter=state.missing?1:0;buildRun();goto(steps.findIndex(s=>s.mode==='evidence'));$('challengeResult').textContent=`The query now has ${run.query.length} peaks. Step through the evidence to see the probability map change.`;}
  });
  $('inspector').addEventListener('toggle',()=>{if(state.lesson!=='qr'&&$('inspector').open)renderNumerical();});
  function selectDiagram(e){
    const ref=e.target.closest('[data-ref]'),cell=e.target.closest('[data-cell]'),candidate=e.target.closest('[data-candidate]');
    if(e.target.id==='replayAssociation'){const result=state.lesson==='map'?run.ranked.find(r=>r.id===+e.target.dataset.ref).result:run.rounds[steps[state.t].round||0].association;openAssociation(result);return;}
    if(cell){pause();state.cell=cell.dataset.cell.split(',').map(Number);renderScene();renderNumerical();return;}
    if(ref){pause();state.selectedRef=+ref.dataset.ref;$('inspector').open=true;renderScene();renderNumerical();return;}
    if(e.target.closest('[data-training-peak]')){state.trainingPeak=+e.target.closest('[data-training-peak]').dataset.trainingPeak;pause();renderScene();renderExplanation(steps[state.t]);renderNumerical();return;}
    if(candidate){pause();state.selectedCandidate=+candidate.dataset.candidate;$('inspector').open=true;renderScene();renderExplanation(steps[state.t]);renderNumerical();return;}
    if(e.target.id==='inspectCandidate'){
      const x=+$('candidateX').value,y=+$('candidateY').value;
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<.5||x>7.5||y<.5||y>5.5){toast('Choose x in [0.5, 7.5] and y in [0.5, 5.5] metres.');return;}
      state.selectedCandidate=E.argmin(run.points.map(p=>E.dist(p,[x,y])));renderScene();renderExplanation(steps[state.t]);renderNumerical();
    }
  }
  $('scene').addEventListener('click',selectDiagram);$('numerical').addEventListener('click',selectDiagram);
  $('sceneTools').addEventListener('click',e=>{const source=e.target.closest('[data-source]'),point=e.target.closest('[data-sourcepoint]');if(!source&&!point)return;pause();if(source)state.source=+source.dataset.source;if(point)state.selectedCandidate=visibilityStats()[point.dataset.sourcepoint];renderScene();if($('inspector').open)renderNumerical();});
  $('sceneTools').addEventListener('change',e=>{if(!['trainingRow','trainingPeak','trainingPass'].includes(e.target.id))return;pause();state[e.target.id]=+e.target.value;state.trainingPeak=Math.min(state.trainingPeak,LAB_DATA.sets[state.trainingRow].length-1);renderScene();renderExplanation(steps[state.t]);if($('inspector').open)renderNumerical();});
  $('scene').addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-ref],[data-candidate]')){e.preventDefault();selectDiagram(e);return;}
    if(e.target.hasAttribute('data-candidate')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();const i=+e.target.dataset.candidate,p=run.points[i],delta={ArrowLeft:[-.25,0],ArrowRight:[.25,0],ArrowUp:[0,.25],ArrowDown:[0,-.25]}[e.key];
      state.selectedCandidate=E.argmin(run.points.map(q=>E.dist(q,[p[0]+delta[0],p[1]+delta[1]])));pause();renderScene();if($('inspector').open)renderNumerical();$('scene').querySelector(`[data-candidate="${state.selectedCandidate}"]`).focus({preventScroll:true});
    }
  });
  $('selectionSummary').addEventListener('click',e=>{if(e.target.id==='jumpToNumbers'){$('inspector').open=true;renderNumerical();$('inspector').scrollIntoView({behavior:'smooth',block:'start'});$('inspector').querySelector('summary').focus({preventScroll:true});}});
  $('numerical').addEventListener('change',e=>{if(e.target.id==='sourceSelect'){state.source=+e.target.value;renderScene();renderNumerical();}});
  $('prediction').addEventListener('click',e=>{if(e.target.dataset.answer){$('answerText').textContent=e.target.dataset.answer==='correct'?steps[state.t].quiz[3]:'Take another look. '+steps[state.t].quiz[3].replace(/^Correct\. /,'');}});
  function showSources(){about();$('modalContent').insertAdjacentHTML('beforeend','<h3>QR-PointNet architecture guide</h3><p>The fifth section diagrams the QR-D / QR-S core from the September 2026 manuscript, checked against its query-reference implementation. It explains data flow, not live neural inference. The QR-S / QR-D switch changes the explanation only. No model weights, private survey data, benchmark predictions or manuscript PDF are included. Training-only assumptions and equations are listed beneath the diagram.</p>');}
  $('export').addEventListener('click',exportRun);$('fundamentals').addEventListener('click',fundamentals);$('about').addEventListener('click',showSources);
  $('basicsFooter').addEventListener('click',fundamentals);$('aboutFooter').addEventListener('click',showSources);
  document.querySelector('.explanation').addEventListener('scroll',updateExplanationHint);window.addEventListener('resize',updateExplanationHint);
  $('methodMap').addEventListener('click',openMethodMap);
  $('explanationContent').addEventListener('click',e=>{if(e.target.closest('.open-method-map'))openMethodMap();else followStep(e);});
  $('sappOverview').addEventListener('click',followStep);$('modalContent').addEventListener('click',followStep);
  $('modal').addEventListener('close',()=>$('modal').classList.remove('method-dialog'));
  $('closeModal').addEventListener('click',()=>$('modal').close());$('modal').addEventListener('click',e=>{if(e.target===$('modal'))$('modal').close();if(e.target.id==='detailNext'||e.target.id==='detailPrev'){detailIndex+=e.target.id==='detailNext'?1:-1;preserveFocus($('modalContent'),renderAssociation);const next=$('detailNext'),prev=$('detailPrev');if(document.activeElement===document.body||document.activeElement===$('modal'))(next.disabled?prev:next).focus({preventScroll:true});}});
  document.addEventListener('keydown',e=>{if(state.lesson==='qr'||$('modal').open||e.target.closest('input,textarea,select,button,a,[role="button"],summary')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.code==='Space'){e.preventDefault();play();}if(e.key==='ArrowRight'){e.preventDefault();goto(state.t+1);}if(e.key==='ArrowLeft'){e.preventDefault();goto(state.t-1);}if(e.key.toLowerCase()==='r')goto(0);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('hashchange',changeLesson);
  changeLesson();
})();
