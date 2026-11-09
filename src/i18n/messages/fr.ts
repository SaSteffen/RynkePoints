import type { Catalog } from "../catalogs";

// French catalog, translated from en.ts (the reference wording) per
// ../GLOSSARY.md. Not reviewed by a native speaker (feature 026 FR-028).

export const fr: Catalog = {
	"meta.languageName": "Français",
	"meta.intlLocale": "fr-FR",
	"app.name": "RynkePoints",
	"brand.connectWithStrava.src": "/strava/en/connect-with-strava.svg",
	"brand.connectWithStrava.alt": "Se connecter avec Strava",
	"brand.poweredByStrava.src": "/strava/en/powered-by-strava.svg",
	"brand.poweredByStrava.alt": "Powered by Strava",
	"brand.viewOnStrava": "View on Strava",

	"layout.switcher.label": "Langue",
	"layout.logout": "Se déconnecter",
	"layout.loading": "Chargement de la page",

	"landing.title": "Se connecter avec Strava",
	"landing.intro":
		"Tes sorties sur Strava deviennent des Rynke, les points de la {team}.",
	"landing.who": "Seuls les membres de {clubLink} peuvent participer.",
	"club.linkText": "notre club d'équipe sur Strava",
	"landing.dataRead":
		"De chaque sortie, nous ne lisons que le nom, le type de sport, l'heure de départ, la distance, le temps en mouvement, le temps total pauses comprises, le dénivelé, si elle a été saisie à la main ou faite sur home trainer, et si Strava l'a signalée.",
	"landing.private":
		"Les sorties privées («\u00a0Moi uniquement\u00a0») ne comptent que si tu autorises l'accès à tes activités privées sur Strava.",
	"landing.purpose":
		"Nous utilisons les données uniquement pour les Rynke et les événements de l'équipe. Toi seul·e vois tes sorties et leurs noms.",
	"landing.leave":
		"Tu peux partir à tout moment\u00a0: dans les Réglages, ou en retirant RynkePoints sur Strava. Nous supprimons alors toutes les données te concernant, tes Rynke compris. Si tu quittes le club, nous les supprimons sous 24 heures. Uniquement si un administrateur te retire, nous gardons ton identifiant Strava, pour que tu ne puisses pas te reconnecter.",
	"landing.backups":
		"Les données supprimées restent jusqu'à 7 jours dans les sauvegardes de notre hébergeur.",
	"landing.cookies":
		"Nous ne déposons que des cookies nécessaires\u00a0: pour la connexion et ton choix de langue.",
	"landing.notifications":
		"Les notifications sont facultatives, propres à chaque appareil, et ne montrent qu'à toi combien de Rynke sont nouveaux et ce qu'il te manque. Elles passent par le service push du fabricant de ton appareil ou navigateur (p. ex. Google, Apple, Mozilla, Microsoft). Pour cela, nous ne gardons que l'adresse qu'il donne à ton appareil, et la supprimons quand tu les désactives, te déconnectes ou pars.",

	"consent.heading": "Ce que tu acceptes en te connectant",
	"consent.short.notRead":
		"Nous ne lisons ni traces GPS, ni cartes, ni photos, ni données de santé.",
	"consent.short.read":
		"Nous ne lisons que les chiffres clés de tes sorties vélo, courses et nages, comme la distance, le temps et le dénivelé, et les transformons en Rynke et en badges.",
	"consent.short.shown":
		"L'équipe voit tes Rynke et, dans le classement, tes séances, kilomètres et dénivelé, sans ton nom. Les organisateurs les voient avec ton prénom, ainsi que tes kilomètres et ton dénivelé par jour. Les administrateurs voient ton prénom et l'état de ta connexion, et s'ils te retirent, nous gardons ton identifiant Strava pour que tu ne puisses pas revenir.",
	"consent.details": "Tous les détails",
	"consent.organisers":
		"Les organisateurs voient ton prénom depuis Strava, tes Rynke et leur origine, ce qu'il te manque, si tu as atteint ton objectif d'entraînement, tes événements d'équipe et corrections, et à quels événements d'équipe tu as indiqué venir ou avoir participé.",
	"consent.dailyFigures":
		"Les organisateurs voient aussi, avec ton prénom, combien de kilomètres tu as roulé dehors et en virtuel et combien de mètres de dénivelé tu as grimpé, en total par jour, sur toute la saison. Cela inclut les sorties privées qui comptent. Ils ne voient pas tes sorties une par une, ni leurs noms, horaires ou parcours.",
	"consent.rideFigures":
		"Dans le classement de l'équipe, tout le monde voit ton nombre de sorties comptées, tes kilomètres et ton dénivelé par saison, mois et semaine, sans ton nom. Les organisateurs voient, avec ton prénom, tes séances par saison et par jour et ta sortie type\u00a0: la longueur au-dessus de laquelle se trouve la moitié de tes sorties et en dessous l'autre moitié. Ce que nous lisons sur Strava ne change pas.",
	"consent.team":
		"Tous les autres membres de l'équipe voient tes Rynke, au total et par semaine, sans ton nom. Tes kilomètres et ton dénivelé comptent dans les totaux de l'équipe pour les badges d'équipe, sans ton nom. Les jours et l'heure où tu roules, cours ou nages comptent pour les surprises d'équipe, sans ton nom.",
	"consent.required":
		"La lecture et le partage sont nécessaires pour participer.",
	"consent.agree":
		"D'accord\u00a0: RynkePoints lit mes sorties et partage mes Rynke et totaux journaliers comme décrit.",
	"consent.referenceNote":
		"Cette page est une traduction. En cas de différence, c'est la {englishLink} qui fait foi.",
	"consent.referenceNote.link": "version anglaise",

	"me.title": "Tes RynkePoints",
	"me.greeting": "Salut {firstName}\u00a0!",
	"me.status.connected": "Connecté·e à Strava",
	"me.status.needsReconnect": "Ta connexion Strava doit être renouvelée.",
	"me.reconnect": "Se reconnecter",
	"me.scope.readAll": "Les activités privées comptent aussi.",
	"me.scope.sharedOnly":
		"Les activités privées («\u00a0Moi uniquement\u00a0») ne comptent pas.",
	"me.scope.write":
		"RynkePoints pourra écrire une section Rynke dans les descriptions de tes sorties quand la fonction existera.",
	"me.scope.noWrite":
		"RynkePoints n'écrit rien dans les descriptions de tes sorties.",
	"me.changePermissions": "Modifier les autorisations sur Strava",
	"me.consent.heading": "Ton consentement",
	"me.consent.accepted": "Donné le {date} (version {version}).",
	"me.consent.none":
		"Donne ton accord pour que nous puissions compter tes sorties. Strava redemandera alors les autorisations. D'ici là, l'équipe ne voit rien de toi.",
	"me.consent.renew.heading": "Merci de redonner ton accord",
	"me.consent.renew.older":
		"Tu as accepté la version {accepted} le {date}. La version {version} change ceci\u00a0:",
	"me.consent.renew.strava":
		"RynkePoints a besoin d'une autorisation de plus pour cela\u00a0; Strava te la demande.",
	"me.consent.renew.button": "Accepter et continuer",
	"me.consent.renew.leave":
		"Tu ne veux pas accepter\u00a0? Alors déconnecte-toi\u00a0; nous supprimons toutes tes données.",
	"me.recent.heading": "Tes sorties",
	"me.recent.none": "Pas encore de sortie cette saison.",
	"me.recent.col.distance": "Distance",
	"me.disconnect.button": "Se déconnecter et supprimer tes données",

	"units.km": "{value} km",
	"units.m": "{value} m",
	"units.percent": "{value} %",
	"units.kmh": "{value} km/h",
	"units.mPerH": "{value} m/h",
	"units.duration": "{h} h {min} min",
	"units.durationMin": "{min} min",
	"sport.Ride": "Sortie vélo",
	"sport.MountainBikeRide": "Sortie VTT",
	"sport.GravelRide": "Sortie gravel",
	"sport.EBikeRide": "Sortie vélo électrique",
	"sport.EMountainBikeRide": "Sortie VTT électrique",
	"sport.VirtualRide": "Sortie virtuelle",

	"rynke.training": "Rynke d'entraînement",
	"rynke.team": "Rynke d'équipe",
	"rynke.withoutVirtual": "Rynke d'entraînement en extérieur",
	"waiting.heading": "Récupération de tes sorties",
	"waiting.body":
		"Nous récupérons une fois tes sorties depuis le {date} sur Strava. Cela prend environ 5 minutes\u00a0; cette page se met à jour toute seule.",
	"fetching.events": "{done} activités récupérées sur {total}",
	"fetching.import": {
		one: "{n} activité récupérée pour l'instant, d'autres suivent",
		many: "{n} activités récupérées pour l'instant, d'autres suivent",
		other: "{n} activités récupérées pour l'instant, d'autres suivent",
	},
	"rynke.verdict.in": "Qualifié·e pour Paris\u00a0! 🗼",
	"rynke.verdict.notYet": "Pas encore qualifié·e",
	"rynke.verdict.missing": "Il te manque encore\u00a0:",
	"rynke.status.push": "Tu es en retard sur le plan.",
	"rynke.status.onTrack": "Tu es dans le plan.",
	"rynke.status.in": "En avance\u00a0: objectif d'entraînement atteint.",
	"rynke.missing.training": "{n} Rynke d'entraînement",
	"rynke.missing.team": "{n} Rynke d'équipe",
	"rynke.missing.withoutVirtual": "{n} Rynke d'entraînement en extérieur",
	"rynke.rides.col.elevationTotal": "Dénivelé compté",
	"rynke.rides.total": "Sorties cette saison\u00a0: {total}",
	"rynke.rides.newest": "Vers tes sorties les plus récentes",
	"rynke.rides.loading": "Chargement des sorties plus anciennes …",
	"rynke.rides.failed": "Impossible de charger les sorties plus anciennes.",
	"rynke.rides.retry": "Réessayer",
	"rynke.rides.added": "Plus de sorties chargées",
	"rynke.notice.updating":
		"De nouvelles règles s'appliquent depuis le {date}. Tes Rynke sont en cours de recalcul\u00a0; d'ici là, tu les vois selon la version {version} des règles.",
	"rynke.rules.heading": "Règles",
	"rynke.rules.version":
		"Règles version {version}, en vigueur depuis le {date}.",
	"rynke.rules.windowDeadline":
		"Tout ce qui va du {start} au {deadline} compte.",
	"rynke.rules.handout": "Les règles en PDF (en allemand)",
	"rynke.ride.counts": "compte 🪙",
	"rynke.ride.countsWithoutRynke": "compte",
	"rynke.ride.doesNotCount": "ne compte pas",
	"rynke.ride.beingEvaluated": "En cours d'évaluation",
	"rynke.ride.virtual": "virtuelle",
	"rynke.ride.fixHint":
		"Tu peux corriger la sortie sur Strava ou demander à un organisateur.",
	"rynke.ride.fix.summary": "Comment faire",
	"rynke.ride.fix.crop":
		"Corrige la sortie sur Strava : recadre ce qui n'en fait pas partie, par exemple la longue pause, un trajet en train ou en voiture, ou un enregistrement qui a continué après la sortie.",
	"rynke.ride.fix.rename":
		"Change ensuite le titre de la sortie et enregistre. C'est ainsi que l'appli l'apprend : Strava signale un nouveau titre, mais pas un recadrage. Tu pourras remettre l'ancien titre ensuite.",
	"rynke.ride.fix.manual":
		"Si tu as enregistré la sortie, importe l'enregistrement sur Strava et supprime la saisie manuelle.",
	"rynke.ride.fix.wait":
		"Au bout de quelques minutes, la sortie est réévaluée ici. Si rien ne change, demande à un organisateur.",
	"rynke.reason.flagged":
		"Strava a signalé cette sortie. Si tu n'es pas d'accord, règle-le avec Strava.",
	"rynke.reason.pause":
		"Pause trop longue\u00a0: {paused} de pause pour {moving} en mouvement\u00a0; plus de la moitié n'est pas permis.",
	"rynke.reason.pause.moving":
		"Pause trop longue\u00a0: {paused} de pause pour {moving} en mouvement\u00a0; une pause plus longue que le mouvement n'est pas permise.",
	"rynke.reason.pause.share":
		"Pause trop longue\u00a0: {paused} de pause pour {moving} en mouvement\u00a0; plus de {share} n'est pas permis.",
	"rynke.reason.pause.noLimit":
		"Pause trop longue\u00a0: {paused} de pause pour {moving} en mouvement.",
	"rynke.reason.pause.noMovingTime":
		"Pas de temps en mouvement\u00a0: la sortie compte comme une pause du début à la fin.",
	"rynke.reason.manual": "Saisie à la main sur Strava.",
	"rynke.reason.too_slow":
		"Trop lent\u00a0: {speed} de moyenne, au moins {limit} nécessaire.",
	"rynke.reason.too_slow.noLimit": "Trop lent\u00a0: {speed} de moyenne.",
	"rynke.reason.too_fast":
		"Trop rapide pour une sortie vélo\u00a0: {speed} de moyenne, au plus {limit} permis.",
	"rynke.reason.too_fast.noLimit":
		"Trop rapide pour une sortie vélo\u00a0: {speed} de moyenne.",
	"rynke.reason.climbing_rate":
		"Trop de dénivelé pour le temps\u00a0: {rate} en montée, au plus {limit} permis.",
	"rynke.reason.climbing_rate.noLimit":
		"Trop de dénivelé pour le temps\u00a0: {rate} en montée.",
	"rynke.reason.excluded_sport_type": "{sport} ne compte pas pour les Rynke.",
	"rynke.reason.outside_window": "Avant le début de saison, le {date}.",
	"rynke.reason.outside_window.afterDeadline":
		"Après la date limite du {date}.",
	"rynke.reason.overlap":
		"Enregistrée deux fois\u00a0: ta sortie du {date}, {time}, {distance} compte à la place.",
	"rynke.reason.overlap.noRide":
		"Enregistrée deux fois\u00a0: une autre de tes sorties compte à la place.",
	"rynke.reason.unknown": "Ne compte pas selon les règles actuelles.",
	"rynke.unknown.elapsed_time":
		"Le temps total pauses comprises manque encore, la règle des pauses n'a donc pas encore été vérifiée.",
	"rynke.unknown.manual":
		"On ne sait pas encore si la sortie a été saisie à la main.",
	"rynke.unknown.trainer":
		"On ne sait pas encore si la sortie a été faite sur home trainer.",
	"rynke.unknown.flagged":
		"On ne sait pas encore si Strava a signalé la sortie.",
	"rynke.unknown.mayChange": "Le résultat peut encore changer.",
	"rynke.gauges.heading": "Ta progression 🪙",
	"rynke.gauge.caption": "{label}\u00a0: {value} sur {target} · {percent}",
	"rynke.gauge.elevation":
		"Dénivelé\u00a0: {value} sur {target}, encore {missing} pour {step}",
	"rynke.gauge.step": "+{n}",
	"rynke.source.distance": "Distance",
	"rynke.source.elevation": "Dénivelé",
	"rynke.source.team_training": "Entraînement d'équipe",
	"rynke.source.training_weekend_day": "Journée du week-end d'entraînement",
	"rynke.source.technique_training": "Entraînement technique",
	"rynke.source.tour_de_paris": "Tour de Paris",
	"rynke.breakdown.heading": "D'où viennent tes Rynke",
	"rynke.breakdown.attended": "présent·e {count}×",
	"rynke.events.heading": "Tes événements d'équipe",
	"rynke.events.none":
		"Aucun événement d'équipe n'a encore été enregistré pour toi.",
	"rynke.events.notCounting":
		"ne compte pas\u00a0: hors de la période de comptage",

	"disconnect.title": "Supprimer tes données\u00a0?",
	"disconnect.explain":
		"RynkePoints renonce à son accès à ton compte Strava et supprime immédiatement toutes les données te concernant. Tes activités sur Strava restent telles quelles.",
	"disconnect.confirm": "Oui, tout supprimer",
	"disconnect.cancel": "Annuler",

	"notice.retry": "Réessayer",
	"notice.backToStart": "Retour à la page d'accueil",
	"notice.expired.title": "Connexion expirée",
	"notice.expired.body": "Ta connexion a expiré. Réessaie.",
	"notice.denied.title": "RynkePoints a besoin de lire tes activités",
	"notice.denied.body":
		"RynkePoints ne peut pas fonctionner sans cette autorisation.",
	"notice.consentRequired.title": "Donne d'abord ton accord",
	"notice.consentRequired.body":
		"Nous ne pouvons pas te connecter sans ton accord. Coche la case sur la page d'accueil.",
	"notice.teamFull.title": "L'équipe est complète pour l'instant",
	"notice.teamFull.body":
		"Strava ne permet pas à RynkePoints d'accueillir plus de cyclistes pour le moment. Nous te préviendrons quand il y aura de la place.",
	"notice.failed.title": "La connexion a échoué",
	"notice.failed.body": "La connexion à Strava n'a pas fonctionné. Réessaie.",
	"notice.notMember.title": "Réservé aux membres du club",
	"notice.notMember.body":
		"Seuls les membres de {clubLink} peuvent participer. Rejoins le club, puis réessaie.",
	"notice.nothingStored":
		"Nous n'avons créé aucun compte pour toi et n'avons gardé ni ton accès Strava ni tes activités.",
	"notice.stravaBusy.title": "Strava est occupé",
	"notice.stravaBusy.body": "Réessaie dans quelques minutes.",
	"notice.deleted.title": "Tes données ont été supprimées",
	"notice.deleted.body":
		"Nous avons supprimé toutes les données te concernant. Les copies dans les sauvegardes de notre hébergeur disparaissent au plus tard après 7 jours.",
	"notice.revokeFailed.body":
		"Nous n'avons pas pu renoncer à notre accès chez Strava. Retire RynkePoints sous «\u00a0Mes applications\u00a0» dans tes réglages Strava.",

	"install.button": "Installer comme application",
	"install.ios":
		"Comme application sur ton iPhone\u00a0: dans Safari, touche «\u00a0Partager\u00a0» puis «\u00a0Sur l'écran d'accueil\u00a0».",
	"install.firefox":
		"Comme application avec Firefox\u00a0: touche le menu ⋮ puis «\u00a0Installer\u00a0» ou «\u00a0Ajouter à l'écran d'accueil\u00a0».",
	"install.macSafari":
		"Comme application sur ton Mac\u00a0: dans Safari, choisis «\u00a0Fichier\u00a0» > «\u00a0Ajouter au Dock\u00a0».",
	"prompt.install.text":
		"Installe RynkePoints comme application sur ton écran d'accueil.",
	"prompt.notify.text":
		"On te prévient quand tu reçois de nouveaux Rynke\u00a0?",
	"prompt.notify.accept": "Activer les notifications",
	"prompt.notify.decline": "Pas maintenant",
	"prompt.close": "Fermer",

	"tour.label": "Premiers pas",
	"tour.progress": "{step} sur {total}",
	"tour.next": "Suivant",
	"tour.done": "Compris",
	"tour.skip": "Passer",
	"tour.start": "Montre-moi",
	"tour.example":
		"Données d'exemple\u00a0: voilà à quoi ça ressemble avec quelques sorties. Tu verras tes propres chiffres après la visite.",
	"tour.rider.intro":
		"Nouveau ou nouvelle ici\u00a0? On te montre où tout se trouve.",
	"tour.rider.team":
		"Équipe\u00a0: comment va toute l'équipe et où tu te situes dans le classement.",
	"tour.rider.peloton":
		"Le peloton\u00a0: tout le monde dans l'équipe selon ses Rynke d'entraînement, sans noms\u00a0; ta pièce est marquée. Plus c'est à droite, plus il y a de Rynke. Qui est bien devant les autres est dans le breakaway.",
	"tour.rider.you":
		"Toi\u00a0: tes Rynke et ce qu'il te manque pour te qualifier.",
	"tour.rider.elevation":
		"Le compteur de dénivelé\u00a0: chaque tranche de {elevationM} mètres de montée te rapporte {elevationRynke} Rynke d'entraînement. Il montre combien de mètres il te faut encore pour les suivants.",
	"tour.rider.teamRynke":
		"Les Rynke d'équipe ne viennent que des événements d'équipe auxquels les organisateurs t'ont ajouté·e\u00a0: {teamTraining} pour un entraînement d'équipe, {weekendDay} pour une journée du week-end d'entraînement, {technique} pour un entraînement technique. Il t'en faut {teamThreshold} pour Paris.",
	"tour.rider.outdoor":
		"Au plus {virtualShare} de tes Rynke d'entraînement peuvent venir de sorties virtuelles. Cette barre compte tout le reste\u00a0: au moins {outside} sur {trainingThreshold} Rynke d'entraînement doivent venir de sorties dehors, événements d'équipe compris.",
	"tour.rider.rides":
		"Sorties\u00a0: chaque sortie et ce qu'elle a rapporté. Celle-ci ne compte pas. «\u00a0Pourquoi\u00a0?\u00a0» explique ce qui n'a pas marché et ce que tu peux faire.",
	"tour.rider.shortRide":
		"Chaque tranche complète de {distanceKm} km d'une sortie rapporte {distanceRynke} Rynke d'entraînement. Cette sortie était plus courte\u00a0: elle compte, mais ne rapporte pas de Rynke pour sa distance. Son dénivelé va quand même au compteur.",
	"tour.rider.badges":
		"Badges\u00a0: les tiens et ceux de l'équipe, et le chemin jusqu'au prochain.",
	"tour.rider.events":
		"Événements\u00a0: les événements de l'équipe. Dis à l'avance si tu viens, et signale ensuite que tu y étais. Une fois que les organisateurs t'ont ajouté·e, tu reçois des Rynke d'équipe.",
	"tour.rider.settings":
		"Réglages\u00a0: langue, notifications, ta connexion Strava, les règles, et cette visite à nouveau.",
	"tour.rider.theme":
		"Choisis le thème de couleurs ici en haut, pour cet appareil. Confetti et Disco fêtent chaque changement de section\u00a0; on peut le désactiver dans les Réglages.",
	"tour.organiser.intro":
		"Tu es maintenant organisateur ou organisatrice\u00a0: l'onglet Orga est nouveau. On te fait le tour.",
	"tour.organiser.riders":
		"Cyclistes\u00a0: tout le monde dans l'équipe avec ses Rynke d'entraînement et d'équipe et ce qu'il lui manque.",
	"tour.organiser.example":
		"Équipe d'exemple\u00a0: voilà à quoi ressemble Orga en pleine saison. Rien n'est cliquable ici\u00a0; tu verras la vraie équipe après la visite.",
	"tour.organiser.groups":
		"Les groupes\u00a0: «\u00a0Besoin d'un coup de pouce\u00a0» est en retard sur le rythme, «\u00a0Dans le rythme\u00a0» suit le plan, «\u00a0Objectif atteint\u00a0» a tout. Touche une tuile pour ne voir que ses cyclistes. D'abord\u00a0: tous ceux qui ont un signalement ouvert.",
	"tour.organiser.pace":
		"La marque sur chaque barre est le rythme régulier jusqu'à la date limite. Les cyclistes à sa gauche ont besoin d'un coup de pouce. Touche un nom pour ouvrir ses corrections\u00a0: Rynke ajoutés ou retirés, avec une raison.",
	"tour.organiser.requests":
		"Signalements\u00a0: des cyclistes te disent qu'ils étaient à un événement d'équipe. «\u00a0Ajouter\u00a0» leur donne les Rynke de l'événement, ✕ refuse. Tu peux annuler l'un ou l'autre pendant un court moment.",
	"tour.organiser.newEvent":
		"Ajoute ici les événements d'équipe\u00a0: type, date, et un nom si tu veux. Un entraînement d'équipe rapporte {teamTraining} Rynke d'équipe, une journée du week-end d'entraînement {weekendDay}, un entraînement technique {technique}.",
	"tour.organiser.upcoming":
		"Un événement à venir\u00a0: les cyclistes disent à l'avance s'ils viennent. Le nombre indique combien ont dit oui.",
	"tour.organiser.past":
		"Un événement passé\u00a0: ouvre-le et coche qui était là\u00a0; ce n'est qu'alors que les Rynke comptent. Les cases grises sont des signalements ouverts. Si tu y étais toi-même, touche «\u00a0J'y étais aussi\u00a0».",
	"offline.title": "Pas de connexion",
	"offline.body":
		"RynkePoints a besoin d'une connexion internet. Réessaie dans un instant.",
	"push.body": "Nouveaux Rynke – touche pour voir",
	"push.body.rise": "Nouveaux Rynke\u00a0: {rise}.",
	"push.body.riseMissing":
		"Nouveaux Rynke\u00a0: {rise}. Il te manque encore {missing}.",
	"push.rise.training": "+{n} Rynke d'entraînement",
	"push.rise.team": "+{n} Rynke d'équipe",
	"notifications.heading": "Notifications",
	"notifications.explain":
		"Cet appareil te prévient quand tu as de nouveaux Rynke, et de ce qu'il te manque.",
	"notifications.on": "Activées sur cet appareil.",
	"notifications.off": "Désactivées sur cet appareil.",
	"notifications.blocked":
		"Ton appareil bloque les notifications de RynkePoints. Tu peux les autoriser dans les réglages de ton navigateur ou de ton appareil.",
	"notifications.needsHomeScreen":
		"Sur iPhone, les notifications ne fonctionnent que si RynkePoints est sur l'écran d'accueil. Ouvre-le ensuite depuis là.",
	"notifications.unsupported":
		"Ce navigateur ne peut pas afficher de notifications.",
	"notifications.failed": "Ça n'a pas marché. Réessaie.",

	// Feature 011: the app shell's sections, navigation and Settings groups.
	"nav.label": "Sections",
	"nav.you": "Toi",
	"nav.rides": "Sorties",
	"nav.team": "Équipe",
	"nav.badges": "Badges",
	"nav.organiser": "Orga",
	"nav.settings": "Réglages",
	"nav.settings.short": "Réglages",
	"shell.refresh": "Actualiser",
	"shell.title": "{section} – RynkePoints",
	"hero.training": "{n} Rynke d'entraînement",
	"hero.team": "{n} Rynke d'équipe",
	"celebrate.training":
		"+{n} Rynke d'entraînement depuis ta dernière visite 🎉",
	"celebrate.team": "+{n} Rynke d'équipe depuis ta dernière visite 🎉",
	"celebrate.both":
		"+{training} Rynke d'entraînement et +{team} Rynke d'équipe depuis ta dernière visite 🎉",
	"landing.tagline": "Collectionne tes Rynke",
	"settings.language": "Langue",
	"theme.button": "Thème de couleurs",
	"theme.menu.title": "Thème de couleurs",
	"theme.menu.close": "Fermer",
	"theme.menu.note": "S'applique uniquement à cet appareil.",
	"theme.auto": "Automatique",
	"theme.auto.hint": "Comme l'appareil\u00a0: Rynke Day ou Night",
	"theme.group.light": "Clairs",
	"theme.group.dark": "Sombres",
	"theme.group.contrast": "Contraste élevé",
	"theme.sparkle": "Paillettes",
	"theme.name.rynke-day": "Rynke Day",
	"theme.name.baltic": "Baltique",
	"theme.name.paris": "Paris",
	"theme.name.lilac": "Lilas",
	"theme.name.confetti": "Confetti",
	"theme.name.rynke-night": "Rynke Night",
	"theme.name.night-ride": "Sortie de nuit",
	"theme.name.forest": "Forêt",
	"theme.name.plum": "Prune",
	"theme.name.disco": "Disco",
	"theme.name.contrast-light": "Contraste élevé clair",
	"theme.name.contrast-dark": "Contraste élevé sombre",
	"settings.app": "Application",
	"settings.strava": "Connexion Strava",
	"settings.account": "Compte",
	"settings.shows": "Animations",
	"settings.shows.on":
		"Animations au changement de section dans Confetti et Disco",
	"settings.tour": "Visites guidées",
	"settings.tour.rider": "Revoir la visite",
	"settings.tour.organiser": "Revoir la visite Orga",
	"rynke.ride.why": "Pourquoi\u00a0?",
	"notifications.switch": "Notifications sur cet appareil",
	"brand.poweredByStrava.srcDark": "/strava/en/powered-by-strava-white.svg",
	"brand.connectWithStrava.srcDark": "/strava/en/connect-with-strava-white.svg",

	"error.notFound.title": "Page introuvable",
	"error.notFound.body": "Cette page n'existe pas.",
	"error.forbidden.title": "Requête refusée",
	"error.forbidden.body": "Recharge la page et réessaie.",

	"organiser.title": "Organisation",
	"organiser.back": "Retour aux événements",
	"organiser.switch.label": "Vues Orga",
	"organiser.switch.riders": "Cyclistes",
	"organiser.switch.events": "Événements",
	"organiser.formerOrganiser": "un ancien organisateur",
	"organiser.changedBy": "Dernière modification par {name} le {date}",
	"organiser.error.unknown_kind": "Choisis un type d'événement.",
	"organiser.error.invalid_date": "Saisis une date valide.",
	"organiser.error.invalid_name":
		"Le nom peut contenir au plus 100 caractères.",
	"organiser.error.event_missing": "Cet événement n'existe plus.",
	"organiser.error.rider_not_connected":
		"Un·e cycliste est parti·e ou doit d'abord se reconnecter.",
	"organiser.error.outside_season": "La date est en dehors de la saison.",
	"organiser.error.future_event":
		"La présence peut être enregistrée une fois l'événement passé.",
	"organiser.error.rider_not_listed":
		"La liste des cyclistes a changé. Vérifie-la et enregistre à nouveau.",
	"organiser.error.invalid_amount":
		"Saisis des nombres entiers\u00a0; au moins un ne doit pas être 0.",
	"organiser.error.invalid_reason":
		"Indique une raison de 200 caractères au plus.",
	"organiser.error.correction_missing": "Cette correction n'existe plus.",
	"organiser.done.created": "Événement ajouté.",
	"organiser.done.saved": "Enregistré.",
	"organiser.done.deleted": "Événement supprimé.",
	"organiser.done.attendance": "Présence enregistrée.",
	"organiser.done.added": "Correction ajoutée.",
	"organiser.done.removed": "Correction retirée.",
	"organiser.events.heading": "Événements d'équipe de la saison",
	"organiser.events.none": "Pas encore d'événement d'équipe cette saison.",
	"organiser.events.attendees": "Personnes\u00a0: {count}",
	"organiser.events.new": "Nouvel événement",
	"organiser.event.heading": "Modifier l'événement",
	"organiser.field.kind": "Type",
	"organiser.field.date": "Date",
	"organiser.field.name": "Nom (facultatif)",
	"organiser.add": "Ajouter",
	"organiser.save": "Enregistrer",
	"organiser.event.delete": "Supprimer l'événement…",
	"organiser.event.deleteWarning":
		"Cela supprime l'événement et les présences\u00a0; les Rynke des cyclistes suivent.",
	"organiser.event.deleteConfirm": "Oui, supprimer",
	"organiser.attendance.heading": "Qui était là\u00a0?",
	"organiser.attendance.save": "Enregistrer la présence",
	"organiser.attendance.profile": "View on Strava",
	"organiser.attendance.future":
		"La présence peut être enregistrée une fois l'événement passé.",
	"organiser.attendance.none":
		"Personne qui partage ses données avec l'équipe n'est encore connecté.",
	"organiser.riders.back": "Retour à la vue d'ensemble",
	"organiser.corrections.heading": "Corrections pour {name}",
	"organiser.corrections.none": "Pas encore de correction.",
	"organiser.corrections.new": "Nouvelle correction",
	"organiser.corrections.training": "{amount} Rynke d'entraînement",
	"organiser.corrections.team": "{amount} Rynke d'équipe",
	"organiser.field.training": "Rynke d'entraînement (+ ou −, vide vaut 0)",
	"organiser.field.team": "Rynke d'équipe (+ ou −, vide vaut 0)",
	"organiser.field.reason": "Raison",
	"organiser.corrections.remove": "Retirer…",
	"organiser.corrections.removeWarning":
		"Cela retire la correction\u00a0; les Rynke du ou de la cycliste suivent.",
	"organiser.corrections.removeConfirm": "Oui, retirer",

	// Feature 016: the Team page (contracts/messages.md "Team page").
	"team.heading": "Équipe",
	"team.total.label": "{team}",
	"team.total.training": "{n} Rynke d'entraînement",
	"team.total.team": "{n} Rynke d'équipe",
	"team.total.kind": "collectés ensemble",
	"team.total.thisWeek": "+{n} cette semaine 🔥",
	"team.kind.label": "Quels Rynke",
	"team.kind.training": "Entraînement",
	"team.kind.team": "Équipe",
	"team.place": "Place {place} sur {count} 🚴",
	"team.place.next": "{n} Rynke pour la place suivante",
	"team.place.lead": "Tu mènes le peloton. Emmène les autres\u00a0!",
	"team.peloton.heading": "Le peloton 🚴",
	"team.peloton.hint":
		"Chaque pièce est un·e cycliste. La tête roule à droite.",
	"team.peloton.back": "Queue du peloton",
	"team.peloton.front": "Tête 🏁",
	"team.peloton.label":
		"Cyclistes\u00a0: {count}, entre {min} et {max} Rynke\u00a0; tu en as {own}",
	"team.peloton.you": "Toi",
	"team.peloton.breakaway": "Breakaway 🏁",
	"team.peloton.hint.breakaway":
		"Chaque pièce est un·e cycliste. Tout à droite, après l'écart, roule l'échappée.",
	"team.peloton.label.breakaway":
		"Cyclistes\u00a0: {count}, entre {min} et {max} Rynke, dont {away} dans l'échappée\u00a0; tu en as {own}",
	"team.list.heading": "Classement",
	"team.list.count": "Cyclistes listés\u00a0: {n}",
	"team.list.hint": "Pas de noms. La ligne montre la saison jusqu'ici.",
	"team.list.scope": "Afficher",
	"team.list.around": "Autour de toi",
	"team.list.everyone": "Tout le monde",
	"team.list.ahead": "· · · devant\u00a0: {n} · · ·",
	"team.list.behind": "· · · derrière\u00a0: {n} · · ·",
	"team.list.you": "Toi",
	"team.list.weeks": "Semaine par semaine\u00a0: {values}",
	"team.chart.heading": "L'équipe, semaine par semaine",
	"team.chart.hint":
		"Les barres montrent ce que l'équipe a collecté chaque semaine, la ligne le cumul.",
	"team.chart.now": "cette semaine",
	"team.chart.label":
		"{kind} de l'équipe par semaine et en cumul, {weeks} semaines, actuellement {total}",
	"team.chart.best":
		"Meilleure semaine d'équipe jusqu'ici\u00a0: +{n} la semaine finissant le {date} 🔥",
	"team.chart.table": "Toutes les semaines",
	"team.chart.week": "Semaine finissant le",
	"team.chart.total": "Total",
	"team.chart.gain": "Gain",

	// Feature 032: the ride figures on /team (contracts/messages.md).
	"team.rankBy.label": "Classer par",
	"team.rankBy.rynke": "Rynke",
	"team.rankBy.sessions": "Séances",
	"team.rankBy.km": "km",
	"team.rankBy.elevation": "Dénivelé",
	"team.period.label": "Période",
	"team.period.season": "Saison",
	"team.period.month": "Mois",
	"team.period.week": "Semaine",
	"team.ride.hint":
		"Pas de noms. Les mêmes sorties comptent que pour les Rynke.",
	"team.ride.session": "{n} séance",
	"team.ride.sessions": "{n} séances",
	"team.ride.km": "{n} km",
	"team.ride.elevation": "{n} m",
	"team.ride.by.sessions": "par séances",
	"team.ride.by.km": "par kilomètres",
	"team.ride.by.elevation": "par dénivelé",
	"team.ride.place.by": "{figure}, {period}",
	"team.ride.place.next": "encore {n} pour la place suivante",
	"team.ride.place.lead": "Tu es devant.",
	"team.ride.yours":
		"Tes chiffres, {period}\u00a0: {sessions} · {km} · {elevation}",
	"team.ride.typical": "Sortie type\u00a0: {n}",
	"team.ride.typical.hint":
		"La moitié des sorties est plus longue, l'autre plus courte.",
	"team.ride.row.typical": "en général {n}",
	"team.ride.teamLine":
		"L'équipe, {period}\u00a0: {km} · {sessions} · {elevation} · sortie type {typical}",
	"team.ride.nobodyYet": "Personne n'a encore roulé sur cette période.",
	"team.ride.bar": "{value} sur les {lead} de la tête",
	"team.ride.total.heading": "Les kilomètres de l'équipe",
	"team.ride.total.kind": "roulés ensemble",
	"team.ride.total.thisWeek": "+{n} km cette semaine 🔥",
	"team.ride.chart.heading": "Kilomètres, semaine par semaine",
	"team.ride.chart.hint":
		"Les barres montrent les kilomètres de l'équipe chaque semaine, la ligne le cumul.",
	"team.ride.chart.label":
		"Kilomètres de l'équipe par semaine et en cumul, {weeks} semaines, actuellement {total}",

	// Feature 016: the organiser overview (contracts/messages.md "Organiser overview").
	"organiser.overview.heading": "Vue d'ensemble de l'équipe",
	"organiser.overview.deadline": "Date limite de qualification · {date}",
	"organiser.overview.daysLeft": "Jours restants\u00a0: {n} ⏳",
	"organiser.overview.deadlinePassed": "La date limite est passée",
	"organiser.overview.qualified":
		"{n} sur {count} ont atteint leur objectif d'entraînement 🎯",
	"organiser.overview.groups": "Groupes",
	"organiser.overview.group.push": "Besoin d'un coup de pouce",
	"organiser.overview.group.notYet":
		"Objectif d'entraînement pas encore atteint",
	"organiser.overview.group.onTrack": "Dans le rythme",
	"organiser.overview.group.in": "Objectif d'entraînement atteint",
	"organiser.overview.group.all": "Tout le monde",
	"organiser.overview.showing": "Affiché\u00a0: {group}",
	"organiser.overview.hint":
		"La marque sur chaque barre indique le rythme régulier jusqu'à la date limite\u00a0: aujourd'hui {training} Entraînement et {team} Équipe.",
	"organiser.overview.hint.percent":
		"La marque sur chaque barre indique le rythme régulier jusqu'à la date limite\u00a0: aujourd'hui {training} de l'Entraînement et {team} de l'Équipe.",
	"organiser.overview.training.percent": "Entraînement {n}",
	"organiser.overview.team.percent": "Équipe {n}",
	"organiser.overview.behind.training": "Entraînement en retard sur le rythme",
	"organiser.overview.behind.team": "Équipe en retard sur le rythme",
	"organiser.overview.reason.outdoor":
		"Pas encore assez d'entraînement en extérieur",
	"organiser.overview.training": "Entraînement {n} sur {threshold}",
	"organiser.overview.team": "Équipe {n} sur {threshold}",
	"organiser.overview.outdoor": "Entraînement en extérieur {n} sur {required}",
	"organiser.overview.toGo.training": "Entraînement\u00a0: encore {n}",
	"organiser.overview.toGo.team": "Équipe\u00a0: encore {n}",
	"organiser.overview.toGo.outdoor": "Extérieur\u00a0: encore {n}",
	"organiser.overview.toGo.short": "encore {n}",
	"organiser.overview.behind": "en retard sur le rythme",
	"organiser.overview.breakdown": "D'où viennent les Rynke",
	"organiser.overview.distance": "Distance {n}",
	"organiser.overview.elevation": "Dénivelé {n}",
	"organiser.overview.event":
		"{kind}\u00a0: {attended}× → {training} Entraînement, {team} Équipe",
	"organiser.overview.corrections":
		"Corrections {training} Entraînement, {team} Équipe",
	"organiser.overview.virtual": "Sorties virtuelles {n} % de l'Entraînement",
	"organiser.overview.amounts": "{training} Entraînement, {team} Équipe",
	"organiser.overview.percent": "{n} %",
	"organiser.overview.qualifiedList": "Objectif d'entraînement atteint 🎯",
	"organiser.overview.qualifiedHint":
		"Les deux seuils et la part en extérieur sont atteints.",
	"organiser.overview.nobodyYet":
		"Personne n'a encore atteint l'objectif d'entraînement.",
	"organiser.overview.none": "Aucun·e cycliste ne partage encore ses Rynke.",
	"organiser.overview.column.name": "Cycliste",
	"organiser.overview.column.group": "Groupe",
	"organiser.overview.column.training": "Entraînement",
	"organiser.overview.column.team": "Équipe",
	"organiser.overview.column.distance": "Distance",
	"organiser.overview.column.elevation": "Dénivelé",
	"organiser.overview.column.corrections": "Corrections",
	"organiser.overview.column.rynke": "Rynke",
	"organiser.overview.column.virtual": "Virtuel",
	"organiser.overview.column.sessions": "Séances",
	"organiser.overview.column.typical": "type",
	"organiser.overview.column.typical.hint":
		"Sortie type\u00a0: la moitié des sorties est plus longue, l'autre plus courte",
	"organiser.overview.typical": "en général {n} km",
	"organiser.overview.sessions": "Séances {n}",
	"organiser.overview.sessions.typical": "Séances {n}, en général {typical} km",

	// Feature 013: the Abzeichen section (contracts/badge-messages.md).
	"badges.heading": "Badges",
	"badges.personal.newest": "Tes badges",
	"badges.personal.all": "Tous tes badges ({n})",
	"badges.team.newest": "Badges d'équipe",
	"badges.team.all": "Tous les badges d'équipe ({n})",
	"badges.switch.group": "Badges de qui",
	"badges.switch.personal": "Les tiens",
	"badges.switch.team": "Équipe",
	"badges.switch.scope": "Afficher",
	"badges.switch.newest": "Récents",
	"badges.switch.all": "Tous",
	"badges.empty": "Pas encore de badge – ta première sortie t'en rapproche.",
	"badges.missing": "encore {value}",
	"badges.next": "Prochain badge",
	"badges.first": "Premier badge",
	"badges.earnedOn": "obtenu le {date}",
	"badges.close": "Fermer",
	"badges.label": "{name}, {value}",
	"badges.reveal.one": "Nouveau badge\u00a0: {name}",
	"badges.reveal.many": "Nouveaux badges\u00a0: {n}",
	"badges.category.distance": "Distance",
	"badges.category.elevation": "Dénivelé",
	"badges.category.team_events": "Événements d'équipe",
	"badges.category.technique": "Entraînement technique",
	"badges.category.training_rynke": "Rynke d'entraînement",
	"badges.category.run_length": "Plus longue course",
	"badges.category.running": "Course au total",
	"badges.category.ride_length": "Plus longue sortie",
	"badges.category.virtual_rides": "Virtuel",
	"badges.category.swim_length": "Plus longue nage",
	"badges.category.swimming": "Natation au total",
	"badges.category.winter_november": "Hiver\u00a0: novembre",
	"badges.category.winter_december": "Hiver\u00a0: décembre",
	"badges.category.winter_january": "Hiver\u00a0: janvier",
	"badges.category.winter_february": "Hiver\u00a0: février",
	"badges.category.surprise": "Surprises",
	"badges.category.team_training_rynke": "Rynke d'entraînement ensemble",
	"badges.category.team_distance": "Distance ensemble",
	"badges.category.team_elevation": "Dénivelé ensemble",
	"badges.category.team_running": "Course ensemble",
	"badges.category.big_training": "Grand entraînement",
	"badges.category.attendances": "Présences",
	"badges.category.tour_de_paris": "Tour de Paris",
	"badges.category.team_surprise": "Surprises d'équipe",
	"badges.about.distance": "Kilomètres des sorties à Rynke d'entraînement.",
	"badges.about.elevation": "Dénivelé des sorties à Rynke d'entraînement.",
	"badges.about.team_events": "Chaque événement d'équipe où tu étais.",
	"badges.about.technique": "Un pour le premier, un pour les deux.",
	"badges.about.training_rynke":
		"Tous les Rynke d'entraînement que tu as collectés.",
	"badges.about.run_length": "Ta plus longue course d'une traite, dehors.",
	"badges.about.running": "Tous les kilomètres que tu as courus dehors.",
	"badges.about.ride_length": "Plus longue sortie à Rynke d'entraînement.",
	"badges.about.virtual_rides": "Kilomètres sur home trainer et en virtuel.",
	"badges.about.swim_length": "Ta plus longue nage d'une traite, n'importe où.",
	"badges.about.swimming": "Tous les kilomètres que tu as nagés.",
	"badges.about.winter_november": "Jours de novembre avec une sortie dehors.",
	"badges.about.winter_december": "Jours de décembre avec une sortie dehors.",
	"badges.about.winter_january": "Jours de janvier avec une sortie dehors.",
	"badges.about.winter_february": "Jours de février avec une sortie dehors.",
	"badges.about.surprise": "?",
	"badges.about.team_training_rynke":
		"Les Rynke d'entraînement de tout le monde réunis.",
	"badges.about.team_distance": "Les kilomètres à vélo de toute l'équipe.",
	"badges.about.team_elevation": "Le dénivelé à vélo de toute l'équipe.",
	"badges.about.team_running": "Les kilomètres courus de toute l'équipe.",
	"badges.about.big_training":
		"Le plus de cyclistes à un même événement d'équipe.",
	"badges.about.attendances": "Toutes les présences aux événements d'équipe.",
	"badges.about.tour_de_paris": "Chaque jour du tour que tu as roulé.",
	"badges.about.team_surprise": "?",
	"badges.for.distance": "Tu as roulé {value} à vélo cette saison.",
	"badges.for.elevation": "Tu as grimpé {value} à vélo cette saison.",
	"badges.for.team_events": "Tu as participé cette saison\u00a0: {value}.",
	"badges.for.technique": "Tu as suivi cette saison\u00a0: {value}.",
	"badges.for.training_rynke":
		"Tu as collecté {value} à l'entraînement cette saison.",
	"badges.for.run_length":
		"Ta plus longue course cette saison\u00a0: {value} d'une traite.",
	"badges.for.running": "Tu as couru {value} cette saison.",
	"badges.for.ride_length":
		"Ta plus longue sortie cette saison\u00a0: {value} d'une traite.",
	"badges.for.virtual_rides": "Tu as roulé {value} en virtuel cette saison.",
	"badges.for.swim_length":
		"Ta plus longue nage cette saison\u00a0: {value} d'une traite.",
	"badges.for.swimming": "Tu as nagé {value} cette saison.",
	"badges.for.winter_november": "En novembre\u00a0: {value} dehors à vélo.",
	"badges.for.winter_december": "En décembre\u00a0: {value} dehors à vélo.",
	"badges.for.winter_january": "En janvier\u00a0: {value} dehors à vélo.",
	"badges.for.winter_february": "En février\u00a0: {value} dehors à vélo.",
	"badges.for.team_training_rynke":
		"Tous ensemble, les cyclistes ont collecté {value} à l'entraînement cette saison.",
	"badges.for.team_distance":
		"Tous ensemble, les cyclistes ont roulé {value} cette saison.",
	"badges.for.team_elevation":
		"Tous ensemble, les cyclistes ont grimpé {value} à vélo cette saison.",
	"badges.for.team_running":
		"Tous ensemble, les cyclistes ont couru {value} cette saison.",
	"badges.for.big_training":
		"À un même événement d'équipe sont venus\u00a0: {value}.",
	"badges.for.attendances":
		"Tous les événements d'équipe de la saison réunis ont eu {value}\u00a0: chaque cycliste à chaque événement compte pour un.",
	"badges.tourDay.for": "Jour {day} du Tour de Paris – le lieu suivra.",
	"badges.value.km": "{n} km",
	"badges.value.m": "{n} m",
	"badges.value.rynke": "{n} Rynke",
	"badges.value.events": {
		one: "{n} événement d'équipe",
		many: "{n} événements d'équipe",
		other: "{n} événements d'équipe",
	},
	"badges.value.trainings": {
		one: "{n} entraînement technique",
		many: "{n} entraînements techniques",
		other: "{n} entraînements techniques",
	},
	"badges.value.riders": {
		one: "{n} cycliste",
		many: "{n} cyclistes",
		other: "{n} cyclistes",
	},
	"badges.value.attendances": {
		one: "{n} présence",
		many: "{n} présences",
		other: "{n} présences",
	},
	"badges.value.days": {
		one: "{n} jour",
		many: "{n} jours",
		other: "{n} jours",
	},
	"badges.value.tourDay": "Jour {n}",
	"badges.surprise.new-year": "Nouvel An",
	"badges.surprise.new-year.for": "Tu es sorti·e le jour de l'An.",
	"badges.surprise.christmas-eve": "Réveillon de Noël",
	"badges.surprise.christmas-eve.for": "Tu es sorti·e le soir de Noël.",
	"badges.surprise.christmas": "Noël",
	"badges.surprise.christmas.for": "Tu es sorti·e pendant les fêtes de Noël.",
	"badges.surprise.night-owl": "Oiseau de nuit",
	"badges.surprise.night-owl.for": "Tu es parti·e après 21 h 30.",
	"badges.surprise.early-bird": "Lève-tôt",
	"badges.surprise.early-bird.for": "Tu es parti·e avant 6 h.",
	"badges.surprise.rest-day": "Jour de repos",
	"badges.surprise.rest-day.for":
		"Actif ou active chaque jour pendant une semaine – puis un jour de repos. Bien mérité\u00a0!",
	"badges.surprise.day-off": "Jour off de l'équipe",
	"badges.surprise.day-off.for": "Un jour où toute l'équipe a levé le pied.",
	"badges.surprise.all-out": "Tous dehors",
	"badges.surprise.all-out.for":
		"Un jour où vraiment tout le monde était dehors.",
	"badges.surprise.round-the-clock": "Jour et nuit",
	"badges.surprise.round-the-clock.for":
		"Quelqu'un de l'équipe était dehors à chaque heure d'une journée.",
	"badges.surprise.relay": "Relais",
	"badges.surprise.relay.for":
		"30 jours d'affilée, quelqu'un de l'équipe a été actif chaque jour.",
	"badges.surprise.new-years-eve": "Saint-Sylvestre",
	"badges.surprise.new-years-eve.for":
		"Au moins cinq de l'équipe étaient dehors le soir du 31 décembre.",
	"badges.surprise.sunday-outing": "Sortie du dimanche",
	"badges.surprise.sunday-outing.for":
		"Au moins dix de l'équipe dehors un dimanche sans événement d'équipe.",
	"badges.surprise.festive-500": "Festive 500",
	"badges.surprise.festive-500.for":
		"500 kilomètres roulés entre le 24 et le 31 décembre.",
	"badges.surprise.stage-rider": "Coureur d'étapes",
	"badges.surprise.stage-rider.for":
		"100 kilomètres trois jours de suite – comme sur le tour.",
	"badges.surprise.triathlon": "Triathlon",
	"badges.surprise.triathlon.for": "Vélo, course et natation le même jour.",
	"badges.surprise.pi-day": "Jour de Pi",
	"badges.surprise.pi-day.for":
		"Au moins 31,4 kilomètres d'une traite le jour de Pi, le 14 mars.",
	"badges.surprise.solstice": "Solstice",
	"badges.surprise.solstice.for":
		"Sorti·e dehors le jour le plus court et le plus long de l'année.",
	"badges.surprise.easter": "Pâques",
	"badges.surprise.easter.for": "En sortie à Pâques.",
	"badges.surprise.everesting": "Everesting",
	"badges.surprise.everesting.for":
		"8 848 mètres de dénivelé en un mois – une fois l'Everest.",
	"badges.surprise.winter-sleep": "Hibernation",
	"badges.surprise.winter-sleep.for":
		"Ta première sortie dehors de la nouvelle année.",
	"badges.surprise.festive-team": "Festive Team",
	"badges.surprise.festive-team.for":
		"Toute l'équipe a roulé entre le 24 et le 31 décembre.",
	"badges.value.half": "Semi-marathon",
	"badges.value.piRun": "Pi-Run",
	"badges.value.marathon": "Marathon",
	"notification.badge": "Nouveau badge\u00a0: {name} 🏅",
	"notification.badges": "Nouveaux badges\u00a0: {n} 🏅",
	"notification.teamBadge": "Nouveau badge d'équipe\u00a0: {name} 🏅",
	"notification.teamBadges": "Nouveaux badges d'équipe\u00a0: {n} 🏅",

	"privacy.link": "Confidentialité et contact",
	"privacy.title": "Confidentialité",
	"privacy.updated": "Dernière mise à jour\u00a0: {date}",
	"privacy.intro":
		"Voici quelles données RynkePoints traite, dans quel but, qui les voit, combien de temps elles sont conservées et quels sont tes droits.",
	"privacy.controller.heading": "Qui est responsable, et comment nous joindre",
	"privacy.controller.body":
		"Le responsable du traitement des données dans RynkePoints est\u00a0:",
	"privacy.contact.body":
		"Pour toute question, de l'aide, une copie de tes données ou leur suppression, écris à {email}.",
	"privacy.purpose.heading": "Pourquoi RynkePoints traite des données",
	"privacy.purpose.body":
		"RynkePoints est l'application d'entraînement de la {team}. Elle lit les chiffres clés de tes activités sur Strava, les transforme en Rynke (points d'entraînement) et en badges, et les montre à toi, à l'équipe et aux organisateurs. Pas de publicité, pas de paiements, pas de pistage, pas d'outils d'analyse. Les données ne sont jamais vendues ni transmises, et jamais utilisées pour l'IA ou l'apprentissage automatique.",
	"privacy.strava.heading": "Données issues de Strava",
	"privacy.strava.rider":
		"Sur toi\u00a0: ton identifiant d'athlète Strava, ton prénom, les autorisations que tu as accordées et les clés d'accès (jetons), stockées chiffrées.",
	"privacy.strava.rides":
		"Pour chaque sortie\u00a0: identifiant d'activité, titre, type de sport, heure de départ et fuseau horaire, distance, temps en mouvement et total, dénivelé, et si elle a été saisie à la main, faite sur home trainer, est privée ou a été signalée par Strava.",
	"privacy.strava.runsSwims":
		"Pour chaque course et chaque nage, seulement l'identifiant d'activité, l'heure de départ, la distance et si elle est privée, pour les badges de course et de natation.",
	"privacy.strava.private":
		"Seules les activités à partir du début de saison sont stockées, et les privées («\u00a0Moi uniquement\u00a0») uniquement si tu as accordé l'autorisation pour elles.",
	"privacy.strava.never":
		"Jamais lus ni stockés\u00a0: traces GPS, cartes, parcours, segments, photos, descriptions, fréquence cardiaque, puissance, cadence, calories ou autres données de santé, tes abonnés et les données d'autres athlètes.",
	"privacy.strava.how":
		"Strava signale de lui-même les activités nouvelles, modifiées et supprimées\u00a0; RynkePoints ne le sollicite pas sans cesse. Une fois par jour, RynkePoints vérifie que tu es toujours membre du club Strava de l'équipe.",
	"privacy.team.heading": "Données de l'équipe, et ce qui en est calculé",
	"privacy.team.body":
		"Les organisateurs enregistrent les événements d'équipe auxquels tu as participé et peuvent corriger tes Rynke avec une raison et une date. Tu peux indiquer toi-même à quels événements d'équipe tu viens ou as participé\u00a0; les organisateurs le voient et décident de l'enregistrer. Qui a modifié quoi, et quand, est aussi conservé.",
	"privacy.team.derived":
		"À partir de tout cela, RynkePoints calcule tes Rynke, tes badges, et quelles sorties comptent et pourquoi.",
	"privacy.team.rideFigures":
		"À partir de tes sorties comptées, RynkePoints compte les séances, les kilomètres et le dénivelé par saison, mois et semaine pour le classement sans noms, ainsi que ta sortie type, que seuls toi et les organisateurs voyez. Les organisateurs voient tes séances par saison et par jour avec ton prénom.",
	"privacy.technical.heading":
		"Données nécessaires au fonctionnement de l'application",
	"privacy.technical.cookies":
		"Cookies\u00a0: «\u00a0rp_session\u00a0» te garde connecté·e jusqu'à 180 jours après ta dernière visite\u00a0; «\u00a0rp_oauth_state\u00a0» protège la connexion avec Strava pendant 10 minutes\u00a0; «\u00a0rp_lang\u00a0» retient une langue choisie pendant un an. Il n'y a pas d'autres cookies ni de traceurs.",
	"privacy.technical.push":
		"Les notifications sont facultatives et propres à chaque appareil. Seule l'adresse que le service push de ton appareil ou navigateur lui donne est stockée. La notification elle-même est vide\u00a0: ce qu'elle affiche, ton appareil le récupère directement chez RynkePoints. L'adresse est supprimée quand tu désactives les notifications, te déconnectes sur cet appareil ou pars.",
	"privacy.technical.logs":
		"Les journaux du serveur ne contiennent que des identifiants comme ceux d'athlète et d'activité et le type d'une erreur, jamais de clés d'accès ni de données d'activité. RynkePoints ne stocke pas d'adresses IP.",
	"privacy.visibility.heading": "Qui voit quoi",
	"privacy.visibility.you":
		"Tu vois tes propres activités avec leurs titres, tes Rynke et tes badges. Personne d'autre ne voit les titres.",
	"privacy.visibility.team":
		"Tous les autres membres de l'équipe voient tes Rynke, au total et par semaine, sans ton nom. Tes kilomètres et ton dénivelé, ainsi que les jours et l'heure où tu es actif ou active, comptent dans les totaux et badges de l'équipe, sans ton nom.",
	"privacy.visibility.organisers":
		"Les organisateurs voient ton prénom, tes Rynke et leur origine, ce qu'il te manque, si tu as atteint ton objectif d'entraînement, tes événements d'équipe et corrections, à quels événements d'équipe tu as indiqué venir ou avoir participé, et tes kilomètres dehors et en virtuel et ton dénivelé en totaux par jour, mais aucune activité individuelle.",
	"privacy.visibility.public":
		"Rien de tout cela n'est public\u00a0: chaque page avec ces données exige que tu te connectes avec Strava.",
	"privacy.legal.heading": "Base juridique",
	"privacy.legal.body":
		"La lecture de tes données Strava et le partage de tes Rynke comme décrit reposent sur ton consentement, donné avant de te connecter (art. 6, paragraphe 1, point a du RGPD). Les événements d'équipe, les corrections, les cookies nécessaires et les journaux reposent sur l'intérêt légitime d'organiser l'entraînement de l'équipe et de faire fonctionner l'application en toute sécurité (art. 6, paragraphe 1, point f du RGPD\u00a0; pour les cookies § 25 (2) TDDDG).",
	"privacy.retention.heading": "Combien de temps les données sont conservées",
	"privacy.retention.body":
		"Tes données sont conservées tant que tu es connecté·e, et suivent Strava\u00a0: si tu supprimes une activité sur Strava, ou la rends privée sans avoir accordé l'autorisation pour cela, elle disparaît aussi ici dès que Strava le signale, généralement en quelques minutes. Les activités antérieures au début de saison sont supprimées.",
	"privacy.retention.deletion":
		"Toutes les données te concernant sont supprimées immédiatement, et l'accès sur Strava est révoqué là où il fonctionne encore, quand tu te déconnectes dans l'application, retires RynkePoints dans tes réglages Strava, quittes le club Strava de l'équipe (sous 24 heures) ou ne renouvelles pas une connexion rompue dans les 7 jours.",
	"privacy.retention.backups":
		"Ensuite, les données restent au plus 7 jours dans les sauvegardes automatiques de la base de données, puis elles disparaissent. Cloudflare supprime les journaux du serveur après 7 jours au plus.",
	"privacy.album":
		"À la fin de chaque saison, nous créons un album de saison en PDF pour chaque membre de l'équipe – à partir des données que tu vois dans l'application et de totaux sur toute l'équipe. Cela se fait sur l'ordinateur du responsable, pas chez Cloudflare. Toi seul·e reçois ton album, qui est ensuite supprimé.",
	"privacy.recipients.heading": "Qui traite les données",
	"privacy.recipients.cloudflare":
		"RynkePoints fonctionne chez Cloudflare, Inc. en tant que sous-traitant\u00a0: serveur web, file de travail et base de données. Pour livrer les pages et les protéger des attaques, Cloudflare traite nécessairement ton adresse IP. Cloudflare dispose de centres de données dans le monde entier, y compris aux États-Unis\u00a0; pour les transferts vers ce pays, Cloudflare est certifié selon l'EU-US Data Privacy Framework, et les clauses contractuelles types de l'UE s'appliquent.",
	"privacy.recipients.push":
		"Les services push des fabricants d'appareils et de navigateurs (comme Google, Apple, Mozilla, Microsoft) ne reçoivent que des notifications vides adressées à ton appareil.",
	"privacy.recipients.strava":
		"Strava est lui-même responsable des données de ton compte Strava. La {stravaPrivacy} s'applique et prévaut en cas de contradiction avec cette notice.",
	"privacy.recipients.stravaPrivacy": "politique de confidentialité de Strava",
	"privacy.recipients.usage":
		"Strava peut collecter des données d'utilisation sur la façon dont RynkePoints utilise l'API Strava, et les utiliser à toute fin commerciale, comme améliorer l'API et la plateforme Strava, fournir de l'assistance ou vérifier le respect de ses conditions.",
	"privacy.links.heading": "Liens vers Strava",
	"privacy.links.body":
		"Les liens vers Strava mènent à des pages gérées par Strava, seul responsable de leur contenu. RynkePoints ne fait pas sien ce contenu et n'a aucune influence sur lui. Si nous apprenons qu'une page liée contient un contenu illicite, nous retirons le lien.",
	"privacy.rights.heading": "Tes droits",
	"privacy.rights.body":
		"Tu as un droit d'accès, de rectification, d'effacement, de limitation du traitement, de portabilité et d'opposition (art. 15 à 21 du RGPD). Tu peux retirer ton consentement à tout moment, le plus simplement en te déconnectant dans l'application\u00a0; ce qui a eu lieu avant reste licite. Tu peux aussi déposer une réclamation auprès d'une autorité de protection des données, notamment là où tu vis. Pour tout, écris-nous à {email}.",
	"privacy.changes.heading": "Modifications",
	"privacy.changes.body":
		"Si ce que RynkePoints lit, ou qui le voit, change, nous te redemandons ton consentement avant que l'application te montre quoi que ce soit.",
	// Feature 019: team-event reports (contracts/messages.md).
	"nav.events": "Événements",
	"nav.organiser.open": "Orga, signalements ouverts\u00a0: {n}",
	"events.heading": "Événements d'équipe 📅",
	"events.until": "jusqu'au {date}",
	"events.note.title": "Signale-le toi-même ici",
	"events.note.body":
		"Nous ne pouvons pas encore récupérer ta participation aux événements d'équipe depuis Spond ou Strava. Indique-nous ici à quels événements tu viens ou as participé.",
	"events.upcoming": "À venir",
	"events.upcoming.hint":
		"«\u00a0Je viens\u00a0» prévient seulement les organisateurs. Tu reçois les Rynke une fois l'événement terminé et quand les organisateurs t'ont ajouté·e. D'ici là, tu peux changer d'avis à tout moment.",
	"events.upcoming.none": "Pas encore d'événement d'équipe prévu.",
	"events.past": "Passés",
	"events.past.none": "Pas encore d'événement d'équipe cette saison.",
	"events.past.all": "Tout afficher",
	"events.amount.team": "+{n} Équipe",
	"events.amount.training": "+{n} Entraînement",
	"events.join": "Je viens",
	"events.leave": "Je ne viens finalement pas",
	"events.joined.label": "Je viens. Touche pour annuler.",
	"events.report": "J'y étais",
	"events.reported.label": "J'y étais, signalé",
	"events.attended": "Tu y étais",
	"events.error.event_over":
		"L'événement est terminé\u00a0; tu ne peux plus annuler.",
	"events.error.already_attending": "Tu es déjà ajouté·e à cet événement.",
	"events.error.event_missing": "Cet événement n'existe plus.",
	"organiser.switch.events.open": "Événements, signalements ouverts\u00a0: {n}",
	"organiser.requests.heading": {
		one: "{n} signalement ouvert ⏳",
		many: "{n} signalements ouverts ⏳",
		other: "{n} signalements ouverts ⏳",
	},
	"organiser.requests.intro": {
		one: "Des cyclistes disent qu'ils y étaient – à {n} événement.",
		many: "Des cyclistes disent qu'ils y étaient – à {n} événements.",
		other: "Des cyclistes disent qu'ils y étaient – à {n} événements.",
	},
	"organiser.requests.open": "Ouvrir l'événement",
	"organiser.requests.confirm": "Ajouter",
	"organiser.requests.confirm.label": "Ajouter {name} à {event}",
	"organiser.requests.deny.label":
		"Refuser le signalement de {name} pour {event}",
	"organiser.requests.confirmAll": "Ajouter les {n}",
	"organiser.requests.wants": "⏳ Souhaite être ajouté·e\u00a0: {event}",
	"organiser.done.confirmed": "Ajouté·e(s)\u00a0: {names}.",
	"organiser.done.denied": "Signalement refusé\u00a0: {names}.",
	"organiser.done.undone": "Annulé.",
	"organiser.done.attendance.reports":
		"Enregistré\u00a0: {yes} ajoutés, {no} refusés, {open} ouverts.",
	"organiser.undo": "Annuler",
	"organiser.error.request_settled":
		"Quelqu'un d'autre a déjà traité ce signalement.",
	"organiser.error.undo_expired": "Ce n'est plus possible d'annuler.",
	"organiser.events.attendees.you": "Personnes\u00a0: {count}, toi compris·e",
	"organiser.events.intents": "Viennent\u00a0: {count}",
	"organiser.events.open": "⏳ Ouverts\u00a0: {count}",
	"organiser.events.self": "J'y étais aussi",
	"organiser.events.upcoming": "À venir",
	"organiser.events.past": "Passés",
	"organiser.attendance.headingFuture": "Qui vient\u00a0?",
	"organiser.attendance.count": "Présents\u00a0: {count}",
	"organiser.attendance.countFuture": "Viennent\u00a0: {count}",
	"organiser.attendance.legend": "Ce que montrent les cases",
	"organiser.attendance.legend.empty": "Vide – absent·e",
	"organiser.attendance.legend.grey": "Grise – signalement, encore ouvert",
	"organiser.attendance.legend.greyFuture": "Grise – vient",
	"organiser.attendance.legend.checked":
		"Cochée – présent·e, rapporte des Rynke",
	"organiser.attendance.confirmAll": "Ajouter les {n} signalements",
	"organiser.attendance.tag.open": "Signalement ouvert",
	"organiser.attendance.tag.yes": "sera ajouté·e",
	"organiser.attendance.tag.no": "sera refusé·e",
	"organiser.attendance.tag.intent": "vient",
	"organiser.attendance.summary":
		"Signalements\u00a0: {yes} seront ajoutés, {no} refusés, {open} ouverts",
	"organiser.overview.group.requests": "Cyclistes avec un signalement ouvert",
	"organiser.overview.column.requests": "Signalement",
	// The Overview's progress charts (feature 009 contracts/messages.md).
	"progress.heading": "Ta saison jusqu'ici",
	"progress.rules":
		"Calculé avec la version {version} des règles, pour toute la saison.",
	"progress.nothingYet": "Tu n'as pas encore gagné de Rynke cette saison.",
	"progress.periods.label": "Période",
	"progress.period.season": "Toute la saison",
	"progress.period.3m": "3 derniers mois",
	"progress.period.4w": "4 dernières semaines",
	"progress.chart.training":
		"Rynke d'entraînement du {from} au {to}\u00a0: {value} à la fin, objectif {threshold}",
	"progress.chart.team":
		"Rynke d'équipe du {from} au {to}\u00a0: {value} à la fin, objectif {threshold}",
	"progress.legend.threshold": "Objectif ({value})",
	"progress.help":
		"Les flèches choisissent un jour, + et − zooment, Page préc./suiv. déplacent, 0 montre toute la saison.",
	"progress.day":
		"{date} · {training} Rynke d'entraînement · {team} Rynke d'équipe",
	"progress.table.summary": "Les chiffres en tableau",
	"progress.table.week": "Semaine du",
	"progress.table.total": "Total",
	"progress.legend.pace": "Rythme régulier jusqu'à la date limite",
	"progress.legend.needed": "Nécessaire en extérieur ({value})",
	"progress.day.ahead": "{n} d'avance sur le rythme ({pace})",
	"progress.day.behind": "{n} de retard sur le rythme ({pace})",
	"progress.day.onPace": "pile dans le rythme ({pace})",
	"progress.day.series": "{series}\u00a0: {text}",
	"progress.day.outside": "dont en extérieur\u00a0: {value}",

	"album.title": "Album Rynke",
	"album.team.name": "{team}",
	"album.season": "Saison {season}",
	"album.owner": "Cet album appartient à",
	"album.coin": "La pièce Rynke",
	"album.rider.training": "Rynke d'entraînement",
	"album.rider.team": "Rynke d'équipe",
	"album.rider.events": "Événements d'équipe suivis",
	"album.team.heading": "La saison de l'équipe",
	"album.team.training": "{count} Rynke d'entraînement ensemble",
	"album.events.date": "Date",
	"album.events.kind": "Type",
	"album.events.name": "Nom",
	"album.events.riders": "Cyclistes",
	"album.events.you": "Toi",
	"album.events.attended": "présent·e",
	"album.events.none": "Pas encore d'événement d'équipe.",
	"album.events.count":
		"Événements d'équipe\u00a0: {count}, dont jours du Tour de Paris\u00a0: {tour}",
	"album.events.noTour":
		"Événements d'équipe\u00a0: {count}, pas encore de jour de tour",
	"album.events.yours": "tu y étais ({count})",
	"album.continued": "{title} (suite)",
	"album.stickers.mine": "Mes badges",
	"album.stickers.team": "Badges d'équipe",
	"album.stickers.count": "{earned} sur {total}",
	"album.stickers.secret": "?",
	"album.cutoff": "Au {date}",

	// Feature 025: the admin view.
	"nav.admin": "Admin",
	"admin.switch.label": "Vues admin",
	"admin.switch.usage": "Utilisation",
	"admin.switch.riders": "Cyclistes",
	"admin.allowance.strava_read_15m": "Lectures Strava par 15 minutes",
	"admin.allowance.strava_all_15m": "Requêtes Strava par 15 minutes",
	"admin.allowance.strava_read_daily": "Lectures Strava par jour",
	"admin.allowance.strava_all_daily": "Requêtes Strava par jour",
	"admin.allowance.riders_connected": "Cyclistes connecté·e·s",
	"admin.allowance.cf_worker_requests": "Requêtes Worker par jour",
	"admin.allowance.cf_queue_operations": "Opérations de file par jour",
	"admin.allowance.cf_d1_rows_read": "Lignes de base lues par jour",
	"admin.allowance.cf_d1_rows_written": "Lignes de base écrites par jour",
	"admin.allowance.cf_d1_storage_bytes": "Stockage de la base",
	"admin.gigabytes": "{n} Go",
	"admin.level.warning": "Avertissement",
	"admin.level.critical": "Critique",
	"admin.summary.ok": "Tous les chiffres sont sous 80 %.",
	"admin.summary.attention": "Chiffres à 80 % ou plus\u00a0: {n}",
	"admin.figure.numbers": "{used} sur {limit} · {percent} %",
	"admin.figure.split":
		"Cette équipe\u00a0: {team} · Non attribué\u00a0: {rest}",
	"admin.figure.teamCount": "{team}\u00a0: {n} ({percent}\u00a0%)",
	"admin.figure.teamNone": "{team}\u00a0: pas encore de chiffres",
	"admin.figure.rest": "Non attribué\u00a0: {n}",
	"admin.figure.notSplit":
		"Ce chiffre ne peut pas encore être réparti par équipe.",
	"admin.figure.windowNote":
		"Les requêtes des autres équipes comptent ici comme non attribuées\u00a0: les équipes n'échangent pas leurs chiffres sur 15\u00a0minutes.",
	"admin.teams.stale":
		"{team}\u00a0: pas de réponse lors du dernier relevé. Les chiffres datent du {time} UTC.",
	"admin.teams.other": "Autre équipe",
	"admin.teams.otherN": "Autre équipe {n}",
	"admin.teams.shared": "Partagé (passerelle)",
	"admin.teams.never":
		"{team}\u00a0: pas encore de réponse, les chiffres manquent donc.",
	"admin.figure.seen": "Au {time} UTC",
	"admin.figure.notSeen": "Pas encore observé",
	"admin.figure.noValue": "Pas encore de valeur. Limite\u00a0: {limit}",
	"admin.strava.heading": "Strava",
	"admin.cloudflare.heading": "Cloudflare",
	"admin.cloudflare.note":
		"Pour tout le compte, et approximatif\u00a0: les statistiques de Cloudflare ont du retard et ne servent pas à la facturation.",
	"admin.cloudflare.unavailable":
		"Les chiffres de Cloudflare sont indisponibles pour le moment. Voici les dernières valeurs connues.",
	"admin.refresh": "Mettre à jour",
	"admin.waiting.heading": "En attente du budget Strava",
	"admin.waiting.body": {
		one: "{n} élément en attente, terminé dans environ {time}.",
		many: "{n} éléments en attente, terminés dans environ {time}.",
		other: "{n} éléments en attente, terminés dans environ {time}.",
	},
	"admin.waiting.minutes": {
		one: "{n} minute",
		many: "{n} minutes",
		other: "{n} minutes",
	},
	"admin.waiting.hours": {
		one: "{n} heure",
		many: "{n} heures",
		other: "{n} heures",
	},
	"admin.waiting.days": {
		one: "{n} jour",
		many: "{n} jours",
		other: "{n} jours",
	},
	"admin.alerts.heading": "Alertes d'utilisation",
	"admin.alerts.on":
		"Tu reçois une notification quand un quota Strava ou Cloudflare ou le nombre de cyclistes connectés atteint 80 % ou 95 %.",
	"admin.alerts.off":
		"Tu ne reçois pas de notifications d'utilisation. Cette page marque quand même les chiffres.",
	"admin.alerts.turnOff": "Désactiver les alertes d'utilisation",
	"admin.alerts.turnOn": "Activer les alertes d'utilisation",
	"admin.alerts.noDevice":
		"Tu ne recevras pas d'alertes\u00a0: aucun de tes appareils n'a les notifications activées. Active-les dans {settings}.",
	"admin.history.days": "Chaque jour",
	"admin.history.hideDays": "Masquer les jours",
	"admin.history.none":
		"Rien d'enregistré pour l'instant. L'enregistrement a lieu une fois par heure.",
	"admin.history.since": "L'enregistrement a commencé le {date}.",
	"admin.history.chart":
		"{name}\u00a0: chaque jour en part de la limite, du {first} au {last}. Le tableau contient les chiffres.",
	"admin.history.day": "Jour",
	"admin.history.used": "Utilisé",
	"admin.history.limit": "Limite",
	"admin.history.share": "Part",
	"admin.history.team": "Cette équipe",
	"admin.history.peak": "Pic sur 15 min",
	"admin.history.percent": "{n} %",
	"admin.history.gap": "Rien d'enregistré",
	"admin.history.ridersNote":
		"Les cyclistes connectés sont ceux de cette équipe, donc tout le chiffre lui revient.",
	"admin.riders.counts":
		"Listés\u00a0: {listed}. Non listés, car pas encore d'accord\u00a0: {unlisted}. Bloqués\u00a0: {blocked}.",
	"admin.riders.none": "Aucun·e cycliste n'a encore donné son accord.",
	"admin.riders.status": "Connexion",
	"admin.riders.status.connected": "Connecté·e",
	"admin.riders.status.needs_reconnect": "Doit se reconnecter",
	"admin.riders.connected": "Connecté·e le",
	"admin.riders.checked": "Adhésion vérifiée le",
	"admin.riders.import": "Import",
	"admin.riders.import.pending": "En cours",
	"admin.riders.import.running": "En cours",
	"admin.riders.import.done": "Terminé",
	"admin.riders.remove": "Retirer",
	"admin.remove.title": "Retirer {name}\u00a0?",
	"admin.remove.explain":
		"Impossible d'annuler. Toutes ses données sont supprimées et son accès Strava révoqué. La personne ne peut plus se connecter à cette équipe, même en restant au club\u00a0: son identifiant Strava reste sur la liste de blocage.",
	"admin.remove.confirm": "Retirer et bloquer",
	"admin.remove.cancel": "Annuler",
	"admin.remove.done.removed": "Le ou la cycliste a été retiré·e et bloqué·e.",
	"admin.remove.done.removed-revoke-failed":
		"Le ou la cycliste a été retiré·e et bloqué·e, mais Strava n'a pas pu être joint pour révoquer l'accès. Son jeton est quand même supprimé ici.",
	"admin.remove.error.self":
		"Tu ne peux pas te retirer toi-même. Pour partir, utilise {leave}.",
	"admin.remove.error.unknown":
		"Ce n'est pas un·e cycliste de cette liste. Rien n'a changé.",
	"admin.remove.leaveLink": "Supprimer mes données",
	"notification.usage.warning": "{allowance}\u00a0: {percent} %",
	"notification.usage.critical": "Critique\u00a0: {allowance} à {percent} %",
	"notice.blocked.title": "Tu ne peux pas participer à cette équipe",
	"notice.blocked.body":
		"Un administrateur t'a retiré·e de cette équipe. Nous gardons seulement ton identifiant Strava, pour que tu ne puisses pas te reconnecter, et avons révoqué l'accès que tu viens d'accorder.",
	"notice.oneTeam.title": "Tu fais aussi partie du club d'une autre équipe",
	"notice.oneTeam.body":
		"Sur RynkePoints, tu ne peux participer qu'à une équipe à la fois. Strava donne à l'application une seule connexion par personne : si tu te connectes à une deuxième équipe, la connexion à la première prend fin. Tu es maintenant connecté·e ici.",
	"notice.carryOn": "Continuer",
	"organiser.graphs.heading": "Progression",
	"organiser.graphs.title.outdoor": "Kilomètres en extérieur (km)",
	"organiser.graphs.title.virtual": "Kilomètres virtuels (km)",
	"organiser.graphs.title.elevation": "Dénivelé (m)",
	"organiser.graphs.title.sessions": "Séances",
	"organiser.graphs.tabs.label": "Graphique",
	"organiser.graphs.tab.outdoor": "Extérieur",
	"organiser.graphs.tab.virtual": "Virtuel",
	"organiser.graphs.tab.elevation": "Dénivelé",
	"organiser.graphs.tab.sessions": "Séances",
	"organiser.graphs.picker.label": "Affiché dans les graphiques",
	"organiser.graphs.picker.find": "Chercher un·e cycliste",
	"organiser.graphs.picker.clear": "Tout effacer",
	"organiser.graphs.picker.done": "Terminé",
	"organiser.graphs.picker.notAgreed":
		"Pas encore de ligne, pas d'accord\u00a0: {names}",
	"organiser.graphs.picker.noMatch":
		"Aucun·e cycliste ne correspond à «\u00a0{query}\u00a0».",
	"organiser.graphs.summary.riders": "Cyclistes affichés\u00a0: {n}",
	"organiser.graphs.summary.average": "moyenne de l'équipe",
	"organiser.graphs.summary.total": "total de l'équipe",
	"organiser.graphs.summary.none": "Rien de sélectionné",
	"organiser.graphs.average": "Moyenne de l'équipe",
	"organiser.graphs.total": "Total de l'équipe",
	"organiser.graphs.from": "Du",
	"organiser.graphs.to": "Au",
	"organiser.graphs.range.label": "Périodes rapides",
	"organiser.graphs.range.season": "Saison",
	"organiser.graphs.range.3m": "3 mois",
	"organiser.graphs.range.4w": "4 semaines",
	"organiser.graphs.range.custom": "Personnalisée",
	"organiser.graphs.mode.label": "Ce que montre chaque point",
	"organiser.graphs.mode.running": "Cumul",
	"organiser.graphs.mode.daily": "Par jour",
	"organiser.graphs.hint.mouse":
		"Fais glisser sur un graphique pour choisir des dates. «\u00a0Saison\u00a0» montre à nouveau tout.",
	"organiser.graphs.hint.touch":
		"Pince pour zoomer, glisse sur le côté pour déplacer, touche pour un jour. «\u00a0Saison\u00a0» montre à nouveau tout.",
	"organiser.graphs.note.one":
		"1 cycliste n'a pas de ligne\u00a0: pas encore d'accord pour les chiffres journaliers.",
	"organiser.graphs.note.other":
		"Cyclistes sans ligne, pas encore d'accord pour les chiffres journaliers\u00a0: {n}.",
	"organiser.graphs.note.nobody":
		"On demande encore leur accord aux cyclistes. Pas encore de lignes.",
	"organiser.graphs.value.km": "{n} km",
	"organiser.graphs.value.m": "{n} m",
	"organiser.graphs.value.sessions": "Séances\u00a0: {n}",
	"organiser.graphs.readout.range": "{from} – {to}, total",
	"organiser.graphs.aria": "{title} du {from} au {to}\u00a0: {lines}",
	"organiser.graphs.view.label": "Ce qui est affiché",
	"organiser.graphs.view.graphs": "Graphiques",
	"organiser.graphs.view.riders": "Cyclistes ({n})",
	"organiser.graphs.reports": {
		one: "{n} signalement ouvert",
		many: "{n} signalements ouverts",
		other: "{n} signalements ouverts",
	},
	"organiser.graphs.reports.showAll": "Afficher les {n}",
	"organiser.graphs.rows.noMatch":
		"Aucun·e cycliste ne correspond à «\u00a0{query}\u00a0».",
	"organiser.graphs.rows.report": "Signalement",
	"consent.admins":
		"Les administrateurs gèrent l'application pour l'équipe. Ils voient ton prénom, si tu es connecté·e et depuis quand, quand ton adhésion au club a été vérifiée pour la dernière fois et si ton import est encore en cours, mais aucune sortie ni aucun Rynke. Ils peuvent te retirer de l'équipe\u00a0: tes données sont alors supprimées, et seul ton identifiant Strava reste sur une liste de blocage, pour que tu ne puisses pas te reconnecter à cette équipe.",
	"privacy.visibility.admins":
		"Les administrateurs, qui gèrent l'application pour l'équipe, voient ton prénom, si tu es connecté·e et depuis quand, quand ton adhésion au club a été vérifiée pour la dernière fois et si ton import est encore en cours, mais aucune activité ni aucun Rynke.",
	"privacy.legal.blocklist":
		"La liste de blocage repose sur l'intérêt légitime de l'équipe à tenir à l'écart une personne qu'elle a retirée (art. 6, paragraphe 1, point f du RGPD), et non sur le consentement. Pour en demander l'effacement, écris au responsable nommé plus haut.",
	"privacy.retention.blocklist":
		"La seule exception\u00a0: si un administrateur te retire, ton identifiant Strava reste sur la liste de blocage de l'équipe tant que l'équipe fait fonctionner l'application, sans nom, date ni motif, pour que tu ne puisses pas te reconnecter. Tout le reste est supprimé.",

	// Common badge names, for teams without their own (feature 026 FR-052).
	"badge.name.distance-100": "Les cent premiers",
	"badge.name.distance-500": "Un demi-millier",
	"badge.name.distance-1000": "Quatre chiffres",
	"badge.name.distance-2500": "Une nouvelle chaîne s'impose",
	"badge.name.distance-5000": "Le long chemin",
	"badge.name.elevation-1000": "Premier kilomètre vertical",
	"badge.name.elevation-5000": "Plus haut que le mont Blanc",
	"badge.name.elevation-10000": "Everest coché",
	"badge.name.elevation-25000": "Stratosphère",
	"badge.name.team-events-1": "Première rencontre d'équipe",
	"badge.name.team-events-5": "Visage connu",
	"badge.name.team-events-10": "Habitué·e",
	"badge.name.team-events-20": "Fait partie des meubles",
	"badge.name.technique-1": "Premier cours technique",
	"badge.name.technique-2": "Techniquement au point",
	"badge.name.training-rynke-1": "Le premier Rynke",
	"badge.name.training-rynke-25": "Échauffé·e",
	"badge.name.training-rynke-50": "Un demi-cent",
	"badge.name.training-rynke-100": "Trois chiffres",
	"badge.name.training-rynke-150": "Endurci·e par la selle",
	"badge.name.training-rynke-200": "Deux cents",
	"badge.name.training-rynke-250": "En pleine forme",
	"badge.name.training-rynke-300": "Toujours là",
	"badge.name.training-rynke-400": "Difficile à arrêter",
	"badge.name.training-rynke-500": "Prêt·e pour le tour",
	"badge.name.run-length-5": "Cinq d'une traite",
	"badge.name.run-length-10": "Dix d'une traite",
	"badge.name.run-length-15": "Quinze d'une traite",
	"badge.name.run-length-half": "Semi-marathon",
	"badge.name.run-length-pi-run": "Course Pi",
	"badge.name.run-length-marathon": "Marathon",
	"badge.name.running-10": "Baskets retrouvées",
	"badge.name.running-25": "Une corde de plus à son arc",
	"badge.name.running-50": "À pied aussi",
	"badge.name.running-100": "Cent à pied",
	"badge.name.running-250": "Double vie",
	"badge.name.running-500": "De nouvelles semelles s'imposent",
	"badge.name.ride-length-50": "Avec le casse-croûte",
	"badge.name.ride-length-100": "Cent d'une traite",
	"badge.name.ride-length-150": "Une journée en selle",
	"badge.name.ride-length-200": "Du matin au soir",
	"badge.name.ride-length-250": "À travers la nuit",
	"badge.name.ride-length-300": "Tout donné",
	"badge.name.virtual-rides-50": "Héros du home trainer",
	"badge.name.virtual-rides-100": "Vent de face du ventilateur",
	"badge.name.virtual-rides-250": "Contre soi-même",
	"badge.name.virtual-rides-500": "Rêveur·se",
	"badge.name.virtual-rides-1000": "L'univers du salon",
	"badge.name.swim-length-500": "Bébé nageur",
	"badge.name.swim-length-1000": "Grand bain",
	"badge.name.swim-length-1900": "Demi longue distance",
	"badge.name.swim-length-3800": "Longue distance",
	"badge.name.swimming-5": "Bombe",
	"badge.name.swimming-10": "Canard en plastique",
	"badge.name.swimming-25": "Longueurs de bassin",
	"badge.name.swimming-50": "Mode phoque",
	"badge.name.swimming-100": "Baleine en vue",
	"badge.name.winter-november-1": "Feuilles mortes",
	"badge.name.winter-november-5": "Temps de chien",
	"badge.name.winter-november-10": "Cavalier du brouillard",
	"badge.name.winter-december-1": "Première neige",
	"badge.name.winter-december-5": "Pause chocolat chaud",
	"badge.name.winter-december-10": "Renne sur roues",
	"badge.name.winter-january-1": "Bonne année",
	"badge.name.winter-january-5": "Stalactite",
	"badge.name.winter-january-10": "Tempête de neige",
	"badge.name.winter-february-1": "Carnaval à vélo",
	"badge.name.winter-february-5": "Gelé",
	"badge.name.winter-february-10": "Hiver surmonté",
	"badge.name.surprise-new-year": "Santé pour la nouvelle année",
	"badge.name.surprise-christmas-eve": "Cadeaux sur roues",
	"badge.name.surprise-christmas": "Repas de Noël éliminé",
	"badge.name.surprise-night-owl": "Oiseau de nuit",
	"badge.name.surprise-early-bird": "Lève-tôt",
	"badge.name.surprise-rest-day": "Héros du canapé",
	"badge.name.surprise-festive-500": "Biscuits éliminés",
	"badge.name.surprise-stage-rider": "Course par étapes",
	"badge.name.surprise-triathlon": "Triple héros",
	"badge.name.surprise-pi-day": "Bien arrondi",
	"badge.name.surprise-solstice": "Ombre et lumière",
	"badge.name.surprise-easter": "Lapin de Pâques sur roues",
	"badge.name.surprise-everesting": "Chasseur de sommets",
	"badge.name.surprise-winter-sleep": "Fin de l'hibernation",
	"badge.name.team-training-rynke-500": "On roule ensemble",
	"badge.name.team-training-rynke-1000": "Mille ensemble",
	"badge.name.team-training-rynke-2500": "Équipe au complet",
	"badge.name.team-training-rynke-5000": "Équipe en forme",
	"badge.name.team-training-rynke-7500": "L'équipe tourne rond",
	"badge.name.team-training-rynke-10000": "Cinq chiffres",
	"badge.name.team-training-rynke-15000": "L'équipe garde le cap",
	"badge.name.team-training-rynke-20000": "Tous prêts",
	"badge.name.team-distance-1000": "Les mille premiers",
	"badge.name.team-distance-5000": "À travers l'Europe",
	"badge.name.team-distance-10000": "Jusqu'au Cap",
	"badge.name.team-distance-25000": "Un demi-tour du monde",
	"badge.name.team-distance-50000": "Un tour de la Terre",
	"badge.name.team-distance-100000": "Deux tours et demi de la Terre",
	"badge.name.team-elevation-10000": "L'Everest en équipe",
	"badge.name.team-elevation-50000": "Cinq fois l'Everest",
	"badge.name.team-elevation-100000": "Ligne de Kármán",
	"badge.name.team-elevation-250000": "En orbite",
	"badge.name.team-elevation-500000": "Au-dessus de l'ISS",
	"badge.name.team-running-100": "L'équipe en baskets",
	"badge.name.team-running-500": "Relais",
	"badge.name.team-running-1000": "Mille courus",
	"badge.name.team-running-2500": "Club de course",
	"badge.name.team-running-5000": "Cinq mille à pied",
	"badge.name.big-training-5": "Petit groupe",
	"badge.name.big-training-10": "Deux par deux",
	"badge.name.big-training-15": "Peloton complet",
	"badge.name.big-training-20": "Peloton",
	"badge.name.big-training-30": "Route pleine",
	"badge.name.attendances-25": "Bien fréquenté",
	"badge.name.attendances-50": "Salle comble",
	"badge.name.attendances-100": "Cent fois présent",
	"badge.name.attendances-200": "Bien rodé",
	"badge.name.attendances-400": "Tout le monde est là",
	"badge.name.tour-de-paris-1": "Jour de tour 1",
	"badge.name.tour-de-paris-2": "Jour de tour 2",
	"badge.name.tour-de-paris-3": "Jour de tour 3",
	"badge.name.tour-de-paris-4": "Jour de tour 4",
	"badge.name.tour-de-paris-5": "Jour de tour 5",
	"badge.name.tour-de-paris-6": "Jour de tour 6",
	"badge.name.tour-de-paris-7": "Jour de tour 7",
	"badge.name.tour-de-paris-8": "Jour de tour 8",
	"badge.name.team-surprise-day-off": "Journée canapé collective",
	"badge.name.team-surprise-all-out": "Tout le monde sur le pont",
	"badge.name.team-surprise-round-the-clock": "Jour et nuit",
	"badge.name.team-surprise-relay": "Relais sans fin",
	"badge.name.team-surprise-new-years-eve": "Cierge magique du réveillon",
	"badge.name.team-surprise-sunday-outing": "Caravane du dimanche",
	"badge.name.team-surprise-festive-team": "La bande des fêtes",
};
