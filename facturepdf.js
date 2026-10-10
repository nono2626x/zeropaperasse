/* ZéroPaperasse — mise en page PDF des devis et factures (conforme FR) */
"use strict";

const FacturePDF = (() => {
  const { Doc, W, H, M } = MiniPDF;
  const ORANGE = [0.96, 0.45, 0.06];   // #F97316
  const ENCRE = [0.12, 0.14, 0.18];
  const GRIS = [0.42, 0.46, 0.52];

  const eur = n => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  const dateFR = iso => { if (!iso) return ""; const [a, m, j] = iso.split("-"); return `${j}/${m}/${a}`; };

  function pdf(docu, cli, cfg) {
    const doc = new Doc();
    const devis = docu.type === "devis";
    const franchise = !!cfg.tva_franchise;
    let y = M;

    /* ---- bandeau ---- */
    doc.rect(M, y, W - 2 * M, 4, { fill: ORANGE });
    y += 26;

    /* ---- bloc entreprise (gauche) ---- */
    doc.text(M, y, cfg.nom || "Mon entreprise", { font: "helvB", size: 14 });
    y += 15;
    const lignesEnt = [
      [cfg.forme, cfg.capital && `${cfg.capital} de capital`].filter(Boolean).join(" — "),
      cfg.rcs, cfg.siret && `SIRET ${cfg.siret}`, cfg.tva_intracom && `TVA ${cfg.tva_intracom}`,
      [cfg.adresse, [cfg.cp, cfg.ville].filter(Boolean).join(" ")].filter(Boolean).join(", "),
      [cfg.tel, cfg.email].filter(Boolean).join(" · ")
    ].filter(Boolean);
    for (const l of lignesEnt) { doc.text(M, y, l, { size: 8.2, color: GRIS }); y += 10.5; }

    /* ---- bloc titre (droite) ---- */
    const titre = devis ? "DEVIS" : "FACTURE";
    const yTitre = M + 26;
    doc.monoCenter(W - M - 62, yTitre, titre, { size: 22, color: ENCRE });
    doc.text(W - M, yTitre + 26, `N° ${docu.num}`, { size: 10, font: "helvB", align: "right" });
    doc.text(W - M, yTitre + 38, `Émis le ${dateFR(docu.date)}`, { size: 8.5, color: GRIS, align: "right" });
    if (!devis && docu.echeance)
      doc.text(W - M, yTitre + 49, `À payer avant le ${dateFR(docu.echeance)}`, { size: 8.5, color: GRIS, align: "right" });

    y = Math.max(y + 8, yTitre + 66);

    /* ---- bloc client ---- */
    doc.text(M, y, devis ? "Destinataire" : "Facturé à", { size: 7.5, font: "helvB", color: ORANGE });
    y += 12;
    doc.text(M, y, cli ? cli.nom : "—", { font: "helvB", size: 11 });
    y += 13;
    for (const l of [cli && cli.contact, cli && cli.adresse, cli && [cli.cp, cli.ville].filter(Boolean).join(" "),
                     cli && cli.email].filter(Boolean)) {
      doc.text(M, y, l, { size: 8.5, color: GRIS }); y += 10.5;
    }
    y += 14;

    /* ---- tableau lignes ---- */
    const cX = { des: M, qte: 370, pu: 452, tva: 505, tot: W - M };
    const header = y;
    doc.rect(M, y, W - 2 * M, 17, { fill: [0.97, 0.96, 0.94] });
    doc.text(cX.des + 6, y + 12, "DÉSIGNATION", { size: 7.5, font: "helvB", color: GRIS });
    doc.text(cX.qte, y + 12, "QTÉ", { size: 7.5, font: "helvB", color: GRIS, align: "right" });
    doc.text(cX.pu, y + 12, "P.U. HT", { size: 7.5, font: "helvB", color: GRIS, align: "right" });
    doc.text(cX.tva, y + 12, franchise ? "" : "TVA", { size: 7.5, font: "helvB", color: GRIS, align: "right" });
    doc.text(cX.tot, y + 12, "TOTAL HT", { size: 7.5, font: "helvB", color: GRIS, align: "right" });
    y += 17;

    for (const l of docu.lignes) {
      const wrapLines = doc.wrap(l.d, cX.qte - cX.des - 18, 8.8);
      const rowH = Math.max(16, wrapLines.length * 11 + 7);
      y = doc.newPageIf(y, rowH + 10);
      if (doc.nbPages > 1 && y === M + 10) { // rejouer l'en-tête du tableau sur nouvelle page
        doc.rect(M, y, W - 2 * M, 17, { fill: [0.97, 0.96, 0.94] });
        doc.text(cX.des + 6, y + 12, "DÉSIGNATION (suite)", { size: 7.5, font: "helvB", color: GRIS });
        doc.text(cX.tot, y + 12, "TOTAL HT", { size: 7.5, font: "helvB", color: GRIS, align: "right" });
        y += 17;
      }
      wrapLines.forEach((txt, i) => doc.text(cX.des + 6, y + 11 + i * 11, txt, { size: 8.8 }));
      const remL = docu.remise ? `  (-${docu.remise} %)` : "";
      doc.mono(cX.qte, y + 11, String(l.q).replace(".", ","), { size: 8.8 });
      doc.mono(cX.pu, y + 11, eur(l.pu) + remL, { size: 8.8 });
      doc.mono(cX.tva, y + 11, franchise ? "" : (l.tva + " %"), { size: 8.8 });
      const base = ZP.round2(l.q * l.pu * (1 - docu.remise / 100));
      doc.mono(cX.tot, y + 11, eur(base), { size: 8.8 });
      doc.line(M, y + rowH, W - M, y + rowH, { color: [0.93, 0.93, 0.94], w: 0.5 });
      y += rowH;
    }
    y += 12;

    /* ---- totaux ---- */
    y = doc.newPageIf(y, 110);
    const tx = W - M - 190;
    doc.rect(tx, y, 190, (franchise ? 34 : 58 + Object.keys(docu.t.tvaMap).length * 11), { fill: [0.97, 0.97, 0.98] });
    let ty = y + 14;
    doc.text(tx + 10, ty, "Total HT", { size: 9 });
    doc.mono(tx + 180, ty, eur(docu.t.ht), { size: 9.5 }); ty += 14;
    if (!franchise) {
      for (const [taux, mont] of Object.entries(docu.t.tvaMap)) {
        doc.text(tx + 10, ty, `TVA ${Number(taux)} %`, { size: 9 });
        doc.mono(tx + 180, ty, eur(mont), { size: 9.5 }); ty += 12;
      }
    }
    doc.line(tx + 6, ty - 3, tx + 184, ty - 3, { color: ORANGE, w: 1 });
    doc.text(tx + 10, ty + 11, franchise ? "Total" : "Total TTC", { font: "helvB", size: 10.5 });
    doc.mono(tx + 180, ty + 11, eur(docu.t.ttc), { size: 11.5, color: ENCRE });
    y = ty + 30;

    /* ---- infos paiement / validité ---- */
    if (devis) {
      y = doc.newPageIf(y, 70);
      doc.text(M, y, `Devis valable ${cfg.validite_devis || 30} jours à compter de sa date d'émission.`, { size: 8.5, color: GRIS });
      y += 34;
      doc.text(M, y, "Bon pour accord (date + signature) :", { size: 8.5, color: GRIS });
      doc.rect(M, y + 6, 200, 58, { stroke: true, color: [0.85, 0.86, 0.88] });
      y += 80;
    } else {
      y = doc.newPageIf(y, 60);
      doc.text(M, y, "Règlement par virement bancaire :", { size: 8.5, font: "helvB" });
      y += 11;
      if (cfg.iban) doc.text(M, y, `IBAN ${cfg.iban}`, { font: "courB", size: 8.6 });
      else doc.text(M, y, "(IBAN à renseigner dans Réglages)", { size: 8.5, color: GRIS });
      y += 11;
      if (cfg.banque) { doc.text(M, y, cfg.banque, { size: 8.5, color: GRIS }); y += 11; }
      y += 6;
    }

    /* ---- mentions légales (bas de page, dernière page) ---- */
    const yLeg = H - 64;
    doc.line(M, yLeg - 10, W - M, yLeg - 10, { color: [0.9, 0.9, 0.92], w: 0.5 });
    let ly = yLeg + 2;
    const micro = [
      franchise ? "TVA non applicable, art. 293 B du CGI." : "",
      devis ? "" : `En cas de retard de paiement, pénalités ${cfg.penalites || "au taux directeur de la BCE majoré de 10 points"},` +
        " exigibles sans rappel, et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 du Code de commerce).",
      `${cfg.nom || ""} — SIRET ${cfg.siret || ""}${cfg.rcs ? " — " + cfg.rcs : ""}.`
    ].filter(Boolean);
    for (const l of micro) {
      for (const part of doc.wrap(l, W - 2 * M, 7)) { doc.text(M, ly, part, { size: 7, color: [0.55, 0.58, 0.62] }); ly += 8.6; }
    }

    return doc.build();
  }

  /* nom de fichier propre */
  function nomFichier(docu, cli) {
    const strip = s => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `${docu.num}_${devisOuFact(docu)}_${strip(cli && cli.nom)}.pdf`;
    function devisOuFact(d) { return d.type === "devis" ? "Devis" : "Facture"; }
  }

  return { pdf, nomFichier };
})();
window.FacturePDF = FacturePDF;
