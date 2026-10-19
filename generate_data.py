"""Rebuild the tiny, deterministic teaching survey with the project's real SAPP.

Run with a Python environment containing NumPy and SciPy. No downloads.
The ground-truth image sources generate observations, but are NOT passed to fit.
"""
from pathlib import Path
import json
import sys
from dataclasses import asdict
import numpy as np

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "publication/sapp/src"))
sys.path.insert(0, str(ROOT.parent / "basic_mdp_localization_lab"))
from sapp.fitting import fit
from sapp.types import AnchorParameters
from sapp.kernels import range_surfaces
from sapp.fields import predict_intensity, _prepare_background, _background_density
from sapp.likelihood import semiparametric_fixed_nuisance_log_density
from basic_methods import mpurge_match, mpurge_map_localize

sources = np.array([[1.2, 1.1, 0], [-1.2, 1.1, 0], [14.8, 1.1, 0], [1.2, -1.1, 0], [1.2, 10.9, 0]])
xy = np.array([[x, y] for y in np.linspace(.6, 5.4, 5) for x in np.linspace(.6, 7.4, 7)])
rng = np.random.default_rng(42)
sets = []
for i, p in enumerate(xy):
    lengths = np.linalg.norm(sources[:, :2] - p, axis=1) + rng.normal(0, .025, 5)
    # Visibility changes across the survey; one coherent residual feature.
    visible = np.ones(5, dtype=bool)
    if p[0] > 5.5 and i % 2 == 0:
        visible[1] = False
    if p[1] < 1 and i % 3 == 0:
        visible[4] = False
    vals = list(lengths[visible])
    if p[0] > 4:
        vals.append(17 + .2 * p[1] + rng.normal(0, .05))
    sets.append(np.sort(vals))

params = AnchorParameters(source_count=5, ransac_trials=5000, field_length_m=1.1,
                          association_scale_m=.18, minimum_support_fraction=.25,
                          seed=42, decode="posterior_median")
model = fit(xy, sets, params)
payload = dict(sources=sources.tolist(), survey=xy.tolist(), sets=[s.tolist() for s in sets],
    model=dict(anchors=model.anchors.tolist(), softCounts=model.soft_counts.tolist(),
    globalCounts=model.global_counts.tolist(), clutterRate=model.clutter_rate,
    support=model.discovery_support.tolist(), residual=model.discovery_residual_m.tolist(),
    background=[[dict(d=float(d), w=float(w)) for d, w, valid in zip(ds, ws, ms) if valid]
       for ds, ws, ms in zip(model.background_delay, model.background_responsibility, model.background_mask)],
    parameters=asdict(params)), provenance=dict(seed=42, synthetic=True, training="publication/sapp/src/sapp/fitting.py",
    note="SAPP receives only surveyed positions and unlabeled path-length sets; ideal source coordinates are used only by the observation generator."))
ROOT.joinpath("data.json").write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")

# Independent reference cases for numerical verification of the JavaScript port.
cases = []
for _ in range(30):
    q = rng.uniform(.1, 20, rng.integers(1, 10)).tolist()
    r = rng.uniform(.1, 20, rng.integers(1, 10)).tolist()
    for normalized, width, alpha in [(False, 2, .5), (True, 6, .7)]:
        matches = mpurge_match(q, r, half_width=width, alpha=alpha, normalize_pattern=normalized)
        cases.append(dict(q=q, r=r, width=width, alpha=alpha, normalized=normalized,
                          matches=[asdict(m) for m in matches]))
observed = np.array([3.1, 5.2, 8.4, 12.6, 17.4])
candidates = np.array([[1.3, 2.4], [4.6, 2.4], [7, 5]])
bg, integ = _background_density(model, _prepare_background(model, candidates), observed)
score = semiparametric_fixed_nuisance_log_density(observed, range_surfaces(candidates, model.anchors),
    predict_intensity(model, candidates), scale_m=.18, clutter_rate=model.clutter_rate, range_limit_m=25,
    background_density=bg, background_integral=integ)
fixtures = dict(matches=cases, sapp=dict(q=observed.tolist(), points=candidates.tolist(), scores=score.tolist()))
ROOT.joinpath("test-fixtures.json").write_text(json.dumps(fixtures), encoding="utf-8")
print(json.dumps(dict(anchors=model.anchors.tolist(), support=model.discovery_support.tolist(),
                     survey_points=len(xy), reference_cases=len(cases)), indent=2))
