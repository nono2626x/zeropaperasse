/* ZéroPaperasse — couche de données locale (localStorage)
   Tout vit sur l'appareil. Aucun serveur, aucun compte, aucune dépendance. */
"use strict";

const ZP = (() => {
  const KEY = "zp_data_v1";
  const SCHEMA = 1;

  const DEFAULTS = {
    nom: "", forme: "", capital: "", rcs: "", siret: "",
    tva_intracom: "",
    adresse: "", cp: "", ville: "", tel: "", email: "",
    tva_franchise: false, tva_defaut: 20,
    iban: "", banque: "",
    delai_paiement: 30, validite_devis: 30,
    penalites: "au taux directeur de la BCE majoré de 10 points",
    installe_le: ""
  };

  let d = null;

  /* ---------- helpers ---------- */
  const todayISO = () => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  };
  const isoPlus = (iso, jours) => {
    const dt = new Date(iso + "T12:00:00");
    dt.setDate(dt.getDate() + jours);
    return dt.toISOString().slice(0, 10);
  };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

  /* ---------- persistance ---------- */
  function save() {
    d.schema = SCHEMA;
    d.modifie_le = new Date().toISOString();
    try { localStorage.setItem(KEY, JSON.stringify(d)); }
    catch (e) { alert("Stockage plein : exporte une sauvegarde puis supprime d'anciens documents."); throw e; }
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; }
  }
  function init() {
    d = load();
    if (!d) d = { settings: { ...DEFAULTS }, clients: [], docs: [], counters: {}, stats: { docs: 0, relances: 0 } };
    // migration douce : champs manquants
    d.settings = { ...DEFAULTS, ...(d.settings || {}) };
    d.clients = d.clients || []; d.docs = d.docs || []; d.counters = d.counters || {};
    d.stats = d.stats || { docs: 0, relances: 0 };
    save();
    return d;
  }
  function resetAll() { localStorage.removeItem(KEY); return init(); }
  function exportJSON() {
    return JSON.stringify({ ...d, exporte_le: new Date().toISOString(), app: "ZéroPaperasse" }, null, 2);
  }
  function importJSON(txt) {
    const incoming = JSON.parse(txt); // throw si corrompu
    if (!incoming || !Array.isArray(incoming.clients) || !Array.isArray(incoming.docs))
      throw new Error("Fichier de sauvegarde non reconnu.");
    d = {
      settings: { ...DEFAULTS, ...(incoming.settings || {}) },
      clients: incoming.clients, docs: incoming.docs,
      counters: incoming.counters || {}, stats: incoming.stats || { docs: 0, relances: 0 }
    };
    save();
    return true;
  }

  /* ---------- clients ---------- */
  function clients() { return d.clients; }
  function client(id) { return d.clients.find(c => c.id === id) || null; }
  function addClient(c) {
    const cli = { id: uid(), nom: (c.nom || "").trim(), contact: c.contact || "", email: c.email || "",
      tel: c.tel || "", adresse: c.adresse || "", cp: c.cp || "", ville: c.ville || "" };
    if (!cli.nom) throw new Error("Le nom du client est obligatoire.");
    d.clients.push(cli); save(); return cli;
  }
  function updClient(id, c) {
    const cli = client(id); if (!cli) throw new Error("Client introuvable.");
    Object.assign(cli, c, { nom: (c.nom || cli.nom).trim() }); save(); return cli;
  }
  function delClient(id) {
    const used = d.docs.some(x => x.client_id === id);
    if (used) throw new Error("Impossible : des documents sont liés à ce client.");
    d.clients = d.clients.filter(c => c.id !== id); save();
  }

  /* ---------- calculs ---------- */
  // lignes: [{d, q, pu, tva}] ; remise en % appliquée par ligne (proportionnel)
  function totals(lignes, remisePct, franchise) {
    let ht = 0, tvaMap = {};
    const r = Math.max(0, Math.min(100, Number(remisePct) || 0));
    for (const l of lignes) {
      const q = Number(l.q) || 0, pu = Number(l.pu) || 0;
      const base = round2(q * pu * (1 - r / 100));
      ht = round2(ht + base);
      if (!franchise) {
        const taux = franchise ? 0 : (Number(l.tva) || 0);
        tvaMap[taux] = round2((tvaMap[taux] || 0) + base * taux / 100);
      }
    }
    const tvaTotal = Object.values(tvaMap).reduce((a, b) => round2(a + b), 0);
    return { ht, tvaMap, tvaTotal, ttc: round2(ht + tvaTotal) };
  }

  /* ---------- documents ---------- */
  function docs() { return [...d.docs].sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.cree_le || "").localeCompare(a.cree_le || "")); }
  function doc(num) { return d.docs.find(x => x.num === num) || null; }

  function nextNum(type) {
    const prefix = type === "facture" ? "F" : "D";
    const key = prefix + new Date().getFullYear();
    d.counters[key] = (d.counters[key] || 0) + 1;
    return `${key}-${String(d.counters[key]).padStart(4, "0")}`;
  }

  function addDoc(input) {
    const lignes = (input.lignes || []).filter(l => (l.d || "").trim() && Number(l.q) > 0);
    if (!lignes.length) throw new Error("Ajoute au moins une ligne avec une désignation et une quantité.");
    if (!input.client_id || !client(input.client_id)) throw new Error("Choisis un client.");
    const type = input.type === "devis" ? "devis" : "facture";
    const franchise = !!d.settings.tva_franchise;
    const t = totals(lignes, input.remise || 0, franchise);
    const date = input.date || todayISO();
    const docu = {
      num: nextNum(type), type, client_id: input.client_id,
      date,
      echeance: type === "facture" ? (input.echeance || isoPlus(date, Number(d.settings.delai_paiement) || 30)) : "",
      lignes, remise: Number(input.remise) || 0, t: t,
      statut: type === "facture" ? "à envoyer" : "envoyé",
      devise_accepte_le: "", notes: input.notes || "",
      cree_le: new Date().toISOString()
    };
    d.docs.push(docu); d.stats.docs++; save();
    return docu;
  }

  function setStatut(num, statut) {
    const docu = doc(num); if (!docu) throw new Error("Document introuvable.");
    docu.statut = statut; save(); return docu;
  }

  // factures non payées dont l'échéance est dépassée
  function retards() {
    const t = todayISO();
    return d.docs.filter(x => x.type === "facture" && x.statut !== "payée" && x.echeance && x.echeance < t)
      .map(x => ({ ...x, jours_retard: Math.round((new Date(t) - new Date(x.echeance)) / 86400000) }))
      .sort((a, b) => b.jours_retard - a.jours_retard);
  }

  // conversion devis accepté -> facture (même contenu, nouveau numéro)
  function devisVersFacture(num) {
    const dv = doc(num);
    if (!dv || dv.type !== "devis") throw new Error("Ce document n'est pas un devis.");
    const f = addDoc({ type: "facture", client_id: dv.client_id, lignes: dv.lignes, remise: dv.remise });
    setStatut(num, "accepté");
    return f;
  }

  /* ---------- stats tableau de bord ---------- */
  function dashboard() {
    const mois = todayISO().slice(0, 7);
    const facturesMois = d.docs.filter(x => x.type === "facture" && (x.date || "").startsWith(mois));
    const caMois = round2(facturesMois.reduce((a, x) => a + x.t.ttc, 0));
    const aEncaisser = round2(d.docs.filter(x => x.type === "facture" && x.statut !== "payée").reduce((a, x) => a + x.t.ttc, 0));
    const ret = retards();
    const enRetard = round2(ret.reduce((a, x) => a + x.t.ttc, 0));
    // temps gagné : doc ~3 min, relance ~4 min
    const minutes = d.stats.docs * 3 + d.stats.relances * 4;
    return { caMois, aEncaisser, nbRetards: ret.length, enRetard, minutes,
      nbDocs: d.docs.length, nbClients: d.clients.length };
  }
  function bumpRelances() { d.stats.relances++; save(); }

  function settings() { return d.settings; }
  function setSettings(s) { d.settings = { ...d.settings, ...s }; save(); return d.settings; }

  /* ---------- données de démo (dates relatives à aujourd'hui) ---------- */
  function chargerDemo() {
    const j = n => isoPlus(todayISO(), -n);
    d = { settings: { ...DEFAULTS,
        nom: "Plomberie Durand", forme: "SASU", capital: "5 000 €", rcs: "RCS Lyon 812 345 678",
        siret: "812 345 678 00019", adresse: "12 rue des Lilas", cp: "69003", ville: "Lyon",
        tel: "06 12 34 56 78", email: "contact@plomberie-durand.fr",
        tva_franchise: false, tva_defaut: 20, iban: "FR76 3000 400828 000123456789 012",
        banque: "Crédit Agricole", delai_paiement: 30, validite_devis: 30,
        penalites: "au taux directeur de la BCE majoré de 10 points",
        installe_le: todayISO() },
      clients: [
        { id: "c1", nom: "Mairie de Saint-Rémy", contact: "Mme Fabre", email: "mairie@saint-remy.fr", tel: "04 78 00 11 22", adresse: "1 place du Village", cp: "69170", ville: "Saint-Rémy" },
        { id: "c2", nom: "SARL Boulangerie Aubert", contact: "M. Aubert", email: "aubert.pain@gmail.com", tel: "06 45 78 90 12", adresse: "8 av. de la Gare", cp: "69009", ville: "Lyon" },
        { id: "c3", nom: "M. Bernard Lefèvre", contact: "", email: "b.lefevre@orange.fr", tel: "06 22 33 44 55", adresse: "24 rue du Château", cp: "69340", ville: "Francheville" },
        { id: "c4", nom: "Copropriété Les Tilleuls", contact: "Syndic Vertuis", email: "gestion@vertuis.fr", tel: "04 72 10 20 30", adresse: "3 allée des Tilleuls", cp: "69160", ville: "Tassin" },
        { id: "c5", nom: "Garage MécaPlus", contact: "M. Rosa", email: "mecaplus69@gmail.com", tel: "06 88 77 66 55", adresse: "45 rte de Paris", cp: "69400", ville: "Villefranche" }
      ],
      docs: [], counters: {}, stats: { docs: 0, relances: 0 } };
    const mk = (o) => { const docu = addDoc(o); return docu; };
    const f1 = mk({ type: "facture", client_id: "c1", date: j(45), lignes: [{ d: "Remplacement chauffe-eau Thermor 200 L (fourniture + pose)", q: 1, pu: 1250, tva: 20 }] });
    setStatut(f1.num, "payée");
    const f2 = mk({ type: "facture", client_id: "c3", date: j(38), lignes: [{ d: "Débouchage évacuation cuisine — intervention urgente", q: 1, pu: 180, tva: 20 }, { d: "Déplacement", q: 1, pu: 35, tva: 20 }] });
    setStatut(f2.num, "payée");
    mk({ type: "facture", client_id: "c2", date: j(40), echeance: j(10), lignes: [{ d: "Entretien chaudière gaz — contrat annuel", q: 1, pu: 145, tva: 20 }] }).statut = "envoyée";
    const f4 = mk({ type: "facture", client_id: "c4", date: j(47), echeance: j(17), lignes: [{ d: "Réparation fuite colonne montante — immeuble B", q: 1, pu: 640, tva: 20 }] });
    f4.statut = "envoyée";
    const f5 = mk({ type: "facture", client_id: "c5", date: j(33), echeance: j(3), lignes: [{ d: "Installation robinetterie sanitaire (x4)", q: 4, pu: 95, tva: 20 }] });
    f5.statut = "envoyée";
    const f6 = mk({ type: "facture", client_id: "c2", date: j(25), lignes: [{ d: "Fourniture et pose mitigeur cuisine", q: 1, pu: 210, tva: 20 }] });
    f6.statut = "envoyée";
    const f7 = mk({ type: "facture", client_id: "c4", date: j(65), echeance: j(35), lignes: [{ d: "Remplacement colonne d'eau — immeuble A (acompte non réglé)", q: 1, pu: 480, tva: 20 }] });
    f7.statut = "envoyée";
    const f8 = mk({ type: "facture", client_id: "c1", date: j(2), lignes: [{ d: "Contrat entretien plomberie — intervention mensuelle", q: 1, pu: 320, tva: 20 }] });
    setStatut(f8.num, "payée");
    mk({ type: "devis", client_id: "c1", date: j(5), lignes: [{ d: "Rénovation salle des fêtes — plomberie complète", q: 1, pu: 4800, tva: 20 }] });
    mk({ type: "devis", client_id: "c3", date: j(2), lignes: [{ d: "Remplacement radiateurs cuisine (x2) — fourniture + pose", q: 2, pu: 340, tva: 20 }] });
    // recalculer les totaux des factures à échéance passée pour retards()
    save();
    return d;
  }

  return { init, save, resetAll, exportJSON, importJSON, chargerDemo,
    clients, client, addClient, updClient, delClient,
    totals, docs, doc, addDoc, setStatut, retards, devisVersFacture,
    dashboard, bumpRelances, settings: () => d.settings, setSettings,
    todayISO, isoPlus, round2 };
})();
window.ZP = ZP;
