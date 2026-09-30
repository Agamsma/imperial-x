# models/

**Status: planned. No code yet.**

This folder will hold:

- **Baseline:** pysteps optical flow extrapolation of radar reflectivity.
- **AI fusion model:** a PyTorch model that combines radar, satellite and lightning inputs.
- **Hazard classifiers:** LightGBM models for hail, gusts and extreme rain (experimental).
- **Verification:** scripts that compare every model against the pysteps baseline on the same storm cases.

Model weights are not committed (see `.gitignore`).
