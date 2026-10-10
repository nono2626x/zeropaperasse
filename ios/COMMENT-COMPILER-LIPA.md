# Obtenir ZeroPaperasse.ipa — mode d'emploi complet

Ton PC Windows ne peut pas compiler d'app iPhone (il faut le Mac et Xcode d'Apple,physiquement impossible ailleurs). La solution gratuite : **les serveurs Mac de GitHub compilent pour toi** via le fichier `.github/workflows/build-ipa.yml` déjà prêt dans ce dossier. Tu récupères un fichier `ZeroPaperasse-unsigned.ipa`, et **Sideloadly le signe avec ton Apple ID** comme tu en as l'habitude.

## Étape 1 — Connecte GitHub sur ton PC (une fois)

```bash
gh auth login
```
Choisis : GitHub.com → HTTPS → **Login with a web browser** → note le code affiché, colle-le dans la page qui s'ouvre.

## Étape 2 — Crée le repo et pousse (une fois)

Dans le dossier `Desktop\ZeroPaperasse` :

```bash
git init -b main
git add -A
git commit -m "ZéroPaperasse v1.0"
gh repo create zeropaperasse --public --source=. --push
```

## Étape 3 — Récupère ton IPA (2 minutes)

1. La compilation démarre toute seule au push (elle se relance à chaque mise à jour).
2. Va sur `github.com/TONPSEUDO/zeropaperasse` → onglet **Actions** → clique le run « Compiler l'IPA iPhone ».
3. En bas de la page, **Artifacts** → télécharge **ZeroPaperasse-ipa**.
4. Dézippe : tu obtiens **ZeroPaperasse-unsigned.ipa**.

Si le run n'a pas démarré : onglet Actions → « Compiler l'IPA iPhone » → bouton **Run workflow**.

## Étape 4 — Sideloadly

1. Branche l'iPhone, ouvre **Sideloadly**
2. Glisse `ZeroPaperasse-unsigned.ipa`
3. Ton Apple ID → **Start**
4. Sur l'iPhone : Réglages → Général → VPN & gestion des appareils → fais confiance au certificat
5. L'icône **Paperasse** (feuille orange) est sur l'écran d'accueil. ✅

## À savoir (important)

- **Signature gratuite = 7 jours** : comme pour tous tes sideloads, repasse Sideloadly chaque semaine (ou installe via **SideStore/iLoader** depuis l'iPhone comme d'habitude, ça re-signifie tout seul).
- **Les données de l'app .ipa sont séparées** de celles de la version navigateur : ce que tu saisis dans l'app reste dans l'app.
- Tu ne dois **jamais** installer une IPA « ZeroPaperasse » qui ne vient pas de TON repo : celle-ci est compilée depuis tes propres fichiers, rien que toi ne peux la garantir.
- Pour mettre l'app à jour plus tard : modifie les fichiers, puis `git add -A && git commit -m "..." && git push` → l'IPA se recompile toute seule.

## L'autre installation (sans IPA, sans PC, sans signature)

Ouvre l'adresse GitHub Pages de l'app dans **Safari** → Partager → **Sur l'écran d'accueil** : icône + plein écran + hors ligne, et **rien à re-signer tous les 7 jours**. Les deux coexistent ; essaie les deux et garde ta préférée pour tes clients.
