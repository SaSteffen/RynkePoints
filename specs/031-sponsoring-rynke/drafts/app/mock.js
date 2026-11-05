/* Mockup only: situations, measure switch and held update. All figures and lines are invented. */
(function(){
const params=new URLSearchParams(location.search), sit=params.get("s")||"first";
const de=n=>n.toLocaleString("de-DE");
const S={
 neu:{img:"wave",quote:"Fünf Namen auf einen Zettel. Für die erste Runde reicht das.",rynke:0,eur:0,rows:[["Kontakte","0","0"],["Sponsoren","0","0"],["Kampagne","0 €","0"]],mile:["Erste Anfrage",0,"Noch 1 Kontakt"],tips:[["Der leichteste Anfang","Frag in der Firma, in der du arbeitest, wer über Spenden entscheidet. Dafür musst du niemanden anrufen, den du nicht kennst."],["Eine kurze Mail","Drei Sätze reichen: wer du bist, wofür du fährst, was ein Bronze-Paket kostet."]]},
 angefragt:{img:"thumbs",quote:"Keine Antwort ist noch kein Nein. Meist ist die Mail nur untergegangen.",rynke:24,eur:0,rows:[["Kontakte","12","24"],["Sponsoren","0","0"],["Kampagne","0 €","0"]],mile:["Erster Euro",0,"Der erste Abschluss fehlt noch"],tips:[["Nachfassen","Frag nach zwei Wochen einmal freundlich nach und nenne ein konkretes Paket. Auf „irgendwas“ lässt sich schwerer antworten als auf „Bronze für 500 €“."],["Der richtige Mensch","Frag, wer das entscheidet, bevor du erklärst, worum es geht."]]},
 first:{img:"flex",quote:"Der erste Sponsor steht. Wer einmal Ja gesagt hat, kennt oft noch jemanden.",rynke:124,eur:500,rows:[["Kontakte","12","24"],["Sponsoren","1 × Bronze · 500 €","100"],["Kampagne","0 €","0"]],mile:["5.000 € eingeworben",10,"Noch 4.500 €"],tips:[["Danach ist davor","Bedank dich mit einem Foto im Trikot, sobald es so weit ist. Frag dabei, wem das Unternehmen dich empfehlen würde."],["Sag es weiter","Ein Sponsor auf deiner Liste macht die nächste Anfrage leichter. Nenn ihn, wenn er einverstanden ist."]]},
 laeuft:{img:"point",quote:"Läuft. Frag mal rum, wer im Team noch bei der ersten Anfrage hängt.",rynke:1037,eur:5600,rows:[["Kontakte","46","92"],["Sponsoren","2 × Bronze, Silber, Gold · 5.000 €","600"],["Kampagne","600 €","120"],["Teamsponsoring","1.500 €, nicht in der Sammlung","175"],["Material","Größe S","50"]],mile:["10.000 € eingeworben",56,"Noch 4.400 €"],tips:[["Weitergeben","Deine Mail, die funktioniert hat, hilft anderen mehr als jeder Ratschlag. Teil sie im Teamchat, ohne die Namen."],["Größer fragen","Wer letztes Jahr Silber genommen hat, kann dieses Jahr auch Gold hören."]]},
};
const s=S[sit]||S.first;
const monkey=`<img class="quote-monkey-art" src="assets/${s.img}.svg" alt="" width="120" height="120"><blockquote class="quote quote-push" lang="de"><p>${s.quote}</p></blockquote>`;
document.querySelectorAll("[data-monkey]").forEach(e=>e.innerHTML=monkey);
const hero=document.querySelector("[data-hero-rynke]"); if(hero) hero.textContent=de(s.rynke);
const card=document.querySelector("[data-sponsoring]");
if(card){ let t=0;
 const coin='<svg class="coin coin-mini coin-sponsor" viewBox="0 0 24 24" aria-hidden="true"><use href="#coin-mini"></use></svg>';
 card.innerHTML=`<h2>${coin}Sponsoring</h2><div class="quote-monkey">${monkey}</div>
 <p class="sponsoring-figures"><b>${de(s.rynke)}</b><span>Sponsoringrynke</span><span>· ${de(s.eur)} € eingeworben</span></p>
 <p class="team-hint">Stand: heute, 06:10</p>
 <div class="badge-progress"><span class="badge-next">Nächstes Abzeichen: ${s.mile[0]}</span><span class="bar" aria-hidden="true"><span style="width:${s.mile[1]}%"></span></span><span class="badge-missing">${s.mile[2]}</span></div>
 <div class="sponsoring-tip"><b data-tip-t></b><span data-tip></span><br><button type="button" class="button-text" data-next>Noch ein Tipp</button></div>`;
 const src=document.querySelector("[data-sponsoring-sources]");
 if(src) src.innerHTML=`<h3>Sponsoring</h3><table class="breakdown-table"><thead><tr><td></td><th scope="col">${coin}<span class="visually-hidden">Sponsoringrynke</span></th></tr></thead><tbody>${s.rows.map(r=>`<tr><th scope="row">${r[0]}<span class="breakdown-detail">${r[1]}</span></th><td>${r[2]}</td></tr>`).join("")}</tbody></table>`;
 const show=()=>{card.querySelector("[data-tip-t]").textContent=s.tips[t][0];card.querySelector("[data-tip]").textContent=s.tips[t][1]}; show();
 card.querySelector("[data-next]").onclick=()=>{t=(t+1)%s.tips.length;show()};
}
if(params.get("notice")==="1"){ document.body.insertAdjacentHTML("beforeend",`<aside class="tour mock-notice" aria-label="Neu in der App"><p>Neu: Sponsoring. Deine Kontakte und dein eingeworbenes Geld kommen aus den Listen des Teams und werden hier zu Sponsoringrynke. Das Team sieht sie ohne Namen, die Orga nur als Summen.</p><p><button type="button" class="button" data-dismiss>Verstanden</button></p></aside>`); document.querySelector("[data-dismiss]").onclick=e=>e.target.closest("aside").remove(); }
if(sit==="neu"){ document.querySelector(".my-place")?.remove(); document.querySelector(".row.you")?.remove(); }
document.querySelectorAll("[data-measure]").forEach(a=>a.addEventListener("click",e=>{ e.preventDefault(); const c=a.closest("[data-money]");
 c.querySelectorAll("[data-measure]").forEach(x=>x===a?x.setAttribute("aria-current","true"):x.removeAttribute("aria-current"));
 c.querySelectorAll("[data-measure-view]").forEach(v=>v.hidden=v.dataset.measureView!==a.dataset.measure); }));
const sync=document.querySelector("[data-sync]");
if(sync){ sync.innerHTML=params.get("held")==="1"
 ?`<div class="sync sync-held"><b>Update angehalten</b><br>Bei 1 Rider wäre die Summe gesunken. Es gilt weiter der Stand von gestern.<br><button type="button" class="button-outlined">Trotzdem übernehmen</button><button type="button" class="button-outlined">Verwerfen</button></div>`
 :`<div class="sync sync-good"><b>Stand: heute, 06:10</b><br>Intranet und Kontaktliste gelesen. 41 Rider zugeordnet, 2 Namen ohne Zuordnung.</div>`; }
document.addEventListener("click",e=>{const a=e.target.closest("a[data-inert]"); if(a) e.preventDefault();});
const q=location.search; if(q){ document.querySelectorAll('a[href$="du.html"],a[href$="team-sponsoring.html"]').forEach(a=>{a.href=a.getAttribute("href")+q}); }
})();
