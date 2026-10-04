# Data sources

How VajraNow plans to get each dataset, and where we stand today.

> **Rule for this repo:** never commit downloaded data. MOSDAC and IMD terms do not allow redistribution. Keep all downloads in a local `data/` folder, which is already in `.gitignore`. The website demo and the engine use only synthetic data made in code. The one exception is the two-day baseline in [`validation/real_radar/`](../validation/real_radar/), which reads MOSDAC files kept outside the repo and lists them in `input_manifest.csv`.

| Source | Used for | Access status |
| --- | --- | --- |
| MOSDAC TERLS Doppler radar | Storm cells and motion. Reflectivity used; velocity not yet processed | Ordered; files for 10 and 11 May 2026 used in the baseline |
| MOSDAC INSAT-3D/3DR | Cloud top cooling, new storm growth | Ordered; INSAT-3DR files for 10 May 2026 used in the baseline |
| ISS-LIS (NASA Earthdata) | Spot checks of lightning (retrospective only) | Free |
| IITM lightning network | Lightning labels and checks | Planned request |
| ERA5 (Copernicus) / NCMRWF | Weather context (ERA5 retrospective only) | ERA5 open; NCMRWF planned |
| SEVIR benchmark | Possible pre-training and testing (US data); not used yet | Open |
| Live IMD radar | Live runs | Future, needs IMD approval |

## 1. MOSDAC: TERLS Doppler Weather Radar

- **What:** Doppler Weather Radar data from ISRO's radar at TERLS (Thumba Equatorial Rocket Launching Station), Thiruvananthapuram. Reflectivity and radial velocity on a 3D grid (product L2C, about 1 km, 0 to 20 km height). In our files, scans are about 15 minutes apart (median 15.3 min). We use reflectivity only; velocity is not processed yet.
- **How to get it:**
  1. Register at [mosdac.gov.in](https://www.mosdac.gov.in) (MOSDAC, Space Applications Centre, ISRO).
  2. Log in and request the radar product through the data order section.
  3. Wait for approval, then download the files from your order.
- **Status:** ordered. 44 files for 10 and 11 May 2026 were received and used in the [real-data baseline](../validation/real_radar/).
- **Terms:** for our own research use only. Do not upload these files to GitHub, the website, or any public place.

## 2. MOSDAC: INSAT-3D / INSAT-3DR imager

- **What:** infrared images from the INSAT-3D and INSAT-3DR geostationary satellites. We plan to use the thermal infrared channel to track cloud top cooling, which is an early sign of a growing storm.
- **How to get it:** same MOSDAC account. Choose the INSAT-3D or INSAT-3DR imager products and the time range you need.
- **Status:** ordered. 14 INSAT-3DR imager L1B files for 10 May 2026 (30 min frames) were received and used in the baseline.
- **Terms:** same as above. Research use only, no redistribution.

## 3. ERA5 reanalysis (Copernicus Climate Data Store)

- **What:** hourly global weather reanalysis from ECMWF. We plan to use fields like CAPE, humidity and wind shear as background context for storm growth.
- **How to get it:**
  1. Create a free account at the [Copernicus Climate Data Store](https://cds.climate.copernicus.eu).
  2. Accept the ERA5 licence on the dataset page.
  3. Put your API key in `~/.cdsapirc` (the CDS site shows the exact format for your account).
  4. Install the client with `pip install cdsapi` and request only the Kerala area and dates you need, for example from the `reanalysis-era5-single-levels` dataset.
- **Status:** open.

## 4. SEVIR benchmark

- **What:** the Storm EVent ImagRy dataset. Thousands of storm events with aligned radar, satellite and lightning data. It covers the United States, so we plan to use it only to pre-train and test models before we move to Indian data.
- **How to get it:** it is public on AWS Open Data. No account is needed:

  ```bash
  aws s3 ls --no-sign-request s3://sevir/
  aws s3 cp --no-sign-request s3://sevir/CATALOG.csv data/sevir/
  ```

  The full dataset is large (about 1 TB), so download only the event types and years you need.
- **Status:** open.

## 5. IITM lightning location network

- **What:** ground based lightning strike data from the Indian Institute of Tropical Meteorology (IITM), Pune.
- **How to get it:** a formal data request to IITM, explaining the research use.
- **Status:** planned request, not sent yet. Until we have it, the demo labels lightning as a radar proxy (chance of echo of 40 dBZ or more).

## 6. Live IMD radar

- **What:** real time data from the India Meteorological Department radar network.
- **How to get it:** only through an official approval or partnership with IMD.
- **Status:** future. VajraNow will not claim live operation until this is in place.

## 7. ISS-LIS lightning (NASA)

- **What:** lightning flashes seen by the Lightning Imaging Sensor on the International Space Station. Spot passes only, so it can check the lightning proxy on some days but cannot replace a ground network.
- **How to get it:** free NASA Earthdata account; ISS-LIS Quality Controlled Lightning Data V2 (doi:10.5067/LIS/ISSLIS/DATA111).
- **Status:** free, not downloaded yet. Retrospective only.
