/* Scout Atlas: curated anime milestones through overall episode 47 only.
 * All coordinates and map geometry are schematic, not measured geography.
 * Every episode number here (firstEpisode, positions[].episode, from, revealedAs.episode)
 * is an OVERALL anime episode number. Nothing from an episode after maxEpisode is bundled.
 */
(() => {
  "use strict";
  const official = n => `https://shingeki.tv/season1/story/episode_${String(n).padStart(2, "0")}.php`;
  const wiki = page => `https://attackontitan.fandom.com/wiki/${page}`;
  const sources = {
    s2: "https://shingeki.tv/season2/story/episode.php",
    s3: "https://shingeki.tv/season3/story/",
    s3summary: "https://en.wikipedia.org/wiki/Attack_on_Titan_season_3",
    e16: wiki("What_Needs_to_be_Done_Now%3A_Eve_of_the_Counterattack%2C_Part_3"),
    e25: "https://www.crunchyroll.com/watch/G7PU4503J/the-wall---raid-on-stohess-district-3",
    e25detail: wiki("Wall%3A_Assault_on_Stohess%2C_Part_3"),
    e28: "https://www.crunchyroll.com/watch/G31UX3X45/southwestward",
    e28detail: wiki("Southwestward_%28Episode%29"),
    e29: wiki("Soldier_%28Episode%29"),
    e31: wiki("Warrior_%28Episode%29"),
    e37: "https://www.crunchyroll.com/watch/GR098QNGR/scream",
    e37detail: wiki("Scream_%28Episode%29"),
    orvud: wiki("Orvud_District")
  };
  function chapter(number, title, shortTitle, description, sourceUrl, events) {
    return {
      id: `episode-${number}`, number, title, shortTitle, description, sourceUrl,
      events: events.map((event, index) => ({
        id: `episode-${number}-event-${index + 1}`,
        kind: "confirmed", people: [], sourceUrl, ...event
      }))
    };
  }
  window.ATLAS_DATA = {
    maxEpisode: 47,
    // Season boundaries in overall numbers. The current season has no `last` until it is complete.
    seasons: [
      { season: 1, first: 1, last: 25 },
      { season: 2, first: 26, last: 37 },
      { season: 3, first: 38 }
    ],
    episodes: [
      chapter(1, "To You, in 2000 Years", "Shiganshina", "Start at the southern district of Wall Maria, where Eren, Mikasa, and Armin live.", official(1), [
        { locationId: "shiganshina", people: ["eren", "mikasa", "armin"], title: "Life at the outer wall", summary: "Shiganshina is Eren, Mikasa, and Armin’s home. Eren wants to see the world beyond the walls.", connection: "This district gives the opening story its geographical starting point." },
        { locationId: "shiganshina", people: ["colossal"], title: "The gate is breached", summary: "The Colossal Titan breaks Shiganshina’s outer gate, allowing Titans into the district.", connection: "The attack turns the town’s protective boundary into an entry point.", sourceUrl: wiki("Shiganshina_District_%28Anime%29") }
      ]),
      chapter(5, "First Battle", "Trost under attack", "Five years later, the fighting is at Trost, a different district on the southern edge of Wall Rose.", official(5), [
        { locationId: "trost", people: ["colossal", "eren"], title: "A different gate", summary: "The Colossal Titan has breached Trost’s outer gate. Eren attacks, but the Titan disappears in steam.", connection: "Trost belongs to Wall Rose; it is not Shiganshina or Wall Maria." },
        { locationId: "trost", title: "The district becomes a battlefield", summary: "Soldiers prepare to face Titans entering Trost. The immediate task is to defend the district and protect its people.", connection: "A breach in the district’s outer gate threatens access toward the territory behind Wall Rose." }
      ]),
      chapter(8, "Hearing the Heartbeat", "Reach the supplies", "The battle remains inside Trost. Reaching the supply headquarters is essential to the trapped soldiers.", official(8), [
        { locationId: "trost", people: ["armin", "mikasa"], title: "A plan to reach headquarters", summary: "Armin proposes drawing the Titan that helped Mikasa toward the supply headquarters so it can attack the Titans there.", connection: "The immediate objective is a building within Trost, not a new town or another wall." },
        { locationId: "trost", people: ["jean", "mikasa", "connie"], title: "The soldiers converge", summary: "Jean’s group reaches the headquarters as Mikasa and Connie also move toward it.", connection: "Separate groups in the district are working toward the same supply point." }
      ]),
      chapter(13, "Primal Desires", "Seal Trost", "Eren’s Titan form becomes central to the operation to close Trost’s breached gate.", official(13), [
        { locationId: "trost", people: ["armin", "eren"], title: "Protect the carrier", summary: "After Armin reaches him, Eren carries the boulder. Soldiers draw nearby Titans away so he can reach the gate.", connection: "This turns the struggle for survival into a coordinated operation at the original breach." },
        { locationId: "trost", people: ["eren"], title: "The breach is sealed", summary: "Eren places the boulder in the opening and blocks the damaged gate.", connection: "This closes the breach at Trost; it does not recover Shiganshina or the lost territory of Wall Maria." }
      ]),
      chapter(16, "What Needs to Be Done Now", "Leave from Karanes", "The Survey Corps prepares an expedition and departs through Karanes, on the east side of Wall Rose.", sources.e16, [
        { locationId: "karanes", people: ["eren"], title: "The expedition departs", summary: "The Survey Corps leaves Karanes for its 57th expedition. Eren and recruits who chose the Scouts take part.", connection: "Karanes is an eastern exit from Wall Rose; the earlier battle was at southern Trost." }
      ]),
      chapter(18, "Forest of Giant Trees", "Into the forest", "During the expedition outside Wall Rose, the formation encounters the Female Titan and enters a forest.", official(18), [
        { locationId: "giant-forest", people: ["eren", "levi"], title: "The center enters the trees", summary: "The central column, including Eren and Levi’s squad, moves into a forest of giant trees while other soldiers remain outside.", connection: "The expedition is in the territory between Wall Rose and Wall Maria, not beyond every wall." },
        { locationId: "giant-forest", people: ["female-titan", "eren"], title: "Terrain changes the encounter", summary: "The tall trunks provide anchor points for mobility gear. The Female Titan pursues Eren’s group into the forest.", connection: "Tree cover creates a very different situation from riding across open ground.", sourceUrl: wiki("Forest_of_Giant_Trees_%28Anime%29") }
      ]),
      chapter(22, "The Defeated", "Rescue and retreat", "Levi and Mikasa focus on retrieving Eren from the Female Titan during the failed expedition.", official(22), [
        { locationId: "giant-forest", people: ["levi", "mikasa", "female-titan"], title: "Recover Eren", summary: "Levi and Mikasa pursue the Female Titan. Levi makes recovering Eren the priority and succeeds in freeing him.", connection: "The objective changes from confronting the enemy to bringing Eren back alive." },
        { locationId: "karanes", title: "Return through Karanes", summary: "The expedition returns through Karanes after heavy losses.", connection: "This closes the journey that began at the same eastern gate. The precise return route is not mapped.", sourceUrl: wiki("Calaneth_District_%28Anime%29") }
      ]),
      chapter(25, "Wall", "Stohess", "The conflict is now in Stohess, a district on the eastern edge of the innermost wall, Sina.", sources.e25, [
        { locationId: "stohess", people: ["eren", "annie"], title: "The battle in Stohess", summary: "Eren fights Annie in her Female Titan form in Stohess, causing major destruction in the district.", connection: "This moves the confrontation inward from the expedition territory to a populated district at Wall Sina." },
        { locationId: "stohess", people: ["annie"], title: "Annie is enclosed in crystal", summary: "Annie seals herself inside a crystal. The Scouts secure her, but cannot obtain answers from her.", connection: "Capturing a person and understanding their motives are separate outcomes.", sourceUrl: sources.e25detail }
      ]),
      chapter(28, "Southwestward", "Search Wall Rose", "Teams search for a possible breach after Titans appear inside Wall Rose. Reports and observations do not yet explain how they arrived.", sources.e28, [
        { locationId: "ragako", people: ["connie"], title: "Questions at Ragako", summary: "Connie’s home village is wrecked. The absence of bodies and the remaining horses make a simple explanation difficult.", connection: "These observations raise questions; they do not establish what happened to the villagers.", sourceUrl: sources.e28detail },
        { locationId: "utgard", title: "Shelter at Utgard", summary: "Searching soldiers take shelter at Utgard Castle. Titans approach and attack despite the darkness.", connection: "The castle is inside Wall Rose, near its perimeter. Its exact position is approximate here.", sourceUrl: sources.e28detail }
      ]),
      chapter(29, "Soldier", "Utgard at night", "The soldiers at Utgard face a night attack with limited means to defend themselves.", sources.e29, [
        { locationId: "utgard", title: "The defenders are overwhelmed", summary: "Experienced soldiers fight the Titans while the recruits shelter in the castle. Their defense collapses as the attackers close in.", connection: "This continues the attack at the same castle introduced in the previous milestone." },
        { locationId: "utgard", people: ["ymir", "connie"], title: "Ymir transforms", summary: "Ymir takes Connie’s knife, jumps from the tower, and transforms into a Titan.", connection: "A new fact about Ymir is revealed here. It does not explain every other mystery surrounding the attack." }
      ]),
      chapter(31, "Warrior", "On Wall Rose", "The survivors regroup on Wall Rose. The absence of a discovered breach leaves the earlier crisis unresolved.", sources.e31, [
        { locationId: "wall-rose-south", people: ["hannes"], title: "No breach found", summary: "Hannes reports that the search has found no hole in Wall Rose. The Scouts prepare to regroup at Trost.", connection: "The planned destination is Trost, but this conversation happens on the wall; those are different locations." },
        { locationId: "wall-rose-south", people: ["reiner", "bertholdt", "mikasa", "eren"], title: "Reiner and Bertholdt reveal themselves", summary: "Reiner identifies himself as the Armored Titan and Bertholdt as the Colossal Titan. After Mikasa attacks, both transform, and Eren transforms to confront them.", connection: "The identities are established at this point. Their full motives and wider circumstances remain unanswered." }
      ]),
      chapter(37, "Scream", "The return", "Eren’s rescue reaches its conclusion. The Scouts survive with new observations and important unanswered questions.", sources.e37, [
        { locationId: "rescue-field", people: ["eren", "smiling-titan", "hannes"], title: "An unexplained response", summary: "After Eren strikes the smiling Titan’s hand, nearby Titans attack it. They later turn toward Reiner and Bertholdt, giving the Scouts an opening to escape.", connection: "The response is observed; the mechanism and limits of Eren’s power are not explained.", sourceUrl: sources.e37detail },
        { locationId: "wall-rose-south", people: ["eren", "ymir", "reiner", "bertholdt"], title: "Retreat toward Wall Rose", summary: "The surviving Scouts ride back toward Wall Rose with Eren. Ymir chooses to leave with Reiner and Bertholdt.", connection: "This marks the direction of retreat, not an exact gate or verified road.", sourceUrl: sources.e37detail },
        { locationId: "ragako", people: ["hange"], title: "A theory about Ragako", summary: "Hange reports evidence suggesting Ragako’s residents became Titans, while acknowledging the lack of proof. The pin marks the village being discussed, not the report’s meeting room.", kind: "belief", connection: "The earlier village observations now support a theory. Its cause is still unknown.", sourceUrl: sources.e37detail }
      ]),
      chapter(38, "Smoke Signal", "A new Levi squad", "Eren and the other 104th recruits join a new Levi squad, while the Scouts learn that their enemy now includes people inside the walls.", sources.s3, [
        { locationId: null, people: ["hange", "eren"], title: "Can Eren’s Titan harden?", summary: "Hange runs experiments to find out whether Eren can harden his Titan body at will, the plan for sealing the hole in Wall Maria.", connection: "The goal is still to close Wall Maria. The squad works from a hidden location that this map does not place." },
        { locationId: "trost", people: ["nick", "hange"], title: "Pastor Nick is murdered", summary: "Word comes that Pastor Nick has been killed. Hange concludes that the Central Military Police did it, and a letter from Erwin reaches Levi.", connection: "The threat to the Scouts now comes from people inside the walls, not only from Titans.", sourceUrl: sources.s3summary }
      ]),
      chapter(39, "Pain", "Taken", "The wagon carrying Eren and Historia is attacked, and Levi meets a man from his past.", sources.s3, [
        { locationId: null, people: ["eren", "historia"], title: "Eren and Historia are taken", summary: "The wagon carrying Eren and Historia is attacked and both are carried off.", connection: "Where they are taken is not shown to the Scouts, so the atlas does not pin it." },
        { locationId: null, people: ["levi", "kenny", "jean"], title: "Levi and Kenny", summary: "A man Levi calls Kenny blocks his pursuit. They fight to kill: people against people, both using vertical maneuvering equipment. Jean and the others are drawn into the fighting.", connection: "Levi and Kenny share a past. This episode does not explain it." }
      ]),
      chapter(40, "Old Story", "The Reiss secret", "Historia wakes beside a man who says he is her father, Rod Reiss. Hange and Erwin each move toward the same secret.", sources.s3, [
        { locationId: null, people: ["historia", "rod"], title: "Historia meets her father", summary: "Rod Reiss, who says he is Historia’s father, holds her and tells her a serious secret about the Reiss family.", connection: "The place where she wakes is not named, so it is not pinned." },
        { locationId: null, people: ["hange"], title: "Hange gets an answer", summary: "Hange makes a captured Military Police officer talk and learns the Reiss family’s secret too." },
        { locationId: null, people: ["erwin", "pixis"], title: "Erwin meets Pixis", summary: "Erwin tells Pixis that he is determined to change the course of humanity’s history." }
      ]),
      chapter(41, "Trust", "Framed", "Accused of killing a civilian, the Survey Corps hides in a forest. Two Military Police patrollers stumble onto them.", sources.s3, [
        { locationId: null, title: "Hunted as murderers", summary: "A Military Police scheme pins a civilian’s murder on the Survey Corps, and its soldiers go into hiding.", connection: "The forest where they hide is not named, so it is not pinned." },
        { locationId: null, people: ["marlo", "hitch", "armin", "levi", "jean"], title: "Marlo and Hitch", summary: "Military Police officers Marlo and Hitch spot Armin fetching water and are captured by Levi’s group. Marlo, doubting his own branch’s methods, offers to help. Levi leaves the two in Jean’s charge." }
      ]),
      chapter(42, "Reply", "Erwin’s trial", "Erwin faces a final trial in the king’s hall while his execution is prepared.", sources.s3, [
        { locationId: "capital", people: ["erwin"], title: "The last trial", summary: "In the king’s hall, Erwin argues that losing the Survey Corps would cost humanity its spear. No one listens, and he is led away toward execution.", connection: "The decision about the Scouts’ future is made at the centre of the walls, not at the front line." },
        { locationId: "capital", title: "A breach is reported", summary: "Word arrives that the Colossal and Armored Titans have broken through Wall Rose. The report is false: the rulers’ response to it exposes them, and the government loses its hold on power.", connection: "The report tested how those in power would react. No Titan attack took place.", sourceUrl: sources.s3summary }
      ]),
      chapter(43, "Sin", "Under the chapel", "Eren wakes in chains beneath a chapel, with Historia standing beside her father.", sources.s3, [
        { locationId: "reiss-chapel", people: ["eren", "historia", "rod"], title: "In chains", summary: "Eren wakes chained up beneath the chapel. Historia is standing with Rod.", connection: "He is held underground, out of sight of the rest of the Scouts." },
        { locationId: "reiss-chapel", people: ["eren", "rod", "grisha"], kind: "belief", title: "A memory returns", summary: "When Rod and Historia touch Eren’s back, a buried memory surfaces. Rod says that on a night five years ago, Eren’s father, Grisha Yeager, took his family from him.", connection: "The memory is Eren’s; the account of what it means is Rod’s." }
      ]),
      chapter(44, "Wish", "An inherited power", "Rod explains what the Reiss family has passed down, and Historia accepts it as her duty.", sources.s3, [
        { locationId: "reiss-chapel", people: ["rod", "eren"], kind: "belief", title: "What the Reiss family kept", summary: "Rod says a Titan power handed down through his family for generations is now inside Eren.", connection: "This is Rod’s explanation. How the power works is not shown." },
        { locationId: "reiss-chapel", people: ["historia", "eren"], title: "Historia’s duty", summary: "Historia declares it her mission to take that power, inherit the world’s history and rid the world of Titans. Eren, overwhelmed by guilt, resolves to leave humanity’s fate to her." }
      ]),
      chapter(45, "Outside the Walls of Orvud District", "Rod transforms", "Historia turns against her father, and Rod becomes a Titan larger than the Colossal.", sources.s3, [
        { locationId: "reiss-chapel", people: ["historia", "rod", "eren"], title: "Historia refuses", summary: "Historia defies Rod and tries to escape with Eren. Rod takes in the drug spilled on the floor and turns into a Titan.", connection: "The plan Rod built around Historia fails because she refuses it." },
        { locationId: "reiss-chapel", people: ["eren"], title: "Bigger than the Colossal", summary: "The Scouts rescue Historia and the still-chained Eren while Rod’s Titan keeps forming, larger even than the Colossal Titan. Eren chooses to trust himself again, and his friends come through the collapse alive.", connection: "The cavern beneath the chapel does not survive the transformation." }
      ]),
      chapter(46, "Ruler of the Walls", "Stand at Orvud", "Rod’s Titan climbs out and heads slowly for Orvud District, burning the trees around it.", sources.s3, [
        { locationId: "orvud", people: ["erwin"], title: "No evacuation", summary: "Erwin chooses not to evacuate Orvud. Its residents stay as bait so the Titan is stopped before damage reaches the heart of Wall Sina, and the goal is to lose no one.", connection: "The battle is fought outside a district wall, with civilians still behind it." },
        { locationId: "orvud", people: ["rod"], title: "A burning Titan", summary: "The Titan gives off intense heat and scorches the trees as it moves. The Survey Corps prepares to take it on.", connection: "Its path runs from the chapel to Orvud; the route drawn by this map is not exact." }
      ]),
      chapter(47, "Friends", "The true ruler", "Rod’s Titan falls at Orvud, and Kenny, badly hurt, meets Levi one last time.", sources.s3, [
        { locationId: "orvud", people: ["historia", "rod"], title: "Historia’s final blow", summary: "Rod’s Titan is brought down. Historia deals the final blow herself and, in front of residents and soldiers, declares that she is the true ruler.", connection: "The fight ends at Orvud’s wall, not inside the district." },
        { locationId: "reiss-chapel", people: ["kenny", "levi"], title: "Kenny and Levi", summary: "Kenny lies badly wounded after escaping the collapsed chapel and remembers his life. Levi finds him, and Kenny takes out a syringe holding the Titan drug. Before he dies, he tells Levi he was his mother’s brother.", connection: "This answers the question of how Levi and Kenny were connected, raised in episode 39.", sourceUrl: sources.s3summary }
      ])
    ],
    // kind: district | village | castle | forest | wall | field | chapel | capital
    // label.side: right (default) | left | below. Aliases are searched but never shown on the map.
    locations: [
      { id: "shiganshina", name: "Shiganshina", subtitle: "Southern district · Wall Maria", x: 600, y: 780, kind: "district", firstEpisode: 1,
        summary: "The home district of Eren, Mikasa, and Armin, built at the southern edge of the outermost wall.", why: "Use this as the southern reference point when comparing the three walls and their districts.", geography: "Southern Wall Maria is established geography. The district outline and distances are schematic.", tags: ["Wall Maria", "Southern district"], sourceUrl: wiki("Shiganshina_District_%28Anime%29") },
      { id: "trost", name: "Trost", subtitle: "Southern district · Wall Rose", x: 600, y: 651, kind: "district", firstEpisode: 5,
        summary: "A district projecting from the southern edge of Wall Rose, the middle wall.", why: "Trost and Shiganshina are different towns on different walls. Confusing them makes the early battles harder to follow.", geography: "Placed south of Wall Rose. District size and spacing are illustrative.", tags: ["Wall Rose", "Southern district"], sourceUrl: wiki("Trost_District") },
      { id: "karanes", name: "Karanes", subtitle: "Eastern district · Wall Rose", x: 898, y: 405, kind: "district", firstEpisode: 16, aliases: ["Karanese", "Calaneth"],
        summary: "An eastern district of Wall Rose, also translated as Karanese or Calaneth.", why: "It provides the expedition’s eastern departure point, separate from Trost’s southern gate.", geography: "Eastern Wall Rose is established. No exact road or travel distance is implied.", tags: ["Wall Rose", "Eastern district"], sourceUrl: wiki("Calaneth_District_%28Anime%29") },
      { id: "giant-forest", name: "Forest of giant trees", subtitle: "57th expedition · Approximate area", x: 920, y: 520, kind: "forest", firstEpisode: 18,
        summary: "The large-tree forest encountered by the 57th expedition between Walls Rose and Maria.", why: "Tall trees create anchor points for mobility gear and change how soldiers can move and fight.", geography: "Between Walls Maria and Rose. This marker represents the expedition forest only; its exact coordinates are not established.", tags: ["Between the walls", "Approximate area"], sourceUrl: wiki("Forest_of_Giant_Trees_%28Anime%29") },
      { id: "stohess", name: "Stohess", subtitle: "Eastern district · Wall Sina", x: 762, y: 405, kind: "district", firstEpisode: 23, aliases: ["Wall Sheena"], label: { side: "left" },
        summary: "A district at the eastern edge of Wall Sina, the innermost of the three walls.", why: "Its location shows how far inward this part of the story is compared with the expedition beyond Wall Rose.", geography: "Eastern Wall Sina, also translated as Wall Sheena. All map proportions are schematic.", tags: ["Wall Sina", "Eastern district"], sourceUrl: wiki("Stohess_District") },
      { id: "ragako", name: "Ragako", subtitle: "Connie’s village · Inside Wall Rose", x: 650, y: 590, kind: "village", firstEpisode: 28,
        summary: "Connie’s home village, in the southern territory enclosed by Wall Rose.", why: "Its position inside the wall is central to the question of how Titans appeared among the settlements.", geography: "Southern territory inside Wall Rose. The specific village coordinates are approximate.", tags: ["Inside Wall Rose", "Village"], sourceUrl: wiki("Ragako") },
      { id: "utgard", name: "Utgard Castle", subtitle: "A ruined castle · Inside Wall Rose", x: 435, y: 560, kind: "castle", firstEpisode: 28, label: { side: "left" },
        summary: "An abandoned castle near the perimeter inside Wall Rose, used as shelter by searching soldiers.", why: "It is a stop during the search within Wall Rose, not an outpost beyond Wall Maria.", geography: "Inside Wall Rose near its perimeter. The southwest placement and distances are schematic.", tags: ["Inside Wall Rose", "Castle"], sourceUrl: wiki("Utgard_Castle_%28Anime%29") },
      { id: "wall-rose-south", name: "Wall Rose · southern sector", mapLabel: "Southern Wall Rose", subtitle: "Wall-top meeting · Approximate sector", x: 450, y: 618, kind: "wall", firstEpisode: 31, label: { side: "left" },
        summary: "The section of Wall Rose where soldiers regroup following Utgard. This is an area marker, not a named district.", why: "Conversations and fighting on the wall should not be mistaken for events inside Trost itself.", geography: "Placed on the southwestern arc of Wall Rose for orientation. The precise section is not established by this map.", tags: ["Wall Rose", "Approximate sector"], sourceUrl: sources.e31 },
      { id: "rescue-field", name: "Rescue operation area", subtitle: "Outside Wall Rose · Approximate area", x: 400, y: 683, kind: "field", firstEpisode: 37, label: { side: "left" },
        summary: "The open terrain outside Wall Rose where the rescue and retreat take place. This is a descriptive label, not a canonical place name.", why: "This pin keeps the fighting outside the wall distinct from settlements within it.", geography: "Shown in the belt between Walls Rose and Maria. Position and terrain are deliberately approximate.", tags: ["Beyond Wall Rose", "Approximate area"], sourceUrl: sources.e37detail },
      { id: "capital", name: "Royal capital", subtitle: "Seat of the king · Inside Wall Sina", x: 600, y: 405, kind: "capital", firstEpisode: 42, label: { side: "below" },
        summary: "The seat of the king and the government, at the heart of Wall Sina.", why: "Erwin’s final trial is held in the king’s hall here: the fate of the Scouts is decided at the centre of the walls, far from any Titan.", geography: "Shown at the centre of Wall Sina for orientation. The capital’s size and exact position are not established by this map.", tags: ["Wall Sina", "Capital"], sourceUrl: sources.s3 },
      { id: "reiss-chapel", name: "Reiss family chapel", subtitle: "A cavern beneath · Approximate area", x: 470, y: 250, kind: "chapel", firstEpisode: 43, label: { side: "left" },
        summary: "A chapel of the Reiss family, with a cavern beneath it where Eren is held in chains.", why: "The Reiss family’s secrets are kept here, underground and out of sight.", geography: "Placed between Wall Sina and Wall Rose for orientation. Its real position and distances are not established here.", tags: ["Between Sina and Rose", "Approximate area"], sourceUrl: sources.s3 },
      { id: "orvud", name: "Orvud District", subtitle: "Northern district · Wall Sina", x: 600, y: 274, kind: "district", firstEpisode: 45, aliases: ["Orvud", "Wall Sheena"],
        summary: "A district projecting from the northern side of Wall Sina, the innermost wall.", why: "It moves the story to the north of the walls, far from the southern districts where it began.", geography: "Northern Wall Sina is established. The district outline and distances are schematic.", tags: ["Wall Sina", "Northern district"], sourceUrl: sources.orvud }
    ],
    // type: person | titan | group. Every versioned list (name, role, faction) uses the entry with the
    // latest `from` at or before the viewing episode. `notes` are dated facts shown once watched.
    // revealedAs: from that episode on, the entry is known to be the named person.
    // firstEpisode is this edition's visibility threshold, not a claim about a first appearance.
    characters: [
      { id: "eren", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Eren Yeager" }],
        faction: [{ from: 1, key: "civilian" }, { from: 4, key: "cadet" }, { from: 16, key: "survey" }],
        role: [{ from: 1, text: "Shiganshina resident" }, { from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }, { from: 38, text: "Survey Corps, Levi squad" }],
        notes: [
          { episode: 1, text: "Grew up in Shiganshina and wants to see the world beyond the walls." },
          { episode: 13, text: "Can turn into a Titan; in that form he seals Trost’s gate with a boulder." },
          { episode: 38, text: "Hange tests whether his Titan body can harden, to seal Wall Maria." },
          { episode: 43, text: "A buried memory of his father and the Reiss family surfaces." },
          { episode: 44, text: "Rod Reiss says the power the Reiss family handed down is inside him." },
          { episode: 45, text: "Chooses to trust himself again and gets his friends through the chapel’s collapse." }
        ],
        positions: [
          { episode: 1, locationId: "shiganshina", note: "Observed in his home district during the attack. This is a recorded observation, not continuous tracking.", sourceUrl: official(1) },
          { episode: 5, locationId: "trost", note: "Fighting in Trost during the breach.", sourceUrl: official(5) },
          { episode: 13, locationId: "trost", note: "Closes Trost’s breached gate with the boulder.", sourceUrl: official(13) },
          { episode: 16, locationId: "karanes", note: "Departs with the 57th expedition.", sourceUrl: sources.e16 },
          { episode: 18, locationId: "giant-forest", note: "In the expedition’s central column with Levi’s squad.", sourceUrl: official(18) },
          { episode: 22, locationId: "karanes", note: "Returns with the expedition after being rescued. Karanes is the return location, not the rescue site.", sourceUrl: wiki("Calaneth_District_%28Anime%29") },
          { episode: 25, locationId: "stohess", note: "Fights Annie in Stohess. This is the last mapped observation from the episode.", sourceUrl: sources.e25 },
          { episode: 31, locationId: "wall-rose-south", note: "Confronts Reiner at Wall Rose. The marker identifies an approximate sector.", sourceUrl: sources.e31 },
          { episode: 37, locationId: "wall-rose-south", note: "Retreating toward Wall Rose with the Scouts. Area approximate; exact final location unmarked.", sourceUrl: sources.e37detail },
          { episode: 38, locationId: null, note: "With the new Levi squad at a hidden location this map does not place.", sourceUrl: sources.s3 },
          { episode: 39, locationId: null, note: "Carried off with Historia after the wagon is attacked.", sourceUrl: sources.s3 },
          { episode: 43, locationId: "reiss-chapel", note: "Wakes chained beneath the chapel.", sourceUrl: sources.s3 },
          { episode: 46, locationId: "orvud", note: "Takes part in the stand against Rod’s Titan at Orvud.", sourceUrl: sources.s3summary }
        ], sourceUrl: official(1) },
      { id: "mikasa", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Mikasa Ackerman" }],
        faction: [{ from: 1, key: "civilian" }, { from: 4, key: "cadet" }, { from: 16, key: "survey" }],
        role: [{ from: 1, text: "Lives with Eren’s family" }, { from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }],
        notes: [
          { episode: 1, text: "Lives with Eren’s family in Shiganshina and watches out for him." },
          { episode: 22, text: "Pursues the Female Titan with Levi to get Eren back." },
          { episode: 31, text: "Attacks Reiner and Bertholdt after they reveal themselves." }
        ], sourceUrl: official(1) },
      { id: "armin", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Armin Arlert" }],
        faction: [{ from: 1, key: "civilian" }, { from: 4, key: "cadet" }, { from: 16, key: "survey" }],
        role: [{ from: 1, text: "Eren’s childhood friend" }, { from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }],
        notes: [
          { episode: 1, text: "Eren’s childhood friend in Shiganshina, more thinker than fighter." },
          { episode: 8, text: "Proposes the plan that gets the soldiers to the supply headquarters in Trost." },
          { episode: 13, text: "Reaches Eren’s Titan so the boulder can be carried to the gate." }
        ], sourceUrl: official(3) },
      { id: "levi", type: "person", firstEpisode: 14, name: [{ from: 14, text: "Levi" }],
        faction: [{ from: 14, key: "survey" }],
        role: [{ from: 14, text: "Survey Corps, leads his own squad" }],
        notes: [
          { episode: 14, text: "Known as humanity’s strongest soldier." },
          { episode: 22, text: "Frees Eren from the Female Titan." },
          { episode: 39, text: "Recognises Kenny, a man from his past, and fights him." },
          { episode: 47, text: "Kenny tells him before dying that he was his mother’s brother." }
        ],
        positions: [
          { episode: 18, locationId: "giant-forest", note: "Leads his squad in the expedition’s central column.", sourceUrl: official(18) },
          { episode: 22, locationId: "giant-forest", note: "Recovers Eren from the Female Titan.", sourceUrl: official(22) },
          { episode: 38, locationId: null, note: "Leads the new squad at a hidden location this map does not place.", sourceUrl: sources.s3 },
          { episode: 39, locationId: null, note: "Fights Kenny after the wagon ambush.", sourceUrl: sources.s3 },
          { episode: 45, locationId: "reiss-chapel", note: "Storms the chapel with the Scouts to rescue Eren and Historia.", sourceUrl: sources.s3 },
          { episode: 47, locationId: "reiss-chapel", note: "Finds Kenny near the collapsed chapel.", sourceUrl: sources.s3 }
        ], sourceUrl: official(15) },
      { id: "erwin", type: "person", firstEpisode: 14, name: [{ from: 14, text: "Erwin Smith" }],
        faction: [{ from: 14, key: "survey" }], role: [{ from: 14, text: "Commander of the Survey Corps" }],
        notes: [
          { episode: 16, text: "Leads the 57th expedition out through Karanes." },
          { episode: 40, text: "Tells Pixis he means to change the course of humanity’s history." },
          { episode: 42, text: "Stands a final trial in the king’s hall; the government falls instead." },
          { episode: 46, text: "Keeps Orvud’s residents in place so Rod’s Titan is stopped outside Wall Sina." }
        ], sourceUrl: official(16) },
      { id: "hange", type: "person", firstEpisode: 15, name: [{ from: 15, text: "Hange Zoë" }],
        faction: [{ from: 15, key: "survey" }], role: [{ from: 15, text: "Survey Corps squad leader, studies Titans" }],
        notes: [
          { episode: 15, text: "Studies captured Titans and explains the experiments to Eren." },
          { episode: 37, text: "Presents a theory that Ragako’s residents became Titans, without proof." },
          { episode: 38, text: "Runs the hardening experiments and concludes the Central Military Police killed Pastor Nick." },
          { episode: 40, text: "Learns the Reiss family’s secret from a captured Military Police officer." }
        ], sourceUrl: official(15) },
      { id: "jean", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Jean Kirstein" }],
        faction: [{ from: 4, key: "cadet" }, { from: 16, key: "survey" }], role: [{ from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }],
        notes: [
          { episode: 8, text: "Leads a group of soldiers to the supply headquarters in Trost." },
          { episode: 41, text: "Levi leaves the captured Military Police officers in his charge." }
        ], sourceUrl: official(7) },
      { id: "connie", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Connie Springer" }],
        faction: [{ from: 4, key: "cadet" }, { from: 16, key: "survey" }], role: [{ from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }],
        notes: [
          { episode: 28, text: "Finds his home village, Ragako, wrecked, with no bodies." },
          { episode: 29, text: "Ymir takes his knife before she transforms." }
        ], sourceUrl: official(6) },
      { id: "sasha", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Sasha Blouse" }],
        faction: [{ from: 4, key: "cadet" }, { from: 16, key: "survey" }], role: [{ from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }],
        notes: [{ episode: 26, text: "Waiting with the 104th in southern Wall Rose when Titans are reported inside the wall." }],
        sourceUrl: sources.s2 },
      { id: "historia", type: "person", firstEpisode: 16, aliases: ["Krista", "Krista Lenz"],
        name: [{ from: 16, text: "Krista Lenz" }, { from: 30, text: "Historia" }, { from: 40, text: "Historia Reiss" }],
        faction: [{ from: 16, key: "survey" }],
        role: [{ from: 16, text: "Survey Corps, 104th" }, { from: 38, text: "Survey Corps, Levi squad" }, { from: 47, text: "Declared herself the true ruler" }],
        notes: [
          { episode: 16, text: "A 104th recruit known as Krista, kind to everyone and close to Ymir." },
          { episode: 30, text: "Her real name is Historia." },
          { episode: 40, text: "Rod Reiss says he is her father." },
          { episode: 44, text: "Declares it her duty to take the Reiss family’s power." },
          { episode: 45, text: "Defies Rod and tries to escape with Eren." },
          { episode: 47, text: "Deals the final blow to Rod’s Titan and declares that she is the true ruler." }
        ],
        positions: [
          { episode: 38, locationId: null, note: "Hidden with the new Levi squad.", sourceUrl: sources.s3 },
          { episode: 39, locationId: null, note: "Carried off with Eren after the wagon is attacked.", sourceUrl: sources.s3 },
          { episode: 43, locationId: "reiss-chapel", note: "Stands with Rod beneath the chapel.", sourceUrl: sources.s3 },
          { episode: 47, locationId: "orvud", note: "Brings down Rod’s Titan and declares herself the true ruler.", sourceUrl: sources.s3 }
        ], sourceUrl: sources.s2 },
      { id: "ymir", type: "person", firstEpisode: 16, name: [{ from: 16, text: "Ymir" }],
        faction: [{ from: 16, key: "survey" }, { from: 29, key: "shifter" }],
        role: [{ from: 16, text: "Survey Corps, 104th" }, { from: 29, text: "Titan shifter" }, { from: 37, text: "Left with Reiner and Bertholdt" }],
        notes: [
          { episode: 16, text: "A 104th recruit who is rarely far from Krista." },
          { episode: 29, text: "Takes Connie’s knife, jumps from Utgard’s tower and transforms into a Titan." },
          { episode: 37, text: "Chooses to leave with Reiner and Bertholdt." }
        ], sourceUrl: sources.e29 },
      { id: "reiner", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Reiner Braun" }],
        faction: [{ from: 4, key: "cadet" }, { from: 16, key: "survey" }, { from: 31, key: "shifter" }],
        role: [{ from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }, { from: 31, text: "The Armored Titan" }],
        notes: [
          { episode: 4, text: "A dependable leader among the cadets." },
          { episode: 31, text: "Reveals that he is the Armored Titan." },
          { episode: 37, text: "Ymir leaves with him and Bertholdt." }
        ], sourceUrl: sources.e31 },
      { id: "bertholdt", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Bertholdt Hoover" }],
        faction: [{ from: 4, key: "cadet" }, { from: 16, key: "survey" }, { from: 31, key: "shifter" }],
        role: [{ from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }, { from: 31, text: "The Colossal Titan" }],
        notes: [
          { episode: 4, text: "A quiet cadet, usually at Reiner’s side." },
          { episode: 31, text: "Revealed as the Colossal Titan." }
        ], sourceUrl: sources.e31 },
      { id: "annie", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Annie Leonhart" }],
        faction: [{ from: 4, key: "cadet" }, { from: 23, key: "mp" }, { from: 24, key: "shifter" }],
        role: [{ from: 4, text: "104th Training Corps" }, { from: 23, text: "Military Police, Stohess" }, { from: 24, text: "The Female Titan" }],
        notes: [
          { episode: 4, text: "A cadet with outstanding hand-to-hand skill." },
          { episode: 24, text: "Transforms into the Female Titan when Armin’s plan closes in on her." },
          { episode: 25, text: "Seals herself inside a crystal after the battle in Stohess." }
        ], sourceUrl: sources.s2 },
      { id: "hannes", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Hannes" }],
        faction: [{ from: 1, key: "garrison" }], role: [{ from: 1, text: "Garrison" }],
        notes: [
          { episode: 1, text: "A Garrison soldier in Shiganshina and a friend of Eren’s family." },
          { episode: 31, text: "Reports that no hole has been found in Wall Rose." },
          { episode: 37, text: "Killed fighting the smiling Titan during the rescue." }
        ], sourceUrl: official(1) },
      { id: "pixis", type: "person", firstEpisode: 11, name: [{ from: 11, text: "Dot Pixis" }],
        faction: [{ from: 11, key: "garrison" }], role: [{ from: 11, text: "Garrison commander, southern territory" }],
        notes: [
          { episode: 11, text: "Orders the operation to retake Trost with Eren carrying a boulder to the gate." },
          { episode: 40, text: "Hears Erwin’s resolve to change humanity’s history." }
        ], sourceUrl: official(11) },
      { id: "nick", type: "person", firstEpisode: 26, name: [{ from: 26, text: "Pastor Nick" }],
        faction: [{ from: 26, key: "civilian" }], role: [{ from: 26, text: "Pastor of the Wall-worshipping church" }],
        notes: [
          { episode: 26, text: "Refuses to tell Hange anything about the Titan found inside the wall." },
          { episode: 38, text: "Murdered; Hange concludes the Central Military Police did it." }
        ], sourceUrl: sources.s2 },
      { id: "kenny", type: "person", firstEpisode: 39, name: [{ from: 39, text: "Kenny" }],
        faction: [{ from: 39, key: "central" }], role: [{ from: 39, text: "Hunts the Scouts for the Central Military Police" }],
        notes: [
          { episode: 39, text: "Ambushes Levi, who knows him from his past." },
          { episode: 47, text: "Badly wounded after the chapel collapses; tells Levi he was his mother’s brother, then dies." }
        ], sourceUrl: sources.s3 },
      { id: "rod", type: "person", firstEpisode: 40, name: [{ from: 40, text: "Rod Reiss" }],
        faction: [{ from: 40, key: "crown" }], role: [{ from: 40, text: "Head of the Reiss family" }],
        notes: [
          { episode: 40, text: "Says he is Historia’s father and tells her the family’s secret." },
          { episode: 43, text: "Says Grisha Yeager took his family from him five years ago." },
          { episode: 45, text: "Swallows the spilled drug and becomes a Titan larger than the Colossal." },
          { episode: 47, text: "His Titan is brought down at Orvud." }
        ], sourceUrl: sources.s3 },
      { id: "marlo", type: "person", firstEpisode: 41, name: [{ from: 41, text: "Marlo" }],
        faction: [{ from: 41, key: "mp" }], role: [{ from: 41, text: "Military Police" }],
        notes: [{ episode: 41, text: "Doubts his own branch’s methods and offers to help the Scouts." }], sourceUrl: sources.s3 },
      { id: "hitch", type: "person", firstEpisode: 41, name: [{ from: 41, text: "Hitch" }],
        faction: [{ from: 41, key: "mp" }], role: [{ from: 41, text: "Military Police" }],
        notes: [{ episode: 41, text: "On patrol with Marlo when the two stumble onto the hiding Scouts." }], sourceUrl: sources.s3 },
      { id: "grisha", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Grisha Yeager" }],
        faction: [{ from: 1, key: "civilian" }], role: [{ from: 1, text: "Eren’s father, a doctor" }],
        notes: [
          { episode: 1, text: "A doctor in Shiganshina, away when the district falls." },
          { episode: 43, text: "Rod Reiss says he took the Reiss family from him five years ago." }
        ], sourceUrl: sources.s3 },
      { id: "carla", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Carla Yeager" }],
        faction: [{ from: 1, key: "civilian" }], role: [{ from: 1, text: "Eren’s mother" }],
        notes: [{ episode: 1, text: "Killed by a Titan when the district is overrun." }], sourceUrl: official(2) },
      { id: "colossal", type: "titan", firstEpisode: 1, name: [{ from: 1, text: "Colossal Titan" }], revealedAs: { episode: 31, id: "bertholdt" },
        faction: [{ from: 1, key: "titan" }], role: [{ from: 1, text: "Titan" }],
        notes: [
          { episode: 1, text: "Towers over the wall and breaks Shiganshina’s outer gate." },
          { episode: 5, text: "Breaks Trost’s outer gate, then vanishes in steam." }
        ], sourceUrl: official(1) },
      { id: "armored", type: "titan", firstEpisode: 2, name: [{ from: 2, text: "Armored Titan" }], revealedAs: { episode: 31, id: "reiner" },
        faction: [{ from: 2, key: "titan" }], role: [{ from: 2, text: "Titan" }],
        notes: [{ episode: 2, text: "Charges through Wall Maria’s inner gate." }], sourceUrl: official(2) },
      { id: "female-titan", type: "titan", firstEpisode: 17, name: [{ from: 17, text: "Female Titan" }], revealedAs: { episode: 24, id: "annie" },
        faction: [{ from: 17, key: "titan" }], role: [{ from: 17, text: "Titan" }],
        notes: [
          { episode: 17, text: "A Titan that fights with intent and attacks the 57th expedition." },
          { episode: 18, text: "Pursues Eren’s group into the forest of giant trees." }
        ], sourceUrl: official(18) },
      { id: "beast", type: "titan", firstEpisode: 26, name: [{ from: 26, text: "Beast Titan" }],
        faction: [{ from: 26, key: "titan" }], role: [{ from: 26, text: "Titan" }],
        notes: [{ episode: 26, text: "A tall, fur-covered Titan that can speak. Where it comes from is unexplained." }], sourceUrl: sources.s2 },
      { id: "smiling-titan", type: "titan", firstEpisode: 1, name: [{ from: 1, text: "The smiling Titan" }],
        faction: [{ from: 1, key: "titan" }], role: [{ from: 1, text: "Titan" }],
        notes: [
          { episode: 1, text: "The Titan that kills Carla Yeager in Shiganshina." },
          { episode: 37, text: "Eren strikes its hand and nearby Titans turn on it." }
        ], sourceUrl: sources.e37detail },
      { id: "scouts", type: "group", firstEpisode: 1, name: [{ from: 1, text: "Survey Corps" }], aliases: ["Scouts", "Scout Regiment"],
        faction: [{ from: 1, key: "survey" }], role: [{ from: 1, text: "Regiment that fights beyond the walls" }],
        notes: [
          { episode: 16, text: "Leaves Karanes on its 57th expedition." },
          { episode: 41, text: "Framed for a civilian’s murder and forced into hiding." },
          { episode: 42, text: "Survives when the government that condemned it falls." }
        ],
        positions: [
          { episode: 16, locationId: "karanes", note: "Expedition departure. The Corps divides into groups; a single pin does not represent every member.", sourceUrl: sources.e16 },
          { episode: 18, locationId: "giant-forest", note: "The central column enters the forest while other soldiers remain outside it.", sourceUrl: official(18) },
          { episode: 22, locationId: "karanes", note: "The expedition returns through Karanes.", sourceUrl: wiki("Calaneth_District_%28Anime%29") },
          { episode: 25, locationId: "stohess", note: "Scouts take part in the Stohess operation. This does not place the entire Corps here.", sourceUrl: sources.e25 },
          { episode: 28, locationId: "utgard", note: "The soldiers sheltering at Utgard; other Scout groups are elsewhere.", sourceUrl: sources.e28detail },
          { episode: 29, locationId: "utgard", note: "The group defending Utgard faces a night attack.", sourceUrl: sources.e29 },
          { episode: 31, locationId: "wall-rose-south", note: "The survivors regroup on Wall Rose.", sourceUrl: sources.e31 },
          { episode: 37, locationId: "wall-rose-south", note: "Survivors retreat toward Wall Rose. The pin is an approximate area, not a live position.", sourceUrl: sources.e37detail },
          { episode: 41, locationId: null, note: "In hiding in a forest this map does not place.", sourceUrl: sources.s3 },
          { episode: 42, locationId: "capital", note: "Erwin stands trial in the king’s hall; the rest of the Corps is in hiding.", sourceUrl: sources.s3 },
          { episode: 45, locationId: "reiss-chapel", note: "The Scouts storm the chapel to rescue Eren and Historia.", sourceUrl: sources.s3 },
          { episode: 46, locationId: "orvud", note: "Prepares to stop Rod’s Titan outside Orvud.", sourceUrl: sources.s3 }
        ], sourceUrl: sources.e16 }
    ]
  };
})();
