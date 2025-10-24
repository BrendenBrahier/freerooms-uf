import re
from pathlib import Path

text = Path("backend/data/campus-main.js").read_text(encoding="utf-8")
urls = sorted(set(re.findall(r"https://campusmap.ufl.edu/[^\"'\\s]+", text)))
for url in urls:
    print(url)
