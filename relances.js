/* ZéroPaperasse — relances : modèles rédigés, 100 % hors ligne.
   Aucun appel réseau, jamais. L'app ne discute avec aucun serveur. */
"use strict";

const Relance = (() => {
  const eur = n => Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const dateFR = iso => { const p = (iso || "").split("-"); return p[2] ? `${p[2]}/${p[1]}/${p[0]}` : ""; };

  const LIBELLES = { 1: "Rappel amical", 2: "Rappel ferme", 3: "Dernier avertissement" };
  const niveauFor = j => (j >= 31 ? 3 : j >= 15 ? 2 : 1);

  function template(docu, cli, cfg, niveau) {
    const mtc = eur(docu.t.ttc);
    const qui = cli && cli.contact ? ` ${cli.contact}` : "";
    const nom = cfg.nom || "notre entreprise";
    const sign = `\n\nBien cordialement,\n${nom}${cfg.tel ? "\n" + cfg.tel : ""}`;
    let sujet = "", corps = "";

    if (niveau === 1) {
      sujet = `Petit rappel — facture ${docu.num} (${mtc})`;
      corps = `Bonjour${qui},

J'espère que vous allez bien. Sauf erreur de notre part, la facture ${docu.num} d'un montant de ${mtc} TTC, émise le ${dateFR(docu.date)} et échue le ${dateFR(docu.echeance)}, ne semble pas encore réglée.

Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce message. Dans le cas contraire, vous pouvez régler par virement :

IBAN : ${cfg.iban || "(à compléter)"}

Je reste à votre disposition pour toute question.${sign}`;
    } else if (niveau === 2) {
      sujet = `Relance — facture ${docu.num} (${mtc}) échue depuis ${docu.jours_retard} jours`;
      corps = `Bonjour${qui},

Sauf règlement déjà effectué de votre côté, nous n'avons pas encore reçu le règlement de la facture ${docu.num} de ${mtc} TTC, échue le ${dateFR(docu.echeance)}, soit aujourd'hui ${docu.jours_retard} jours de retard.

Merci de procéder au règlement par virement dans les 7 jours :

IBAN : ${cfg.iban || "(à compléter)"}

Si un paiement est en cours ou si vous rencontrez une difficulté, dites-le-moi, nous trouverons une solution.${sign}`;
    } else {
      sujet = `Dernier rappel avant recouvrement — facture ${docu.num} (${mtc})`;
      corps = `Bonjour${qui},

Malgré nos précédents rappels, la facture ${docu.num} de ${mtc} TTC, échue le ${dateFR(docu.echeance)} (soit ${docu.jours_retard} jours de retard), demeure impayée à ce jour.

Nous vous rappelons que, conformément à l'article L441-10 du Code de commerce, son retard entraîne des pénalités ${cfg.penalites || "au taux directeur de la BCE majoré de 10 points"} ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement, exigibles sans rappel.

Nous vous demandons de régler la somme due sous 8 jours par virement :

IBAN : ${cfg.iban || "(à compléter)"}

À défaut, nous transmettrons le dossier à notre service de recouvrement, ce que nous souhaitons éviter.${sign}`;
    }
    return { sujet, corps };
  }

  return { LIBELLES, niveauFor, template };
})();
window.Relance = Relance;
