/* Portraits, written by fetch_portraits.py. Each id maps to a file name, or to a list of
 * { from, file } versions: the version with the latest `from` at or before the viewing episode is
 * shown, so later character designs never appear early. Characters not listed get a drawn
 * silhouette. Add your own images the same way; use pictures from episodes already watched.
 */
window.ATLAS_PORTRAITS = {
  "annie": [{"from": 4, "file": "annie-s2.jpg"}],
  "armin": [{"from": 1, "file": "armin-s2.jpg"}, {"from": 38, "file": "armin-s3.jpg"}],
  "bertholdt": [{"from": 4, "file": "bertholdt-s2.jpg"}],
  "connie": [{"from": 4, "file": "connie-s2.jpg"}, {"from": 38, "file": "connie-s3.jpg"}],
  "eren": [{"from": 1, "file": "eren-s2.jpg"}, {"from": 38, "file": "eren-s3.jpg"}],
  "erwin": [{"from": 14, "file": "erwin-s2.jpg"}, {"from": 38, "file": "erwin-s3.jpg"}],
  "hange": [{"from": 15, "file": "hange-s2.jpg"}, {"from": 38, "file": "hange-s3.jpg"}],
  "historia": [{"from": 16, "file": "historia-s2.jpg"}, {"from": 38, "file": "historia-s3.jpg"}],
  "jean": [{"from": 4, "file": "jean-s2.jpg"}, {"from": 38, "file": "jean-s3.jpg"}],
  "levi": [{"from": 14, "file": "levi-s2.jpg"}, {"from": 38, "file": "levi-s3.jpg"}],
  "mikasa": [{"from": 1, "file": "mikasa-s2.jpg"}, {"from": 38, "file": "mikasa-s3.jpg"}],
  "reiner": [{"from": 4, "file": "reiner-s2.jpg"}],
  "sasha": [{"from": 4, "file": "sasha-s2.jpg"}, {"from": 38, "file": "sasha-s3.jpg"}],
  "ymir": [{"from": 16, "file": "ymir-s2.jpg"}]
};
