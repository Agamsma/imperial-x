# Data sources

How VajraNow plans to get each dataset, and where we stand today.

> **Rule for this repo:** never commit downloaded data. MOSDAC and IMD terms do not allow redistribution. Keep all downloads in a local `data/` folder, which is already in `.gitignore`. The website and demo use only synthetic data made in code.

| Source | Used for | Access status |
| --- | --- | --- |
| MOSDAC TERLS Doppler radar | Storm cells, motion, hail signal | Access approved |
| MOSDAC INSAT-3D/3DR | Cloud top cooling, new storm growth | Access approved |
| ERA5 (Copernicus) | Instability and wind context | Open |
| SEVIR benchmark | Model pre-training and testing | Open |
| IITM lightning network | Lightning labels and checks | Planned request |
| Live IMD radar | Live operation | Future, needs approval |

## 1. MOSDAC: TERLS Doppler Weather Radar

- **What:** Doppler Weather Radar data from ISRO's radar at TERLS (Thumba Equatorial Rocket Launching Station), Thiruvananthapuram. Reflectivity and radial velocity scans.
- **How to get it:**
  1. Register at [mosdac.gov.in](https://www.mosdac.gov.in) (MOSDAC, Space Applications Centre, ISRO).
  2. Log in and request the radar product through the data order section.
  3. Wait for approval, then download the files from your order.
- **Status:** our access is approved.
- **Terms:** for our own research use only. Do not upload these files to GitHub, the website, or any public place.

## 2. MOSDAC: INSAT-3D / INSAT-3DR imager

- **What:** infrared images from the INSAT-3D and INSAT-3DR geostationary satellites. We plan to use the thermal infrared channel to track cloud top cooling, which is an early sign of a growing storm.
- **How to get it:** same MOSDAC account. Choose the INSAT-3D or INSAT-3DR imager products and the time range you need.
- **Status:** our access is approved.
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
- **Status:** planned request, not sent yet. Until we have it, the demo labels lightning as a "proxy" (estimated from radar and satellite signals).

## 6. Live IMD radar

- **What:** real time data from the India Meteorological Department radar network.
- **How to get it:** only through an official approval or partnership with IMD.
- **Status:** future. VajraNow will not claim live operation until this is in place.
