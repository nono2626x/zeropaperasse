/* ZéroPaperasse — interface (mobile d'abord) + auto-test intégré */
"use strict";

window.__zpErrors = [];
window.addEventListener("error", e => window.__zpErrors.push(String(e.message || e)));
window.addEventListener("unhandledrejection", e => window.__zpErrors.push("Promesse: " + String(e.reason)));

(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  let Vue = "accueil";
  let Segment = "facture";
  let apresClient = null;        // réouvrir le formulaire de document après création client
  const blobs = new Set();       // object URLs à révoquer

  /* ---------- formatage ---------- */
  const eur = n => Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const dateFR = iso => { const p = (iso || "").split("-"); return p[2] ? `${p[2]}/${p[1]}/${p[0]}` : "—"; };
  const fmtTemps = m => m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")}` : `${m} min`;
  const echap = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initiales = nom => (nom || "?").split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase();

  function chipStatut(statut) {
    const cls = { "payée": "payée", "accepté": "payée", "refusé": "retard", "retard": "retard", "envoyée": "envoyée", "envoyé": "envoyée", "à envoyer": "a-envoyer" }[statut] || "neutre";
    return `<span class="chip ${cls}">${echap(statut)}</span>`;
  }

  /* ---------- toast ---------- */
  let toastT = 0;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2400);
  }

  /* ---------- confirmation intégrée (les dialogues natifs sont bloqués
     dans les apps iPhone : on fait notre propre modale, plus jolie en plus) ---------- */
  function confirmer(titre, message, opts = {}) {
    return new Promise(resoudre => {
      const fond = document.createElement("div");
      fond.className = "confirm-fond";
      fond.innerHTML = `<div class="confirm-carte" role="dialog" aria-modal="true">
        <h3>${echap(titre)}</h3><p>${echap(message)}</p>
        <div class="séparé" style="margin-top:16px">
          <button class="btn neutre" data-c="0">Annuler</button>
          <button class="btn ${opts.danger ? "danger" : "primaire"}" data-c="1">${echap(opts.ok || "Confirmer")}</button>
        </div></div>`;
      document.body.appendChild(fond);
      requestAnimationFrame(() => fond.classList.add("on"));
      const fin = rep => { fond.classList.remove("on"); setTimeout(() => fond.remove(), 180); resoudre(!!rep); };
      fond.querySelector("[data-c='1']").addEventListener("click", () => fin(true));
      fond.querySelector("[data-c='0']").addEventListener("click", () => fin(false));
    });
  }

  /* ---------- feuille modale ---------- */
  function ouvrirSheet(titre, html) {
    $("#sheet-title").textContent = titre;
    $("#sheet-body").innerHTML = html;
    $("#sheet-root").hidden = false;
  }
  function fermerSheet() {
    $("#sheet-root").hidden = true;
    $("#sheet-body").innerHTML = "";
    for (const u of blobs) URL.revokeObjectURL(u); blobs.clear();
    rendre();
  }
  $("#sheet-close").addEventListener("click", fermerSheet);
  $("#sheet-backdrop").addEventListener("click", fermerSheet);

  /* ---------- pont vers l'app iPhone (native) ---------- */
  const pontNatif = () => !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.zp);
  const envoyerNatif = (action, nom, data) =>
    window.webkit.messageHandlers.zp.postMessage(JSON.stringify({ action, nom, data }));
  const versBase64 = blob => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1]);
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });

  /* ---------- aperçu PDF ---------- */
  function apercuPDF(docu) {
    const cli = ZP.client(docu.client_id);
    let blob;
    try { blob = FacturePDF.pdf(docu, cli, ZP.settings()); }
    catch (e) { toast("Erreur PDF : " + e.message); return; }
    const url = URL.createObjectURL(blob); blobs.add(url);
    const nom = FacturePDF.nomFichier(docu, cli);
    const devis = docu.type === "devis";
    ouvrirSheet(`${docu.num} — ${docu.t.ttc.toFixed(2)} €`, `
      <iframe id="apercu-cadre" src="${url}" title="Aperçu"></iframe>
      <div class="actions" style="margin-top:12px">
        <button class="btn primaire" id="btn-partager">Partager / Enregistrer</button>
        <button class="btn neutre" id="btn-ouvrir">Ouvrir</button>
        ${devis && docu.statut !== "accepté" ? `<button class="btn secondaire" id="btn-convertir">✓ Accepté → facturer</button>` : ""}
      </div>
      <p class="aide">${echap(nom)}</p>
    `);
    $("#btn-partager").addEventListener("click", () => partagerPDF(blob, nom));
    const bo = $("#btn-ouvrir");
    if (pontNatif()) bo.remove(); // en natif, la feuille de partage iOS fait tout
    else bo.addEventListener("click", () => window.open(url, "_blank"));
    const cv = $("#btn-convertir");
    if (cv) cv.addEventListener("click", () => {
      try {
        const f = ZP.devisVersFacture(docu.num);
        toast(`Facture ${f.num} créée ✓`);
        apercuPDF(f);
      } catch (e) { toast(e.message); }
    });
  }

  async function partagerPDF(blob, nom) {
    // app iPhone : feuille de partage iOS native (WhatsApp, mail, Fichiers, impression…)
    if (pontNatif()) {
      try { envoyerNatif("partage", nom, await versBase64(blob)); }
      catch (e) { toast("Partage impossible : " + e.message); }
      return;
    }
    try {
      const fichier = new File([blob], nom, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: nom });
        return;
      }
      throw new Error("pas de partage");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      const u = URL.createObjectURL(blob); blobs.add(u); window.open(u, "_blank");
    }
  }

  /* ================= VUES ================= */

  function rendre() {
    $$("#tabbar .tab").forEach(b => b.classList.toggle("on", b.dataset.v === Vue));
    $("#bizname").textContent = ZP.settings().nom || "";
    const v = $("#view");
    if (Vue === "accueil") vAccueil(v);
    else if (Vue === "clients") vClients(v);
    else if (Vue === "documents") vDocuments(v);
    else if (Vue === "relances") vRelances(v);
    else vReglages(v);
  }
  const fabHTML = action => `<button class="fab" id="fab" aria-label="Ajouter" data-action="${action}">+</button>`;

  /* ---- accueil ---- */
  function vAccueil(v) {
    const cfg = ZP.settings(), d = ZP.dashboard();
    const hh = new Date().getHours();
    const salut = hh >= 18 || hh < 5 ? "Bonsoir" : "Bonjour";
    let h = `<div class="col">`;
    if (!cfg.nom) {
      h += `<div class="carte" style="background:linear-gradient(135deg,#ffedd5,#fff7ed)">
        <h1 class="vue">Bienvenue 👋</h1>
        <p class="sous">Devis, factures et relances — tout se passe sur ce téléphone, même sans réseau.</p>
        <div class="séparé">
          <button class="btn primaire" id="bienvenue-demo">Voir la démo</button>
          <button class="btn secondaire" id="bienvenue-reglages">Mon entreprise</button>
        </div></div>`;
    } else {
      h += `<div class="hero">
        <div class="hero-haut"><span>${salut} 👋</span><b>${echap(cfg.nom)}</b></div>
        <div class="hero-n">${eur(d.aEncaisser)}</div>
        <div class="hero-l">${d.nbRetards ? `${d.nbRetards} facture${d.nbRetards > 1 ? "s" : ""} en retard — à récupérer` : "tout est à jour ✓"}</div>
      </div>`;
    }
    h += `<div class="grille-stats">
      <div class="stat"><div class="n">${eur(d.caMois)}</div><div class="l">facturé ce mois</div></div>
      <div class="stat"><div class="n">${d.nbDocs}</div><div class="l">documents</div></div>
      <div class="stat ${d.nbRetards ? "alerte" : "ok"}"><div class="n">${d.nbRetards}</div><div class="l">en retard</div></div>
      <div class="stat"><div class="n">${fmtTemps(d.minutes)}</div><div class="l">temps gagné</div></div>
    </div>`;
    if (d.nbRetards) {
      h += `<div class="bande-alerte"><span>⚠️</span><div><b>${d.nbRetards} facture(s) en retard</b> — ${eur(d.enRetard)} à récupérer</div>
        <button class="btn danger mini" style="margin-left:auto" id="go-relances">Relancer</button></div>`;
    }
    const derniers = ZP.docs().slice(0, 5);
    h += `<h1 class="vue" style="font-size:16px;margin:14px 0 10px">Derniers documents</h1>`;
    h += derniers.length ? derniers.map(itemDoc).join("")
      : `<div class="vide"><div class="g">🧾</div>Aucun document pour l'instant.<br>Touche <b>+</b> pour créer ton premier devis.</div>`;
    h += `</div>` + fabHTML("document");
    v.innerHTML = h;

    const bd = $("#bienvenue-demo");
    if (bd) bd.addEventListener("click", async () => {
      if (ZP.docs().length || ZP.clients().length) {
        if (!await confirmer("Charger la démo", "Cela remplacera les données actuelles par l'exemple « Plomberie Durand ».")) return;
      }
      ZP.chargerDemo(); toast("Démo chargée ✓"); rendre();
    });
    const br = $("#bienvenue-reglages");
    if (br) br.addEventListener("click", () => { Vue = "reglages"; rendre(); });
    const gr = $("#go-relances");
    if (gr) gr.addEventListener("click", () => { Vue = "relances"; rendre(); });
  }

  /* ---- clients ---- */
  function vClients(v) {
    const q = (v.dataset.q || "").toLowerCase();
    const liste = ZP.clients().filter(c => !q || (c.nom + " " + c.contact + " " + c.ville).toLowerCase().includes(q));
    let h = `<div class="col"><h1 class="vue">Clients</h1>
      <p class="sous">${ZP.clients().length} client(s) enregistré(s) sur ce téléphone</p>
      <input class="champ-input recherche" id="rech-client" placeholder="Rechercher…" value="${echap(v.dataset.q || "")}">
      ${liste.length ? liste.map(c => `
        <div class="item" data-cli="${c.id}">
          <div class="ico">${echap(initiales(c.nom))}</div>
          <div class="milieu"><div class="titre">${echap(c.nom)}</div>
          <div class="sous">${echap([c.contact, c.tel, c.ville].filter(Boolean).join(" · ") || "—")}</div></div>
          <div class="droite"><button class="btn neutre mini" data-edit="${c.id}">Modifier</button></div>
        </div>`).join("")
      : `<div class="vide"><div class="g">🤝</div>${q ? "Aucun résultat." : "Pas encore de client.<br>Touche <b>+</b> pour ajouter le premier."}</div>`}
      </div>` + fabHTML("client");
    v.innerHTML = h;
    const r = $("#rech-client");
    r.addEventListener("input", () => { v.dataset.q = r.value; clearTimeout(r._t); r._t = setTimeout(() => vClients(v), 250); });
    $$("[data-edit]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); formClient(b.dataset.edit); }));
    $$("[data-cli]").forEach(it => it.addEventListener("click", () => formClient(it.dataset.cli)));
  }

  function formClient(id) {
    const c = id ? ZP.client(id) : null;
    ouvrirSheet(c ? "Modifier le client" : "Nouveau client", `
      <div class="champ"><label>Nom / raison sociale *</label><input id="c-nom" value="${echap(c?.nom)}" placeholder="Ex : Mairie de Saint-Rémy"></div>
      <div class="champ"><label>Contact (personne à qui écrire)</label><input id="c-contact" value="${echap(c?.contact)}" placeholder="Ex : Mme Fabre"></div>
      <div class="champ"><label>E-mail (pour les relances)</label><input id="c-email" type="email" value="${echap(c?.email)}"></div>
      <div class="champ"><label>Téléphone</label><input id="c-tel" inputmode="tel" value="${echap(c?.tel)}"></div>
      <div class="champ"><label>Adresse</label><input id="c-adresse" value="${echap(c?.adresse)}"></div>
      <div class="champ"><div class="deux">
        <div><label>Code postal</label><input id="c-cp" inputmode="numeric" value="${echap(c?.cp)}"></div>
        <div><label>Ville</label><input id="c-ville" value="${echap(c?.ville)}"></div>
      </div></div>
      <button class="btn primaire large" id="c-save">Enregistrer</button>
      ${c ? `<button class="btn danger large" style="margin-top:10px" id="c-del">Supprimer ce client</button>` : ""}
    `);
    $("#c-save").addEventListener("click", () => {
      const donnees = { nom: $("#c-nom").value, contact: $("#c-contact").value, email: $("#c-email").value,
        tel: $("#c-tel").value, adresse: $("#c-adresse").value, cp: $("#c-cp").value, ville: $("#c-ville").value };
      try {
        if (c) { ZP.updClient(c.id, donnees); toast("Client modifié ✓"); }
        else { ZP.addClient(donnees); toast("Client ajouté ✓"); }
        if (apresClient) { const f = apresClient; apresClient = null; f(); }
        else fermerSheet();
      } catch (e) { toast(e.message); }
    });
    const dl = $("#c-del");
    if (dl) dl.addEventListener("click", async () => {
      if (await confirmer("Supprimer ce client ?", "Cette action est définitive.", { danger: true, ok: "Supprimer" })) {
        try { ZP.delClient(c.id); toast("Client supprimé"); fermerSheet(); } catch (e) { toast(e.message); }
      }
    });
  }

  /* ---- documents ---- */
  function itemDoc(x) {
    const cli = ZP.client(x.client_id);
    const retard = x.type === "facture" && x.statut !== "payée" && x.echeance && x.echeance < ZP.todayISO();
    return `<div class="item" data-doc="${x.num}">
      <div class="ico">${x.type === "devis" ? "D" : "F"}</div>
      <div class="milieu"><div class="titre">${x.num} — ${echap(cli ? cli.nom : "client supprimé")}</div>
        <div class="sous">${x.type === "devis" ? `Devis du ${dateFR(x.date)}` : `Échéance ${dateFR(x.echeance)}`}</div>
        <div class="actions">${chipStatut(retard ? "retard" : x.statut)}</div></div>
      <div class="droite"><div class="montant">${eur(x.t.ttc)}</div></div>
    </div>`;
  }

  function vDocuments(v) {
    let liste = ZP.docs();
    if (Segment === "facture") liste = liste.filter(x => x.type === "facture");
    if (Segment === "devis") liste = liste.filter(x => x.type === "devis");
    let h = `<div class="col"><h1 class="vue">Documents</h1><p class="sous">Devis et factures, numérotés automatiquement</p>
      <div class="segmente">
        ${["facture", "devis", "tout"].map(s => `<button class="${Segment === s ? "on" : ""}" data-seg="${s}">${s === "tout" ? "Tous" : s + "s"}</button>`).join("")}
      </div>
      ${liste.length ? liste.map(itemDoc).join("")
        : `<div class="vide"><div class="g">🧾</div>Rien ici.<br>Touche <b>+</b> pour créer ${Segment === "devis" ? "un devis" : "une facture"}.</div>`}
      </div>` + fabHTML("document");
    v.innerHTML = h;
    $$("[data-seg]").forEach(b => b.addEventListener("click", () => { Segment = b.dataset.seg; rendre(); }));
    $$("[data-doc]").forEach(it => it.addEventListener("click", () => apercuPDF(ZP.doc(it.dataset.doc))));
  }

  function formDocument() {
    const cfg = ZP.settings();
    if (!ZP.clients().length) {
      confirmer("Pas encore de client", "Pour créer un document, il faut d'abord un client. On l'ajoute maintenant ?", { ok: "Ajouter" })
        .then(oui => {
          if (!oui) return;
          apresClient = formDocument; Vue = "clients"; rendre(); formClient(null);
        });
      return;
    }
    const today = ZP.todayISO();
    const lignes = [{ d: "", q: 1, pu: "", tva: cfg.tva_defaut }];
    ouvrirSheet("Nouveau document", `
      <div class="séparé" style="margin-bottom:12px">
        <button class="btn primaire mini" data-type="facture" style="flex:1">Facture</button>
        <button class="btn neutre mini" data-type="devis" style="flex:1">Devis</button>
      </div>
      <div class="champ"><label>Client</label><select id="d-client">
        ${ZP.clients().map(c => `<option value="${c.id}">${echap(c.nom)}</option>`).join("")}</select></div>
      <div class="champ"><div class="deux">
        <div><label>Date</label><input id="d-date" type="date" value="${today}"></div>
        <div id="bloc-ech"><label>Échéance</label><input id="d-echeance" type="date" value="${ZP.isoPlus(today, Number(cfg.delai_paiement) || 30)}"></div>
      </div></div>
      <div class="champ"><label>Lignes</label>
        <div class="rangée-lignes entêtes"><span>Désignation</span><span>Qté</span><span>P.U. HT</span><span>TVA %</span><span></span></div>
        <div id="lignes"></div>
        <button class="btn neutre mini" id="aj-ligne" style="margin-top:6px">+ Ajouter une ligne</button>
      </div>
      <div class="champ"><label>Remise globale (%)</label><input id="d-remise" inputmode="decimal" value="0"></div>
      <div class="carte" style="box-shadow:none;border:1.5px dashed var(--ligne)" id="totaux"></div>
      <button class="btn primaire large" id="d-save">Enregistrer & générer le PDF</button>
    `);

    let type = "facture";
    const majType = () => {
      $$("[data-type]").forEach(b => b.className = `btn ${b.dataset.type === type ? "primaire" : "neutre"} mini`);
      $("#bloc-ech").style.display = type === "facture" ? "" : "none";
    };
    $$("[data-type]").forEach(b => b.addEventListener("click", () => { type = b.dataset.type; majType(); }));

    function lireLignes() {
      return $$("#lignes .rangée-lignes").map(r => ({
        d: r.querySelector(".l-d").value,
        q: parseFloat(r.querySelector(".l-q").value.replace(",", ".")) || 0,
        pu: parseFloat(r.querySelector(".l-pu").value.replace(",", ".")) || 0,
        tva: parseFloat(r.querySelector(".l-tva").value.replace(",", ".")) || 0
      }));
    }
    function majTotaux() {
      const t = ZP.totals(lireLignes(), parseFloat($("#d-remise").value.replace(",", ".")) || 0, cfg.tva_franchise);
      $("#totaux").innerHTML = cfg.tva_franchise
        ? `<div class="total-ligne fort"><span>Total</span><span>${eur(t.ttc)}</span></div><p class="aide">TVA non applicable, art. 293 B du CGI.</p>`
        : `<div class="total-ligne"><span>Total HT</span><span>${eur(t.ht)}</span></div>
           ${Object.entries(t.tvaMap).map(([tx, m]) => `<div class="total-ligne"><span>TVA ${Number(tx)} %</span><span>${eur(m)}</span></div>`).join("")}
           <div class="total-ligne fort"><span>Total TTC</span><span>${eur(t.ttc)}</span></div>`;
    }
    function addLigneRow(l) {
      const r = document.createElement("div");
      r.className = "rangée-lignes";
      r.innerHTML = `<input class="l-d" placeholder="Ex : Déplacement, pose…" value="${echap(l.d)}">
        <input class="l-q" inputmode="decimal" value="${l.q}">
        <input class="l-pu" inputmode="decimal" value="${l.pu}">
        <input class="l-tva" inputmode="decimal" value="${l.tva}">
        <button class="suppr" aria-label="Supprimer">✕</button>`;
      r.querySelector(".suppr").addEventListener("click", () => { r.remove(); majTotaux(); });
      r.addEventListener("input", majTotaux);
      $("#lignes").appendChild(r);
    }
    addLigneRow(lignes[0]);
    $("#aj-ligne").addEventListener("click", () => { addLigneRow({ d: "", q: 1, pu: "", tva: cfg.tva_defaut }); });
    $("#d-remise").addEventListener("input", majTotaux);
    majType(); majTotaux();

    $("#d-save").addEventListener("click", () => {
      try {
        const docu = ZP.addDoc({
          type, client_id: $("#d-client").value,
          date: $("#d-date").value || today,
          echeance: type === "facture" ? ($("#d-echeance").value || "") : "",
          remise: parseFloat($("#d-remise").value.replace(",", ".")) || 0,
          lignes: lireLignes()
        });
        toast(`${docu.num} créé ✓`);
        apercuPDF(docu);
      } catch (e) { toast(e.message); }
    });
  }

  /* ---- relances ---- */
  function vRelances(v) {
    const ret = ZP.retards(), cfg = ZP.settings();
    let h = `<div class="col"><h1 class="vue">Relances</h1>
      <p class="sous">Factures échues, triées de la plus urgente à la moins urgente</p>`;
    if (!ret.length) {
      h += `<div class="vide"><div class="g">🎉</div>Aucun retard.<br>Tout est à jour, profite.</div></div>`;
      v.innerHTML = h; return;
    }
    h += ret.map(x => {
      const cli = ZP.client(x.client_id);
      const niv = Relance.niveauFor(x.jours_retard);
      return `<div class="item" data-rel="${x.num}">
        <div class="ico">${echap(initiales(cli ? cli.nom : "?"))}</div>
        <div class="milieu"><div class="titre">${x.num} — ${echap(cli ? cli.nom : "?")}</div>
          <div class="sous">échue le ${dateFR(x.echeance)}</div>
          <div class="actions"><span class="chip n${niv}">${Relance.LIBELLES[niv]} · ${x.jours_retard} j</span></div></div>
        <div class="droite"><div class="montant">${eur(x.t.ttc)}</div>
          <button class="btn secondaire mini" style="margin-top:6px" data-rediger="${x.num}">Rédiger</button></div>
      </div>`;
    }).join("") + `</div>`;
    v.innerHTML = h;
    $$("[data-rediger]").forEach(b => b.addEventListener("click", e => { e.stopPropagation(); formRelance(b.dataset.rediger); }));
  }

  function formRelance(num, niveauForce) {
    const docu = ZP.doc(num), cli = ZP.client(docu.client_id), cfg = ZP.settings();
    const jours = docu.jours_retard ?? Math.max(1, Math.round((new Date(ZP.todayISO()) - new Date(docu.echeance)) / 86400000));
    docu.jours_retard = jours;
    const niveau = niveauForce || Relance.niveauFor(jours);
    ouvrirSheet(`Relance ${num}`, `
      <div class="séparé" style="margin-bottom:10px">
        ${[1, 2, 3].map(n => `<button class="btn ${n === niveau ? "primaire" : "neutre"} mini" data-niv="${n}" style="flex:1">${["Amical", "Ferme", "Dernier"][n - 1]}</button>`).join("")}
      </div>
      <div class="champ"><label>Objet</label><input id="r-sujet"></div>
      <div class="champ"><label>Message</label><textarea id="r-corps" rows="12"></textarea></div>
      <p class="aide" id="r-source"></p>
      <div class="séparé">
        <button class="btn neutre" id="r-copier">Copier</button>
        <button class="btn primaire" id="r-mail">✉️ Envoyer</button>
      </div>
    `);
    let niveauCourant = niveau;
    function generer() {
      const res = Relance.template(docu, cli, cfg, niveauCourant);
      $("#r-sujet").value = res.sujet; $("#r-corps").value = res.corps;
      $("#r-source").textContent = "Modèle prêt à l'emploi — tu peux le modifier avant d'envoyer.";
      ZP.bumpRelances();
    }
    $$("[data-niv]").forEach(b => b.addEventListener("click", () => {
      niveauCourant = Number(b.dataset.niv);
      $$("[data-niv]").forEach(x => x.className = `btn ${Number(x.dataset.niv) === niveauCourant ? "primaire" : "neutre"} mini`);
      generer();
    }));
    $("#r-copier").addEventListener("click", async () => {
      const txt = `${$("#r-sujet").value}\n\n${$("#r-corps").value}`;
      try { await navigator.clipboard.writeText(txt); toast("Copié ✓"); }
      catch { $("#r-corps").select(); document.execCommand("copy"); toast("Copié ✓"); }
    });
    $("#r-mail").addEventListener("click", () => {
      const sujet = encodeURIComponent($("#r-sujet").value);
      const corps = encodeURIComponent($("#r-corps").value);
      const dest = cli && cli.email ? cli.email : "";
      window.location.href = `mailto:${dest}?subject=${sujet}&body=${corps}`;
    });
    generer();
  }

  /* ---- réglages ---- */
  function vReglages(v) {
    const c = ZP.settings();
    const f = (id, label, val, type = "text", ph = "") =>
      `<div class="champ"><label>${label}</label><input id="${id}" type="${type}" value="${echap(val)}" placeholder="${ph}"></div>`;
    v.innerHTML = `<div class="col">
      <h1 class="vue">Réglages</h1><p class="sous">Ton entreprise, tes règles — tout reste sur ce téléphone</p>

      <div class="carte"><h2 style="font-size:15px;margin:0 0 10px">🏢 Mon entreprise</h2>
        <div class="champ"><label>Nom / raison sociale</label><input id="s-nom" value="${echap(c.nom)}" placeholder="Ex : Plomberie Durand"></div>
        <div class="champ"><div class="deux">
          <div><label>Forme juridique</label><input id="s-forme" value="${echap(c.forme)}" placeholder="SASU, EURL…"></div>
          <div><label>Capital</label><input id="s-capital" value="${echap(c.capital)}" placeholder="5 000 €"></div>
        </div></div>
        <div class="champ"><div class="deux">
          <div><label>RCS</label><input id="s-rcs" value="${echap(c.rcs)}" placeholder="RCS Lyon 812…"></div>
          <div><label>SIRET</label><input id="s-siret" value="${echap(c.siret)}"></div>
        </div></div>
        <div class="champ"><label>N° TVA intracom. (si applicable)</label><input id="s-tva-intracom" value="${echap(c.tva_intracom)}"></div>
        <div class="champ"><label>Adresse</label><input id="s-adresse" value="${echap(c.adresse)}"></div>
        <div class="champ"><div class="deux">
          <div><label>Code postal</label><input id="s-cp" inputmode="numeric" value="${echap(c.cp)}"></div>
          <div><label>Ville</label><input id="s-ville" value="${echap(c.ville)}"></div>
        </div></div>
        <div class="champ"><div class="deux">
          <div><label>Téléphone</label><input id="s-tel" inputmode="tel" value="${echap(c.tel)}"></div>
          <div><label>E-mail</label><input id="s-email" type="email" value="${echap(c.email)}"></div>
        </div></div>
      </div>

      <div class="carte"><h2 style="font-size:15px;margin:0 0 10px">🧾 Facturation</h2>
        <div class="switch"><span>Franchise en base de TVA<br><span class="aide">Affiche « TVA non applicable, art. 293 B du CGI »</span></span>
          <input type="checkbox" id="s-franchise" ${c.tva_franchise ? "checked" : ""}></div>
        <div class="champ"><div class="deux">
          <div><label>TVA par défaut (%)</label><input id="s-tva-defaut" inputmode="decimal" value="${c.tva_defaut}"></div>
          <div><label>Délai de paiement (jours)</label><input id="s-delai" inputmode="numeric" value="${c.delai_paiement}"></div>
        </div></div>
        <div class="champ"><label>Validité des devis (jours)</label><input id="s-validite" inputmode="numeric" value="${c.validite_devis}"></div>
        <div class="champ"><label>IBAN</label><input id="s-iban" value="${echap(c.iban)}" placeholder="FR76 …"></div>
        <div class="champ"><label>Banque</label><input id="s-banque" value="${echap(c.banque)}"></div>
      </div>

      <button class="btn primaire large" id="s-save">Enregistrer les réglages</button>

      <div class="carte" style="margin-top:16px"><h2 style="font-size:15px;margin:0 0 10px">💾 Mes données</h2>
        <div class="séparé">
          <button class="btn secondaire" id="s-export">Exporter</button>
          <button class="btn neutre" id="s-import">Importer</button>
        </div>
        <input type="file" id="s-fichier" accept=".json,application/json" hidden>
        <p class="aide">L'export est ton assurance-vie : un fichier JSON avec tout dedans, à garder quelque part de sûr (e-mail, Drive…).</p>
        <div class="séparé" style="margin-top:8px">
          <button class="btn neutre mini" id="s-demo">Charger la démo</button>
          <button class="btn danger mini" id="s-reset">Tout effacer</button>
        </div>
      </div>
      <p class="aide" style="text-align:center">ZéroPaperasse v1.3 — données 100 % locales, fonctionne hors ligne, aucun serveur contacté.</p>
    </div>`;

    $("#s-save").addEventListener("click", () => {
      try {
        ZP.setSettings({
          nom: $("#s-nom").value.trim(), forme: $("#s-forme").value.trim(), capital: $("#s-capital").value.trim(),
          rcs: $("#s-rcs").value.trim(), siret: $("#s-siret").value.trim(), tva_intracom: $("#s-tva-intracom").value.trim(),
          adresse: $("#s-adresse").value.trim(), cp: $("#s-cp").value.trim(), ville: $("#s-ville").value.trim(),
          tel: $("#s-tel").value.trim(), email: $("#s-email").value.trim(),
          tva_franchise: $("#s-franchise").checked,
          tva_defaut: parseFloat($("#s-tva-defaut").value.replace(",", ".")) || 0,
          delai_paiement: parseInt($("#s-delai").value) || 30,
          validite_devis: parseInt($("#s-validite").value) || 30,
          iban: $("#s-iban").value.trim(), banque: $("#s-banque").value.trim()
        });
        toast("Réglages enregistrés ✓"); rendre();
      } catch (e) { toast("Erreur : " + e.message); }
    });
    $("#s-export").addEventListener("click", async () => {
      const json = ZP.exportJSON();
      const nomFichier = `zeropaperasse-sauvegarde-${ZP.todayISO()}.json`;
      if (pontNatif()) { // app iPhone : la sauvegarde part dans la feuille de partage iOS
        const blob = new Blob([json], { type: "application/json" });
        envoyerNatif("partage", nomFichier, await versBase64(blob));
        toast("Choisis où enregistrer ✓");
        return;
      }
      const blob = new Blob([json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); blobs.add(a.href);
      a.download = nomFichier;
      a.click(); toast("Sauvegarde exportée ✓");
    });
    $("#s-import").addEventListener("click", () => $("#s-fichier").click());
    $("#s-fichier").addEventListener("change", e => {
      const f = e.target.files[0]; if (!f) return;
      const fr = new FileReader();
      fr.onload = async () => {
        if (!await confirmer("Importer la sauvegarde", "Cela remplacera toutes les données actuelles par celles du fichier.", { ok: "Importer" })) return;
        try { ZP.importJSON(String(fr.result)); toast("Sauvegarde importée ✓"); rendre(); }
        catch (err) { toast("Fichier invalide : " + err.message); }
      };
      fr.readAsText(f);
    });
    $("#s-demo").addEventListener("click", async () => {
      if (ZP.docs().length || ZP.clients().length) {
        if (!await confirmer("Charger la démo", "Cela remplacera les données actuelles par l'exemple « Plomberie Durand ».")) return;
      }
      ZP.chargerDemo(); toast("Démo chargée ✓"); Vue = "accueil"; rendre();
    });
    $("#s-reset").addEventListener("click", async () => {
      if (!await confirmer("Tout effacer ?", "Clients, documents et réglages seront supprimés.", { danger: true, ok: "Tout effacer" })) return;
      if (!await confirmer("Dernière chance", "Tu as bien pensé à exporter ta sauvegarde avant ?", { danger: true, ok: "Oui, tout effacer" })) return;
      ZP.resetAll(); toast("Tout est effacé"); Vue = "accueil"; rendre();
    });
  }

  /* ---------- navigation ---------- */
  $$("#tabbar .tab").forEach(b => b.addEventListener("click", () => { Vue = b.dataset.v; rendre(); }));
  document.addEventListener("click", e => {
    const fab = e.target.closest("#fab");
    if (!fab) return;
    if (fab.dataset.action === "client") formClient(null);
    else formDocument();
  });

  /* ---------- service worker (hors ligne, en HTTPS/localhost) ---------- */
  if ("serviceWorker" in navigator && (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  /* ---------- auto-test ---------- */
  async function selftest() {
    const KEY = "zp_data_v1";
    const sauvegarde = localStorage.getItem(KEY);
    const res = []; const ok = (nom, cond, info = "") => res.push({ nom, ok: !!cond, info: String(info).slice(0, 120) });
    const etape = async (nom, fn) => { try { const r = await fn(); ok(nom, r === undefined || r === true, r === false ? "échec" : ""); } catch (e) { ok(nom, false, e.message); } };

    ZP.resetAll();
    await etape("Réglages enregistrés", () => { ZP.setSettings({ nom: "Test Plomberie", siret: "812 345 678 00019", tva_franchise: false, delai_paiement: 30, iban: "FR76 TEST" }); return ZP.settings().nom === "Test Plomberie"; });
    await etape("Client ajouté", () => { ZP.addClient({ nom: "Client Test", email: "t@t.fr" }); return ZP.clients().length === 1; });
    const cli = ZP.clients()[0];
    let devis, facture;
    await etape("Devis créé + numérotation", () => { devis = ZP.addDoc({ type: "devis", client_id: cli.id, lignes: [{ d: "Pose robinet", q: 2, pu: 100, tva: 20 }, { d: "Déplacement", q: 1, pu: 50.5, tva: 20 }] }); return devis.num.startsWith("D20"); });
    await etape("Totaux devis exacts (TTC 300,60)", () => Math.abs(devis.t.ttc - 300.6) < 0.001);
    const hier31 = ZP.isoPlus(ZP.todayISO(), -31);
    await etape("Facture créée + retard détecté", () => { facture = ZP.addDoc({ type: "facture", client_id: cli.id, date: hier31, echeance: hier31, lignes: [{ d: "Réparation", q: 1, pu: 240, tva: 20 }] }); const r = ZP.retards(); return r.length === 1 && r[0].jours_retard === 31; });
    await etape("Remise 10 % : HT 90 / TVA 18 / TTC 108", () => { const t = ZP.totals([{ d: "x", q: 1, pu: 100, tva: 20 }], 10, false); return t.ht === 90 && t.tvaTotal === 18 && t.ttc === 108; });
    await etape("Franchise TVA : TTC = HT", () => { const t = ZP.totals([{ d: "x", q: 1, pu: 100, tva: 20 }], 0, true); return t.ttc === 100 && t.tvaTotal === 0; });
    await etape("PDF devis généré", () => { const b = FacturePDF.pdf(devis, cli, ZP.settings()); return b.size > 800; });
    await etape("PDF facture + nom de fichier", () => { const b = FacturePDF.pdf(facture, cli, ZP.settings()); const n = FacturePDF.nomFichier(facture, cli); return b.size > 800 && n.startsWith(facture.num) && n.endsWith(".pdf"); });
    await etape("Relance dernier avertissement (40 €)", () => { const t = Relance.template({ ...facture, jours_retard: 35 }, cli, ZP.settings(), 3); return t.corps.includes("40 €") && t.corps.includes(facture.num); });
    await etape("Marquer payée → plus de retard", () => { ZP.setStatut(facture.num, "payée"); return ZP.retards().length === 0; });
    await etape("Devis → facture", () => { const f2 = ZP.devisVersFacture(devis.num); return f2.type === "facture" && f2.num.startsWith("F20") && ZP.doc(devis.num).statut === "accepté"; });
    await etape("Export / import", () => { const exp = ZP.exportJSON(); const nDocs = ZP.docs().length; ZP.resetAll(); ZP.importJSON(exp); return ZP.docs().length === nDocs; });
    await etape("Client dupliqué refusé (nom vide)", () => { try { ZP.addClient({ nom: "  " }); return false; } catch { return true; } });

    // restauration
    localStorage.removeItem(KEY);
    if (sauvegarde) ZP.importJSON(sauvegarde); else ZP.init();

    const nbOk = res.filter(r => r.ok).length;
    $("#view").innerHTML = `<div class="col"><h1 class="vue">Auto-test ${nbOk}/${res.length}</h1>
      <p class="sous">${nbOk === res.length ? "Tout est vert, l'application est saine. ✓" : "Des tests échouent — voir ci-dessous."}</p>
      ${res.map(r => `<div class="item"><div class="ico" style="background:${r.ok ? "var(--vert-clair)" : "var(--rouge-clair)"};color:${r.ok ? "var(--vert)" : "var(--rouge)"}">${r.ok ? "✓" : "✕"}</div>
        <div class="milieu"><div class="titre">${echap(r.nom)}</div>${r.ok ? "" : `<div class="sous">${echap(r.info)}</div>`}</div></div>`).join("")}
      <p class="aide">Les données d'origine ont été restaurées après le test.</p></div>`;
    window.__zpSelftest = { total: res.length, ok: nbOk, details: res };
  }

  /* ---------- démarrage ---------- */
  ZP.init();
  restaurerSiVide();
  if (new URLSearchParams(location.search).has("selftest")) selftest();
  else rendre();

  /* filet de sécurité : si le stockage interne de l'app a été vidé par iOS
     mais qu'une copie de sécurité existe (Documents), on restaure tout seul */
  async function restaurerSiVide() {
    try {
      const actuel = JSON.parse(localStorage.getItem("zp_data_v1") || "null");
      if (actuel && (actuel.clients.length || actuel.docs.length || (actuel.settings && actuel.settings.nom))) return;
      const r = await fetch("zp://local/__donnees/sauvegarde.json");
      if (!r.ok) return;
      const txt = await r.text();
      JSON.parse(txt); // valide ?
      ZP.importJSON(txt);
      rendre();
      toast("Données restaurées ✓");
    } catch (e) { /* pas de copie ou pas en app native : rien à faire */ }
  }
})();
