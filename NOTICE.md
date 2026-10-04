# Third-party notices and attribution

VajraNow's own code is MIT licensed (see [LICENSE](LICENSE), © 2026 Team OmniSense). The MIT
licence covers our code only. It does not replace or change the terms of any data, method,
package or template listed below.

## Data

- **MOSDAC (ISRO / Space Applications Centre):** TERLS Doppler radar files
  (`RCTLS_*_L2C_STD.nc`, 3D volumetric gridded product) and INSAT-3DR imager files
  (`3RIMG_*_L1B_STD_V01R00.h5`), read by the baseline study in
  [`validation/real_radar/`](validation/real_radar/). **They are not redistributed here.** Only
  their names, times, sizes and SHA-256 checksums are listed, in
  [`input_manifest.csv`](validation/real_radar/input_manifest.csv). Credit MOSDAC when showing
  results, and check MOSDAC's data policy before publishing imagery derived from the files.
- **ERA5, ISS-LIS, IITM lightning, NCMRWF:** open or planned sources. None is used in the code
  today and none is redistributed here.
- The website demo and the engine run on synthetic data made in code.

## Methods taken from the literature (ideas, not copied code)

| Method | Where in the repo | Source |
| --- | --- | --- |
| TREC block matching for storm motion | [`vajranow/motion.py`](vajranow/motion.py) | Rinehart and Garvey, 1978 (classic method). Our own numpy code |
| Semi-Lagrangian extrapolation | [`vajranow/advection.py`](vajranow/advection.py) | The same idea as the pysteps `semilagrangian` method (Pulkkinen et al., 2019, GMD 12, 4185). **No pysteps code is included**; pysteps is not a dependency. pysteps itself is BSD-3-Clause licensed |
| Z = 300 R^1.4 and the 53 dBZ hail cap | [`vajranow/hazards.py`](vajranow/hazards.py) | Classic convective Z-R relation and cap, as used by default in the WSR-88D rain algorithm |
| Optical flow in the real-data baseline | [`validation/real_radar/skill.py`](validation/real_radar/skill.py) | OpenCV `calcOpticalFlowFarneback` (Farneback, 2003), called as a library. OpenCV is Apache-2.0 licensed |
| Storm objects with tree-model hazards (planned) | Not implemented | Idea only: Cintineo et al., 2024 (NOAA ProbSevere v3) |
| Multi-source hazard nowcasting | Not implemented | Idea only: Leinonen et al., 2023 (GRL). That study uses deep learning, not the LightGBM models we plan |

We have not run a code-similarity scan against other projects. If adapted code is ever added,
its licence header must be kept and it must be listed here.

## Software

Used under their own open-source licences (see each package):

- Website: Next.js, React, MapLibre GL JS, Tailwind CSS, Framer Motion (with TypeScript and
  ESLint for development). See [`package.json`](package.json).
- Engine API: FastAPI, numpy (and uvicorn, pytest, httpx for development). See
  [`requirements.txt`](requirements.txt) and [`requirements-dev.txt`](requirements-dev.txt).
- CNN training: PyTorch (installed separately, see [`training/`](training/)).
- Real-data baseline: netCDF4, cftime, h5py, numpy, SciPy, OpenCV, matplotlib. See
  [`validation/real_radar/requirements.txt`](validation/real_radar/requirements.txt).

## Presentation template

The SIH idea-submission deck is built on the SIH idea-submission template. The file properties
that came with that template (title "Investor Pitch Deck Template", creator "Crowdfunder",
created 2013-12-12) are kept in the deck's document comments for provenance. We have not
verified the template's licence.
