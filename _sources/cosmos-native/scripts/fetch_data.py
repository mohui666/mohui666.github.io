from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import urlretrieve

root=Path(__file__).resolve().parents[1]
data=root/"data"
data.mkdir(exist_ok=True)
urls={
    "de440s.bsp":"https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp",
    "gm_de440.tpc":"https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/gm_de440.tpc",
    "naif0012.tls":"https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
    "pck00011.tpc":"https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc",
    "ANEOS_forsterite_S19.txt":"https://virgodb.cosma.dur.ac.uk/swift-webstorage/EoS/ANEOS_forsterite_S19.txt",
    "ANEOS_Fe85Si15_S20.txt":"https://virgodb.cosma.dur.ac.uk/swift-webstorage/EoS/ANEOS_Fe85Si15_S20.txt",
    "NotoSansCJKsc-Regular.otf":"https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
    "FONT-LICENSE.txt":"https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/LICENSE",
}

def fetch(item):
    name,url=item
    path=data/name
    if not path.exists():
        print(f"下载 {name}",flush=True)
        urlretrieve(url,path)

with ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(fetch,urls.items()))
