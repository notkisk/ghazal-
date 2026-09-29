"""Download the edition cover images used by the demo catalog."""

from pathlib import Path
from urllib.request import Request, urlopen


COVERS = {
    "stranger.jpg": "https://cdn.salla.sa/lYqDe/a287108e-283f-46a6-8c93-58a9b518635b-664x1000-xpdWLlgI2wKiK3s9MvOJkRpab3bVfYBnoMjysZTB.jpg",
    "solitude.jpg": "https://bookfanar.com/cdn/shop/files/book-fanar_b549626e-8e5b-4144-8ace-a87822d7e55a.jpg?v=1694364187",
    "world-yesterday.jpg": "https://cdn.abjjad.com/pub/b51d3f43-4c8b-40e0-bfb1-f067e0e425f1.jpg",
    "meaning.jpg": "https://images-na.ssl-images-amazon.com/images/S/compressed.photo.goodreads.com/books/1677235728i/123002672.jpg",
    "letters.jpg": "https://cdn.salla.sa/QzppN/9154db1c-e047-46dc-a412-b8c946bc24a9-648x1000-pc23RnFQpfuLHdYZScUbuxsXbdb1SG8Jue6RXKrt.jpg",
    "orientalism.jpg": "https://daraladab.net/static/uploads/1149070361fce0277f52df29e11da0f5.jpg",
    "meditations.jpg": "https://ibharbooks.com/cdn/shop/files/153791.jpg?v=1772306713&width=1024",
    "sophies-world.jpg": "https://ibharbooks.com/cdn/shop/files/image_d3170b57-6aef-48e2-b0b0-412171e2a9f6.jpg?v=1682957143&width=1200",
    "plague.jpg": "https://ibharbooks.com/cdn/shop/files/1E36421E-EB90-4658-ADD0-1ADC0E82EE44.jpg?v=1761143642&width=2165",
    "name-of-rose.jpg": "https://internationalgroupbook.com/cdn/shop/files/international-group_661bdd07-0f86-42af-a72c-0ae3c1dc7afb.jpg?v=1703363207&width=1445",
    "art-of-loving.jpg": "https://assets.asfar.io/uploads/2024/03/24034823/the-art-of-love-erich-fromm.jpg",
    "brief-time.jpg": "https://cdn.salla.sa/qxKOd/e5zfmXqOemH12nC4RoaT9dWpzoAyrN476uYzGSWI.jpg",
}

target = Path(__file__).resolve().parents[1] / "assets" / "covers"
target.mkdir(parents=True, exist_ok=True)
errors = []
for name, url in COVERS.items():
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; GhazalBookshop/1.0)"})
    try:
        with urlopen(request, timeout=20) as response:
            data = response.read()
        (target / name).write_bytes(data)
        print(f"{name}: {len(data)} bytes")
    except Exception as error:
        print(f"FAILED {name}: {error}")
        errors.append(name)
if errors:
    raise SystemExit(f"Could not download: {', '.join(errors)}")
