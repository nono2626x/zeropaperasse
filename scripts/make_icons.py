# ZéroPaperasse — génération des icônes PNG (100 % stdlib : zlib + struct, aucune dépendance)
# Dessin : feuille de papier blanche, coin plié, barres de texte, fond dégradé orange.
# Rendu par sur-échantillonnage (2x) puis rééchantillonnage -> anti-aliasing propre.
import zlib, struct, os

S = 1024  # master

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
HAUT, BAS = (251, 146, 60), (234, 88, 12)   # #FB923C -> #EA580C

def dans_rect_arrondi(x, y, cx, cy, w, h, r):
    dx = abs(x - cx) - (w / 2 - r)
    dy = abs(y - cy) - (h / 2 - r)
    if dx <= 0 or dy <= 0:
        return abs(x - cx) <= w / 2 and abs(y - cy) <= h / 2
    return dx * dx + dy * dy <= r * r

def dessiner(px, py):  # renvoie RGBA pour un point du master 1024x1024
    # fond dégradé
    col = lerp(HAUT, BAS, py / S)
    # feuille : coin haut-droit coupé (pli)
    cx, cy, w, h, r = 512, 540, 470, 620, 60
    if dans_rect_arrondi(px, py, cx, cy, w, h, r):
        coupe = (px > cx + w / 2 - 150) and (py < cy - h / 2 + 150) and \
                ((px - (cx + w / 2 - 150)) + ((cy - h / 2 + 150) - py)) > 150
        if coupe:
            # triangle du pli
            if (px - (cx + w / 2 - 150)) + ((cy - h / 2 + 150) - py) < 195:
                return (255, 214, 170, 255)
            return col + (255,)
        # barres de "texte" (alignées à gauche dans la feuille)
        x_barre = cx - w / 2 + 50
        for by, bw, bh in [(400, 260, 26), (490, 260, 26), (580, 170, 26)]:
            if dans_rect_arrondi(px, py, x_barre + bw / 2, by, bw, bh, bh / 2):
                return (229, 231, 235, 255)
        return (255, 255, 255, 255)
    return col + (255,)

def rendre():
    n = 512
    gros = [[dessiner(x, y) for x in range(0, S, 2)] for y in range(0, S, 2)]
    return gros, n

def png(gros, n):
    N = len(gros)
    stride = N / n  # rééchantillonnage à pas flottant : aucune découpe, aucun zoom
    lignes = []
    for y in range(n):
        ligne = bytearray([0])
        y0, y1 = int(y * stride), max(int(y * stride) + 1, int((y + 1) * stride))
        for x in range(n):
            x0, x1 = int(x * stride), max(int(x * stride) + 1, int((x + 1) * stride))
            rs = gs = bs = cnt = 0
            for yy in range(y0, min(y1, N)):
                rangée = gros[yy]
                for xx in range(x0, min(x1, N)):
                    p = rangée[xx]
                    rs += p[0]; gs += p[1]; bs += p[2]; cnt += 1
            ligne += bytes((rs // cnt, gs // cnt, bs // cnt, 255))
        lignes.append(bytes(ligne))
    brut = b"".join(lignes)
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(brut, 9))
            + chunk(b"IEND", b""))

os.makedirs("icons", exist_ok=True)
gros, n = rendre()
for taille in (512, 192, 180):
    with open(f"icons/icon-{taille}.png", "wb") as f:
        f.write(png(gros, taille))
    print(f"icons/icon-{taille}.png OK")
