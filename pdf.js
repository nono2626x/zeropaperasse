/* ZéroPaperasse — générateur PDF maison (zéro dépendance, marche hors ligne)
   A4. Polices PDF standard : Helvetica/Helvetica-Bold (texte) et Courier-Bold
   (chiffres : largeur exacte => alignements à droite parfaits).
   Accents français encodés cp1252, échappement octal (streams 100 % ASCII). */
"use strict";

const MiniPDF = (() => {
  const W = 595.28, H = 841.89; // A4 (points)
  const M = 48;                 // marge

  /* ---------- cp1252 ---------- */
  const CP1252 = new Map(Object.entries({
    "€":0x80,"‚":0x82,"ƒ":0x83,"„":0x84,"…":0x85,"†":0x86,"‡":0x87,"ˆ":0x88,"‰":0x89,
    "‹":0x8B,"‘":0x91,"’":0x92,"“":0x93,"”":0x94,"•":0x95,"–":0x96,"—":0x97,
    "›":0x9B,"œ":0x9C,"Œ":0x8C,"š":0x9A,"Š":0x8A,"Ÿ":0x9F,
    "À":0xC0,"Á":0xC1,"Â":0xC2,"Ã":0xC3,"Ä":0xC4,"Å":0xC5,"Æ":0xC6,"Ç":0xC7,"È":0xC8,
    "É":0xC9,"Ê":0xCA,"Ë":0xCB,"Ì":0xCC,"Í":0xCD,"Î":0xCE,"Ï":0xCF,"Ñ":0xD1,
    "Ò":0xD2,"Ó":0xD3,"Ô":0xD4,"Õ":0xD5,"Ö":0xD6,"Ø":0xD8,"Ù":0xD9,"Ú":0xDA,
    "Û":0xDB,"Ü":0xDC,"Ý":0xDD,"ß":0xDF,"à":0xE0,"á":0xE1,"â":0xE2,"ã":0xE3,
    "ä":0xE4,"å":0xE5,"æ":0xE6,"ç":0xE7,"è":0xE8,"é":0xE9,"ê":0xEA,"ë":0xEB,"ì":0xEC,
    "í":0xED,"î":0xEE,"ï":0xEF,"ñ":0xF1,"ò":0xF2,"ó":0xF3,"ô":0xF4,"õ":0xF5,
    "ö":0xF6,"ø":0xF8,"ù":0xF9,"ú":0xFA,"û":0xFB,"ü":0xFC,"ý":0xFD,"ÿ":0xFF
  }));

  // échappe pour un littéral PDF : \ ( ) et octal pour tout octet hors ASCII imprimable
  function encText(s) {
    let out = "";
    for (const ch of String(s)) {
      const code = CP1252.has(ch) ? CP1252.get(ch) : ch.charCodeAt(0);
      const b = code < 256 ? code : 63;
      if (b === 92 || b === 40 || b === 41) out += "\\" + String.fromCharCode(b);
      else if (b < 32 || b > 126) out += "\\" + b.toString(8).padStart(3, "0");
      else out += String.fromCharCode(b);
    }
    return out;
  }

  const FONTS = { helv: "F1", helvB: "F2", courB: "F4" };

  class Doc {
    constructor() { this.pages = []; this._new(); }
    _new() { this.cur = { ops: [] }; this.pages.push(this.cur); }
    get nbPages() { return this.pages.length; }

    /* y est mesuré depuis le HAUT de la page (plus intuitif) */
    text(x, yTop, s, o = {}) {
      const size = o.size || 9.5;
      const fkey = o.font || "helv";
      const font = FONTS[fkey] || "F1";
      const col = o.color || [0.12, 0.14, 0.18];
      const yy = H - yTop - size;
      let tx = x;
      if (o.align === "right" || o.align === "center") {
        const w = this.width(s, size, fkey);
        tx = o.align === "center" ? x - w / 2 : x - w;
      }
      this.cur.ops.push(
        `BT /${font} ${size} Tf ${col[0]} ${col[1]} ${col[2]} rg ` +
        `1 0 0 1 ${tx.toFixed(2)} ${yy.toFixed(2)} Tm (${encText(s)}) Tj ET`
      );
    }
    // largeur : EXACTE pour Courier ; estimation majorée pour Helvetica (0.55)
    width(s, size, fkey) {
      if (fkey === "courB") return String(s).length * size * 0.6;
      return String(s).length * size * 0.55;
    }
    /* chiffres alignés à droite en Courier-Bold */
    mono(xRight, yTop, s, o = {}) {
      const size = o.size || 9.5;
      const w = String(s).length * size * 0.6;
      this.text(xRight - w, yTop, s, { ...o, font: "courB" });
    }
    monoCenter(xc, yTop, s, o = {}) {
      const size = o.size || 9.5;
      const w = String(s).length * size * 0.6;
      this.text(xc - w / 2, yTop, s, { ...o, font: "courB" });
    }
    line(x1, y1Top, x2, y2Top, o = {}) {
      const w = o.w || 0.7, col = o.color || [0.82, 0.84, 0.87];
      this.cur.ops.push(`${w} w ${col[0]} ${col[1]} ${col[2]} RG ` +
        `${x1.toFixed(2)} ${(H - y1Top).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2Top).toFixed(2)} l S`);
    }
    rect(x, yTop, w, h, o = {}) {
      if (o.fill) { const c = o.fill; this.cur.ops.push(`${c[0]} ${c[1]} ${c[2]} rg ${x.toFixed(2)} ${(H - yTop - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }
      if (o.stroke) { const c = o.color || [0.82, 0.84, 0.87]; this.cur.ops.push(`${(o.lw || 0.7)} w ${c[0]} ${c[1]} ${c[2]} RG ${x.toFixed(2)} ${(H - yTop - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`); }
    }
    newPage() { this._new(); return M + 10; }
    newPageIf(yTop, needed) { return (yTop + needed > H - 70) ? this.newPage() : yTop; }

    /* coupe un texte sur plusieurs lignes (estimation largeur Helvetica) */
    wrap(s, maxw, size) {
      const words = String(s).split(/\s+/).filter(Boolean);
      const lines = []; let cur = "";
      for (const w of words) {
        const test = cur ? cur + " " + w : w;
        if (this.width(test, size, "helv") > maxw && cur) { lines.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [""];
    }

    /* ---------- sérialisation ---------- */
    build() {
      const chunks = []; let len = 0; const offsets = [0];
      const push = (data) => {
        const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
        chunks.push(bytes); len += bytes.length;
      };
      const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };

      push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

      const n = this.pages.length;
      const fB = 4 + n * 2, fC = fB + 1, fD = fB + 2; // helvB, courier, courierBold
      const kids = this.pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ");
      const fontsStr = `/F1 3 0 R /F2 ${fB} 0 R /F3 ${fC} 0 R /F4 ${fD} 0 R`;

      obj(1, `<< /Type /Catalog /Pages 2 0 R >>`);
      obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
      obj(3, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);

      this.pages.forEach((p, i) => {
        const pid = 4 + i * 2, cid = pid + 1;
        obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << ${fontsStr} >> >> /Contents ${cid} 0 R >>`);
        const stream = p.ops.join("\n");
        offsets[cid] = len;
        push(`${cid} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
      });

      obj(fB, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
      obj(fC, `<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`);
      obj(fD, `<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>`);

      const maxId = fD;
      const xrefPos = len;
      let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
      for (let i = 1; i <= maxId; i++) xref += String(offsets[i] || 0).padStart(10, "0") + " 00000 n \n";
      push(xref);
      push(`trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

      const total = new Uint8Array(len); let p = 0;
      for (const c of chunks) { total.set(c, p); p += c.length; }
      return new Blob([total], { type: "application/pdf" });
    }
  }

  return { Doc, W, H, M };
})();
window.MiniPDF = MiniPDF;
