# Mettre ZéroPaperasse en ligne — 5 minutes, gratuit

Pourquoi : en ligne + HTTPS, l'app devient installable **chez n'importe quel client** depuis Safari (« Sur l'écran d'accueil ») avec le mode hors ligne complet. Tu envoies juste un lien.

## Option A — GitHub Pages (gratuit, recommandé)

Tu as déjà `gh` (CLI GitHub) sur ce PC. Dans l'ordre :

```bash
cd "C:\Users\conspiration3001\Desktop\ZeroPaperasse"

# 1. init git (une seule fois)
git init -b main
git add -A
git commit -m "ZéroPaperasse v1.0"

# 2. créer le repo privé… non, PUBLIC (Pages gratuit l'exige) et pousser
gh repo create zeropaperasse --public --source=. --push

# 3. activer Pages
gh api repos/{owner}/zeropaperasse/pages -X POST -f "source[branch]=main" -f "source[path]=/"
# (ou : gh repo edit --enable-pages si la commande au-dessus existe déjà)
```

L'app est alors sur `https://TONPSEUDO.github.io/zeropaperasse/` — donne ce lien aux clients.

**Mise à jour** : `git add -A && git commit -m "..." && git push` (et pense à bump `zp-v1`→`zp-v2` dans `sw.js`).

## Option B — Netlify Drop (encore plus rapide, sans git)

1. Zippe le dossier (index.html, style.css, les .js, manifest, sw.js, icons/)
2. Va sur https://app.netlify.com/drop
3. Glisse le zip → URL HTTPS immédiate (ex : `zeropaperasse.netlify.app`)

## Option C — ton propre hébergement (plus tard)

N'importe quel hébergeur statique fait l'affaire : c'est un dossier de fichiers, aucun serveur requis.

---

### Après la mise en ligne : le rituel d'installation chez le client (2 min)

1. Sur son iPhone : Safari → ton lien
2. Bouton Partager → **Sur l'écran d'accueil** → Ajouter
3. Ouvrir l'app → Réglages → remplir SON entreprise (5 champs minimum : nom, SIRET, adresse, IBAN, délai)
4. Charger 2 vrais clients + 1 facture devant lui
5. Lui faire exporter une sauvegarde et te l'envoyer par mail (tu gardes une copie = service de confiance)

C'est le moment où tu dis : *« Et la première facture, vous la générez quand ? »* 😄
