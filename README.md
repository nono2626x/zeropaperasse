# ZéroPaperasse 🧾

**Devis, factures, relances et sauvegardes — sans y penser.**
Application 100 % mobile (iPhone & Android), 100 % locale, 100 % hors ligne. Zéro dépendance, zéro abonnement, zéro serveur.

---

## Ce que ça fait

| Module | Ce que ça rapporte |
|---|---|
| **Devis & Factures** | PDF conformes France (numérotation auto, TVA, mentions légales, IBAN), générés sur le téléphone, partageables en 1 tap (WhatsApp, mail, AirDrop…) |
| **Relances** | Détecte les factures en retard, rédige l'e-mail en 3 niveaux (amical → dernier avertissement avec indemnité 40 €) |
| **Clients** | Carnet d'adresses simple, recherche instantanée |
| **Sauvegarde** | Export/import JSON en 1 tap — les données appartiennent à l'artisan, pas à un SaaS |
| **Conformité** | Numérotation continue par année, TVA ou franchise (art. 293 B), pénalités BCE + 10 pts, indemnité forfaitaire 40 € (art. L441-10) |

## Installation sur iPhone (le geste de vente entier)

1. Ouvrir l'URL de l'app dans **Safari**
2. Bouton **Partager** → **« Sur l'écran d'accueil »**
3. C'est tout. L'icône orange est là, l'app s'ouvre en plein écran, **marche sans réseau**, rien à signer, rien qui expire au bout de 7 jours.

## Démarrage rapide (test sur PC)

Double-clic sur **`LANCER-PC.bat`** → ouvre http://localhost:8080 et affiche l'adresse à taper sur le téléphone (même WiFi).

Ou manuellement :
```
cd ZeroPaperasse
python -m http.server 8080 --bind 0.0.0.0
```

## Mise en ligne gratuite (5 minutes, HTTPS obligatoire pour le mode hors ligne complet)

Voir **DEPLOY.md** — GitHub Pages gratuit, l'app devient accessible partout : `https://toncompte.github.io/zeropaperasse`.

## Auto-test intégré

Ouvre `http://…/?selftest=1` : l'application se teste toute seule (14 vérifications : calculs, numérotation, retards, PDF, relances, export/import) puis restaure tes données. Si tout est vert, l'app est saine.

## Structure

```
index.html          l'application (une seule page)
style.css           thème mobile (iPhone d'abord)
store.js            données locales + calculs métier
pdf.js              générateur PDF maison (0 dépendance, accents FR)
facturepdf.js       mise en page devis/factures conforme FR
relances.js         relances : modèles rédigés, 100 % hors ligne
sw.js + manifest    mode hors ligne (PWA installable)
icons/              icônes générées par scripts/make_icons.py (Python pur)
LANCER-PC.bat       serveur local en 1 double-clic
GUIDE-VENTE.md      ton plan commercial complet
pitch.html          page imprimable à montrer aux artisans
```

## Réglages après modification d'un fichier

Le mode hors ligne met les fichiers en cache. Après avoir modifié le code, **incrémente `CACHE = "zp-v1"` → `zp-v2"` dans `sw.js`**, sinon les téléphones déjà installés gardent l'ancienne version.

## Données & vie privée

Tout vit dans le `localStorage` du navigateur du téléphone. **L'app n'appelle aucun serveur, jamais** : pas de compte, pas de tracker, pas de connexion requise. L'export JSON est l'assurance-vie de l'artisan.

## Version iPhone installable (.ipa pour Sideloadly)

Le dossier `ios/` contient le wrapper iPhone (WKWebView) et `.github/workflows/build-ipa.yml` fait **compiler l'IPA gratuitement par les serveurs Mac de GitHub**. Mode d'emploi complet : `ios/COMMENT-COMPILER-LIPA.md`.

---
v1.0 — octobre 2026 — conçu pour être vendu à des artisans et PME locales.
