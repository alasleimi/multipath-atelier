MULTIPATH ATELIER

Website: https://alasleimi.github.io/multipath-atelier/
Repository: https://github.com/alasleimi/multipath-atelier

Open index.html in Edge, Chrome, Firefox or Safari. No server, installation or
internet connection is required for the downloaded HTML. Paper links work in
the original research checkout. The hosted version displays these references
without linking to local files; the research papers and parent Python packages
are not bundled in this standalone visualizer repository.

Four interactive lessons and a QR component diagram
  1. MPUrge: sort/prune, inspect actual neighborhood spacing, calculate costs,
     merge mutual minima, purge crossings and urge remaining paths to rematch.
  2. MPUrge-MAP: evaluate 12 survey references, inspect coverage-adjusted scores,
     replay any reference's full matching loop and form the weighted position.
  3. SMART-LEA: start from a chosen position, predict source ranges, associate,
     watch range circles and individual least-squares updates, then repeat.
  4. SAPP: replay the survey fit, examine source visibility and residual density,
     add count and peak evidence, inspect the position distribution and median.
  5. QR-PointNet (#qr): follow shared set encoding, query-reference pair evidence,
     displacement votes, learned reference consensus and context correction.
     Switch QR-S / QR-D to compare the 32-hypothesis mean with the deterministic
     zero-code readout. This is an architecture guide, not browser neural inference.
     Training-only supervision and the September 2026 core equations are separate.
     No QR weights, private survey data or manuscript PDF are bundled. Later JEPA
     experiments and local-transport variants are outside this diagram's scope.

Controls
  Play/pause, previous/next, timeline, phase shortcuts, 0.5x/1x/2x playback.
  Space plays/pauses; arrow keys step; R restarts when no control has focus.
  Open "Under the surface" for the arithmetic behind the current frame.
  Selecting a reference or candidate shows an inline numerical summary;
  "Inspect numbers" moves to the full calculation. On the SAPP map, Tab to
  a cell and use the arrow keys to inspect adjacent positions.
  SAPP's source-visibility frame shows expected echo counts before query
  survival, with a labeled cell readout and room-wide range. Compare sources
  directly above the map; Low count / High count select the actual extrema.
  Edit MPUrge path lists, or change receiver position, perturbation, missing
  paths and clutter in the positioning lessons. Each change reruns the model.
  "Export this run" downloads inputs, step data and numerical outputs as JSON.
  The exercises and prediction questions invite students to test a hypothesis.

Scope and provenance
  These are synthetic teaching examples, not accuracy benchmarks.
  MPUrge and MPUrge-MAP reproduce basic_mdp_localization_lab/basic_methods.py.
  The MPUrge lesson ends at matching; full VT-track reconstruction is omitted.
  SMART-LEA uses the same least-squares objective but a damped Gauss-Newton
  browser solver, ideal 2D sources and a user-selected initial guess.
  SAPP training was run with publication/sapp/src/sapp/fitting.py on 35 unlabeled
  synthetic survey sets (seed 42; 5,000 source-discovery trials; 5 sources).
  The fitted model is embedded. Training frames replay fitted outputs; they do
  not claim to execute or animate each individual RANSAC trial. Query scoring
  and decoding run live. The fixed-nuisance likelihood and a 0.25 m rectangular
  candidate grid are used. All reductions are explained in Sources & assumptions.
  Ground-truth receiver coordinates are used only to generate observations and
  evaluate error, not as input to the estimators.

Files
  index.html           Self-contained deliverable; open this file.
  src/                 Editable HTML, CSS, browser UI and numerical engine.
  data.json            Fitted survey model embedded by the build.
  generate_data.py     Rebuilds the synthetic survey with real project Python.
  build.cjs            Rebuilds index.html without any npm dependencies.
  test-engine.cjs      Independent Python fixture and numerical checks.
  test-qr-browser.cjs  Optional QR routing, controls and responsive browser QA.
  test-fixtures.json   Python-generated reference results.
  .qa/                 Browser tests and review screenshots; not needed to run.

Rebuild
  node build.cjs

GitHub Pages
  Push changes to main. The GitHub Actions workflow runs the numerical checks,
  rebuilds index.html, and publishes the self-contained HTML to GitHub Pages.
  You can also run "Deploy visualizer to GitHub Pages" from the Actions tab.
  Only the generated website is uploaded as the Pages artifact.

Numerical verification
  node test-engine.cjs

Regenerate the survey (NumPy/SciPy and the parent project are required)
  python generate_data.py
  node build.cjs

Browser verification in the original project checkout
  Local QA scripts, review reports and screenshots under .qa/ are not published
  to this repository. With that local QA folder and Microsoft Edge installed:
  npm install --prefix .qa playwright --no-audit --no-fund
  node .qa/browser-test.cjs
  node .qa/medium-fixes-test.cjs

QR browser verification (requires Microsoft Edge and an installed Playwright)
  Set PLAYWRIGHT_MODULE to the Playwright package location, or install it where
  Node can resolve it, then run: node test-qr-browser.cjs
  Set QR_TEST_URL=https://alasleimi.github.io/multipath-atelier/ to test deployment.
  Screenshots go to .qa/qr-local or .qa/qr-hosted; they are not published.

Validated on the final local artifact in headless Edge: all four lessons,
playback, input validation, nested association, posterior candidate inspection,
export, dialogs, and phone/tablet overflow. No page errors or network requests.
Laptop visual QA covers 1280x720, 1366x768 and 1440x900: all default frames
keep the diagram and playback controls visible, without moving the controls.
Targeted checks cover sidebar help, selected references, numerical legends,
dense labels, keyboard focus, heatmap navigation, actual animation pause,
cell identity during transitions and reduced motion. Screenshots and results
are in .qa/verified-fixes/. Phone diagrams still need a dedicated readability
pass; the current improvements prioritize laptop use.
Numerical checks include 60 independent Python association cases, Python SAPP
likelihood fixtures, kernel normalization, monotone solver objectives,
permutation invariance, median behavior and empty-input handling.
