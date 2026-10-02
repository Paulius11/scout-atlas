/* Scout Atlas: curated anime milestones through overall episode 59 only.
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
  // English episode titles through the viewer's ceiling, including episodes without map events.
  // Seasons 1–2 checked against the English episode tables; Season 3 retains its sourced titles.
  const episodeTitles = [
    "To You, in 2000 Years: The Fall of Shiganshina, Part 1",
    "That Day: The Fall of Shiganshina, Part 2",
    "A Dim Light Amid Despair: Humanity's Comeback, Part 1",
    "The Night of the Closing Ceremony: Humanity's Comeback, Part 2",
    "First Battle: The Struggle for Trost, Part 1",
    "The World the Girl Saw: The Struggle for Trost, Part 2",
    "Small Blade: The Struggle for Trost, Part 3",
    "I Can Hear His Heartbeat: The Struggle for Trost, Part 4",
    "Whereabouts of His Left Arm: The Struggle for Trost, Part 5",
    "Response: The Struggle for Trost, Part 6",
    "Idol: The Struggle for Trost, Part 7",
    "Wound: The Struggle for Trost, Part 8",
    "Primal Desire: The Struggle for Trost, Part 9",
    "Can't Look into His Eyes Yet: Eve of the Counterattack, Part 1",
    "Special Operations Squad: Eve of the Counterattack, Part 2",
    "What Needs to Be Done Now: Eve of the Counterattack, Part 3",
    "Female Titan: The 57th Exterior Scouting Mission, Part 1",
    "Forest of Giant Trees: The 57th Exterior Scouting Mission, Part 2",
    "Bite: The 57th Exterior Scouting Mission, Part 3",
    "Erwin Smith: The 57th Exterior Scouting Mission, Part 4",
    "Crushing Blow: The 57th Exterior Scouting Mission, Part 5",
    "The Defeated: The 57th Exterior Scouting Mission, Part 6",
    "Smile: Assault on Stohess, Part 1",
    "Mercy: Assault on Stohess, Part 2",
    "Wall: Assault on Stohess, Part 3",
    "Beast Titan",
    "I'm Home",
    "Southwestward",
    "Soldier",
    "Historia",
    "Warrior",
    "Close Combat",
    "The Hunters",
    "Opening",
    "Children",
    "Charge",
    "Scream",
    "Smoke Signal",
    "Pain",
    "Old Story",
    "Trust",
    "Reply",
    "Sin",
    "Wish",
    "Outside the Walls of Orvud District",
    "Ruler of the Walls",
    "Friends",
    "Bystander",
    "Night of the Battle to Retake the Wall",
    "The Town Where Everything Began",
    "Thunder Spears",
    "Descent",
    "Perfect Game",
    "Hero",
    "Midnight Sun",
    "The Basement",
    "That Day",
    "Attack Titan",
    "The Other Side of the Wall",
  ].map((title, index) => ({
    number: index + 1, title,
    sourceUrl: `https://en.wikipedia.org/wiki/Attack_on_Titan_season_${index < 25 ? 1 : index < 37 ? 2 : 3}`
  }));
  function chapter(number, shortTitle, description, sourceUrl, events) {
    return {
      id: `episode-${number}`, number, title: episodeTitles[number - 1].title, shortTitle, description, sourceUrl,
      events: events.map((event, index) => ({
        id: `episode-${number}-event-${index + 1}`,
        kind: "confirmed", people: [], sourceUrl, ...event
      }))
    };
  }
  window.ATLAS_DATA = {
    maxEpisode: 59,
    episodeTitles,
    mapGeometry: {
      center: { x: 600, y: 405 }, unitsPerKm: 5 / 6,
      // Episode 1's information card: 250 km to Sina, then 130 km to Rose, then 100 km to Maria.
      wallRadiusKm: { maria: 480, rose: 380, sina: 250 },
      wallsView: { x: 100, y: -95, width: 1000, height: 1000, cx: 600, cy: 405 },
      islandView: { x: -750, y: -2350, width: 3250, height: 5650, cx: 875, cy: 475 },
      // A simplified trace of the island in episode 57's map frame. Wall-to-coast distances are approximate.
      islandReferenceCenter: [549, 134], islandReferenceScale: 32,
      islandOutline: [[520,91],[522,85],[530,79],[540,80],[547,84],[555,85],[560,91],[567,95],[574,102],[577,112],[578,125],[581,139],[586,152],[585,158],[591,166],[598,174],[595,179],[596,188],[590,194],[581,193],[575,190],[568,183],[562,181],[556,172],[551,176],[542,178],[535,175],[530,168],[529,155],[530,145],[529,135],[531,121],[527,108],[522,101]],
      wallSourceUrl: "https://www.hellominju.com/2020/10/1-12CurrentlyPubliclyAvailable.html",
      islandSourceUrl: "https://i.imgur.com/xVUHLew.jpg"
    },
    // Season boundaries in overall numbers. A season still in progress has no `last` until it is complete.
    seasons: [
      { season: 1, first: 1, last: 25 },
      { season: 2, first: 26, last: 37 },
      { season: 3, first: 38, last: 59 }
    ],
    episodes: [
      chapter(1, "Shiganshina", "Start at the southern district of Wall Maria, where Eren, Mikasa, and Armin live.", official(1), [
        { locationId: "shiganshina", people: ["eren", "mikasa", "armin"], title: "Life at the outer wall", summary: "Shiganshina is Eren, Mikasa, and Armin’s home. Eren wants to see the world beyond the walls.", connection: "This district gives the opening story its geographical starting point." },
        { locationId: "shiganshina", people: ["colossal"], title: "The gate is breached", summary: "The Colossal Titan breaks Shiganshina’s outer gate, allowing Titans into the district.", connection: "The attack turns the town’s protective boundary into an entry point.", sourceUrl: wiki("Shiganshina_District_%28Anime%29") }
      ]),
      chapter(2, "Evacuation", "The attack forces the survivors to abandon the territory inside Wall Maria.", official(2), [
        {"locationId": "shiganshina", "people": ["eren", "mikasa", "armin", "hannes"], "title": "Escape from the district", "summary": "Hannes carries Eren and Mikasa away. The surviving civilians escape by boat as Titans overrun Shiganshina."},
        {"locationId": "shiganshina", "people": ["armored"], "title": "The inner gate falls", "summary": "The Armored Titan breaks the gate leading into Wall Maria. Survivors withdraw behind Wall Rose.", "connection": "This second breach opens the land inside the outer wall, beyond the district itself."}
      ]),
      chapter(3, "Learning to stand", "Eren, Mikasa and Armin enter military training.", official(3), [
        {"locationId": null, "people": ["eren", "mikasa", "armin", "keith"], "title": "Balance training", "summary": "Eren struggles with the balance test, then passes when his faulty equipment is replaced.", "connection": "The training ground is not pinned: its exact position is not established here."}
      ]),
      chapter(4, "Graduation", "The recruits finish training and consider which military branch to join.", official(4), [
        {"locationId": null, "people": ["eren", "mikasa", "armin", "jean"], "title": "Choosing a branch", "summary": "Graduation gives the ten highest-ranked cadets the option of joining the Military Police. Eren still intends to join the Survey Corps."},
        {"locationId": "trost", "people": ["eren", "colossal"], "title": "The attack returns", "summary": "While the graduates work on Trost’s wall, the Colossal Titan suddenly appears and breaks the outer gate.", "connection": "The new attack is at Wall Rose, five years after Shiganshina fell."}
      ]),
      chapter(5, "Trost under attack", "Five years later, the fighting is at Trost, a different district on the southern edge of Wall Rose.", official(5), [
        { locationId: "trost", people: ["colossal", "eren"], title: "A different gate", summary: "The Colossal Titan has breached Trost’s outer gate. Eren attacks, but the Titan disappears in steam.", connection: "Trost belongs to Wall Rose; it is not Shiganshina or Wall Maria." },
        { locationId: "trost", title: "The district becomes a battlefield", summary: "Soldiers prepare to face Titans entering Trost. The immediate task is to defend the district and protect its people.", connection: "A breach in the district’s outer gate threatens access toward the territory behind Wall Rose." }
      ]),
      chapter(6, "Evacuating Trost", "The fighting continues while civilians try to leave the district.", official(6), [
        {"locationId": "trost", "people": ["armin", "connie"], "title": "A surviving cadet", "summary": "Connie finds Armin alone after his squad has been overwhelmed. Armin struggles to explain what happened to Eren."},
        {"locationId": "trost", "people": ["mikasa"], "title": "A blocked evacuation", "summary": "Mikasa confronts a merchant whose wagon blocks the exit and makes him clear the way for the civilians.", "connection": "Her childhood memories are not placed at Trost: this pin marks the present evacuation."}
      ]),
      chapter(7, "Running out of gas", "Cadets trapped in Trost need supplies before they can retreat.", official(7), [
        {"locationId": "trost", "people": ["jean", "connie", "armin", "mikasa"], "title": "The headquarters is surrounded", "summary": "With their gas running low, the cadets cannot climb to safety. Mikasa urges them toward the supply headquarters."},
        {"locationId": "trost", "people": ["mikasa"], "title": "An unexpected defender", "summary": "A Titan attacks other Titans near Mikasa. The soldiers see a possible opening, without knowing why it behaves differently."}
      ]),
      chapter(8, "Reach the supplies", "The battle remains inside Trost. Reaching the supply headquarters is essential to the trapped soldiers.", official(8), [
        { locationId: "trost", people: ["armin", "mikasa"], title: "A plan to reach headquarters", summary: "Armin proposes drawing the Titan that helped Mikasa toward the supply headquarters so it can attack the Titans there.", connection: "The immediate objective is a building within Trost, not a new town or another wall." },
        { locationId: "trost", people: ["jean", "mikasa", "connie"], title: "The soldiers converge", summary: "Jean’s group reaches the headquarters as Mikasa and Connie also move toward it.", connection: "Separate groups in the district are working toward the same supply point." }
      ]),
      chapter(9, "Eren returns", "Eren emerges from the Titan that helped the soldiers, but the garrison sees him as a threat.", official(9), [
        {"locationId": "trost", "people": ["eren", "mikasa", "armin"], "title": "A human inside a Titan", "summary": "Eren is found alive inside the exhausted Titan body, with his missing limbs restored.", "connection": "This establishes his transformation, without explaining its origin."},
        {"locationId": "trost", "people": ["eren", "mikasa", "armin"], "title": "Weapons turned inward", "summary": "Garrison soldiers surround Eren, Mikasa and Armin and demand to know whether Eren is human or Titan."}
      ]),
      chapter(10, "Defending Eren", "The three friends must persuade their own soldiers to listen.", official(10), [
        {"locationId": "trost", "people": ["eren", "mikasa", "armin"], "title": "A partial transformation", "summary": "Eren creates part of a Titan body to shield Mikasa and Armin from a cannon shot."},
        {"locationId": "trost", "people": ["armin"], "title": "Armin speaks for them", "summary": "Armin argues that Eren’s ability could help humanity. A senior garrison officer stops the immediate execution.", "connection": "The officer’s proposal follows in the next episode."}
      ]),
      chapter(11, "A plan for the gate", "Pixis proposes using Eren\u2019s Titan form to close Trost\u2019s breach.", official(11), [
        {"locationId": "trost", "people": ["pixis", "eren"], "title": "Carry the boulder", "summary": "Pixis asks Eren to carry a large boulder to the broken gate. Soldiers must divert the Titans while the operation proceeds.", "connection": "The plan targets Trost’s outer gate, not the lost gate at Shiganshina."}
      ]),
      chapter(12, "The operation falters", "Eren loses control after transforming for the gate operation.", official(12), [
        {"locationId": "trost", "people": ["eren", "mikasa"], "title": "The carrier attacks", "summary": "Instead of lifting the boulder, Eren attacks Mikasa and injures his own Titan body."},
        {"locationId": "trost", "people": ["armin", "eren"], "title": "Reaching Eren", "summary": "Armin approaches the immobilised Titan and tries to bring Eren back to awareness. The defenders continue protecting the operation."}
      ]),
      chapter(13, "Seal Trost", "Eren’s Titan form becomes central to the operation to close Trost’s breached gate.", official(13), [
        { locationId: "trost", people: ["armin", "eren"], title: "Protect the carrier", summary: "After Armin reaches him, Eren carries the boulder. Soldiers draw nearby Titans away so he can reach the gate.", connection: "This turns the struggle for survival into a coordinated operation at the original breach." },
        { locationId: "trost", people: ["eren"], title: "The breach is sealed", summary: "Eren places the boulder in the opening and blocks the damaged gate.", connection: "This closes the breach at Trost; it does not recover Shiganshina or the lost territory of Wall Maria." }
      ]),
      chapter(14, "The hearing", "The military debates which branch should take responsibility for Eren.", official(14), [
        {"locationId": null, "people": ["eren", "erwin", "levi"], "title": "Two competing plans", "summary": "The Military Police and the Survey Corps present different proposals for Eren’s future at a military hearing.", "connection": "The hearing room’s coordinates are not established here."},
        {"locationId": null, "people": ["eren", "levi", "erwin"], "title": "Placed with the Scouts", "summary": "Levi demonstrates that he can restrain Eren. The decision places Eren under Survey Corps supervision."}
      ]),
      chapter(15, "Special operations", "Eren joins Levi\u2019s squad and hears about Hange\u2019s research.", official(15), [
        {"locationId": null, "people": ["eren", "levi", "hange"], "title": "Before the expedition", "summary": "Eren meets Levi’s experienced squad. Hange describes experiments on two captured Titans.", "connection": "The squad’s headquarters is not the expedition forest."},
        {"locationId": null, "people": ["hange", "eren"], "title": "The test subjects are killed", "summary": "Both captive Titans are killed before the experiments can continue. The soldiers begin looking for whoever did it."}
      ]),
      chapter(16, "Leave from Karanes", "The Survey Corps prepares an expedition and departs through Karanes, on the east side of Wall Rose.", sources.e16, [
        { locationId: "karanes", people: ["eren"], title: "The expedition departs", summary: "The Survey Corps leaves Karanes for its 57th expedition. Eren and recruits who chose the Scouts take part.", connection: "Karanes is an eastern exit from Wall Rose; the earlier battle was at southern Trost." }
      ]),
      chapter(17, "The formation is attacked", "The expedition encounters an intelligent Titan on open ground beyond Wall Rose.", official(17), [
        {"locationId": null, "people": ["armin", "female-titan"], "title": "A different kind of pursuit", "summary": "The Female Titan attacks the scouting formation and examines Armin before leaving him alive.", "connection": "The encounter is outside Wall Rose; the exact point is not established."},
        {"locationId": null, "people": ["armin", "jean", "reiner", "female-titan"], "title": "Searching for Eren", "summary": "Armin, Jean and Reiner try to slow the attacker. Armin suspects that she is looking for Eren.", "connection": "That motive is Armin’s assessment at this point.", "kind": "belief"}
      ]),
      chapter(18, "Into the forest", "During the expedition outside Wall Rose, the formation encounters the Female Titan and enters a forest.", official(18), [
        { locationId: "giant-forest", people: ["eren", "levi"], title: "The center enters the trees", summary: "The central column, including Eren and Levi’s squad, moves into a forest of giant trees while other soldiers remain outside.", connection: "The expedition is in the territory between Wall Rose and Wall Maria, not beyond every wall." },
        { locationId: "giant-forest", people: ["female-titan", "eren"], title: "Terrain changes the encounter", summary: "The tall trunks provide anchor points for mobility gear. The Female Titan pursues Eren’s group into the forest.", connection: "Tree cover creates a very different situation from riding across open ground.", sourceUrl: wiki("Forest_of_Giant_Trees_%28Anime%29") }
      ]),
      chapter(19, "Trusting the squad", "Eren must choose whether to transform or follow Levi\u2019s orders in the forest.", official(19), [
        {"locationId": "giant-forest", "people": ["eren", "levi", "female-titan"], "title": "Keep riding", "summary": "Levi’s squad continues through the trees despite the soldiers falling behind them. Eren chooses to trust the squad instead of transforming."},
        {"locationId": "giant-forest", "people": ["female-titan", "erwin"], "title": "The trap closes", "summary": "Hidden soldiers fire restraint weapons and immobilise the Female Titan.", "connection": "The forest is part of a prepared capture operation."}
      ]),
      chapter(20, "A failed capture", "The Scouts try to reach the person inside the restrained Titan.", official(20), [
        {"locationId": "giant-forest", "people": ["erwin", "levi", "female-titan"], "title": "The nape is protected", "summary": "The Female Titan hardens around her nape, preventing the Scouts from cutting out the person inside."},
        {"locationId": "giant-forest", "people": ["female-titan"], "title": "Other Titans converge", "summary": "Her scream draws nearby Titans, which consume her Titan body. The Scouts cannot secure its occupant."}
      ]),
      chapter(21, "The pursuit resumes", "The attacker returns to confront Eren and Levi\u2019s squad.", official(21), [
        {"locationId": "giant-forest", "people": ["eren", "female-titan"], "title": "The escort is overwhelmed", "summary": "The attacker transforms again and kills the remaining members of Eren’s escort. Eren chooses to fight in his Titan form."},
        {"locationId": "giant-forest", "people": ["eren", "mikasa", "female-titan"], "title": "Eren is taken", "summary": "The Female Titan defeats Eren and takes him from his Titan body. Mikasa pursues her.", "connection": "The capture continues within the forest, not at a new district."}
      ]),
      chapter(22, "Rescue and retreat", "Levi and Mikasa focus on retrieving Eren from the Female Titan during the failed expedition.", official(22), [
        { locationId: "giant-forest", people: ["levi", "mikasa", "female-titan"], title: "Recover Eren", summary: "Levi and Mikasa pursue the Female Titan. Levi makes recovering Eren the priority and succeeds in freeing him.", connection: "The objective changes from confronting the enemy to bringing Eren back alive." },
        { locationId: "karanes", title: "Return through Karanes", summary: "The expedition returns through Karanes after heavy losses.", connection: "This closes the journey that began at the same eastern gate. The precise return route is not mapped.", sourceUrl: wiki("Calaneth_District_%28Anime%29") }
      ]),
      chapter(23, "An invitation underground", "Armin meets Annie in Stohess as the Scouts prepare another capture attempt.", official(23), [
        {"locationId": "stohess", "people": ["armin", "annie", "eren", "mikasa"], "title": "Help with an escape", "summary": "Armin asks Annie to help Eren evade custody by following them through an underground passage."},
        {"locationId": "stohess", "people": ["annie"], "title": "Annie refuses the passage", "summary": "Annie stops at the entrance, recognises the trap and triggers a transformation as soldiers close in.", "connection": "The plan moves the confrontation into a populated district at Wall Sina."}
      ]),
      chapter(24, "Fighting in Stohess", "Annie\u2019s Titan form pursues the Scouts through the district.", official(24), [
        {"locationId": "stohess", "people": ["eren", "armin", "mikasa", "annie", "female-titan"], "title": "The suspected identity is exposed", "summary": "Annie transforms into the Female Titan. Eren, Mikasa and Armin escape into the passage."},
        {"locationId": "stohess", "people": ["eren", "annie"], "title": "Eren joins the battle", "summary": "Eren initially cannot transform. He eventually does and confronts Annie amid the district’s buildings."}
      ]),
      chapter(25, "Stohess", "The conflict is now in Stohess, a district on the eastern edge of the innermost wall, Sina.", sources.e25, [
        { locationId: "stohess", people: ["eren", "annie"], title: "The battle in Stohess", summary: "Eren fights Annie in her Female Titan form in Stohess, causing major destruction in the district.", connection: "This moves the confrontation inward from the expedition territory to a populated district at Wall Sina." },
        { locationId: "stohess", people: ["annie"], title: "Annie is enclosed in crystal", summary: "Annie seals herself inside a crystal. The Scouts secure her, but cannot obtain answers from her.", connection: "Capturing a person and understanding their motives are separate outcomes.", sourceUrl: sources.e25detail }
      ]),
      chapter(26, "A new alarm", "A discovery at Wall Sina coincides with reports of Titans inside Wall Rose.", sources.s2, [
        {"locationId": "stohess", "people": ["hange", "nick"], "title": "A Titan inside the wall", "summary": "Damage to the wall reveals a Titan’s face. Nick insists that it must be covered from sunlight, but refuses to explain.", "connection": "The discovery is at Wall Sina, separate from the new alarm at Wall Rose."},
        {"locationId": null, "people": ["beast", "connie", "sasha"], "title": "Titans within Wall Rose", "summary": "The 104th recruits are sent to warn nearby settlements. A speaking Beast Titan confronts a Scout who stays behind.", "connection": "The encounter has no verified map coordinates."}
      ]),
      chapter(27, "Warning the villages", "Soldiers try to protect scattered settlements inside Wall Rose.", sources.s2, [
        {"locationId": null, "people": ["sasha"], "title": "A child left behind", "summary": "Sasha reaches a village under attack and rescues a child from a Titan.", "connection": "Her home region and this new village are not placed at guessed coordinates."},
        {"locationId": null, "people": ["eren", "hange", "nick"], "title": "Nick sees the evacuees", "summary": "Nick travels with the Scouts toward Wall Rose and sees the civilians displaced by the alarm. He still withholds the wall’s secret."}
      ]),
      chapter(28, "Search Wall Rose", "Teams search for a possible breach after Titans appear inside Wall Rose. Reports and observations do not yet explain how they arrived.", sources.e28, [
        { locationId: "ragako", people: ["connie"], title: "Questions at Ragako", summary: "Connie’s home village is wrecked. The absence of bodies and the remaining horses make a simple explanation difficult.", connection: "These observations raise questions; they do not establish what happened to the villagers.", sourceUrl: sources.e28detail },
        { locationId: "utgard", title: "Shelter at Utgard", summary: "Searching soldiers take shelter at Utgard Castle. Titans approach and attack despite the darkness.", connection: "The castle is inside Wall Rose, near its perimeter. Its exact position is approximate here.", sourceUrl: sources.e28detail }
      ]),
      chapter(29, "Utgard at night", "The soldiers at Utgard face a night attack with limited means to defend themselves.", sources.e29, [
        { locationId: "utgard", title: "The defenders are overwhelmed", summary: "Experienced soldiers fight the Titans while the recruits shelter in the castle. Their defense collapses as the attackers close in.", connection: "This continues the attack at the same castle introduced in the previous milestone." },
        { locationId: "utgard", people: ["ymir", "connie"], title: "Ymir transforms", summary: "Ymir takes Connie’s knife, jumps from the tower, and transforms into a Titan.", connection: "A new fact about Ymir is revealed here. It does not explain every other mystery surrounding the attack." }
      ]),
      chapter(30, "A name entrusted", "Ymir\u2019s transformation gives the survivors a chance to escape Utgard.", sources.s2, [
        {"locationId": null, "people": ["ymir", "historia"], "title": "A promise in the snow", "summary": "A training memory shows Ymir and Krista stranded in a snowstorm with an injured cadet. Ymir asks Krista to live under her real name.", "connection": "The mountain in the memory is not placed at Utgard."},
        {"locationId": "utgard", "people": ["ymir", "historia", "mikasa"], "title": "Rescue at the castle", "summary": "Ymir fights the attacking Titans but is badly injured. Reinforcements reach the castle, and Krista tells Ymir that her name is Historia."}
      ]),
      chapter(31, "On Wall Rose", "The survivors regroup on Wall Rose. The absence of a discovered breach leaves the earlier crisis unresolved.", sources.e31, [
        { locationId: "wall-rose-south", people: ["hannes"], title: "No breach found", summary: "Hannes reports that the search has found no hole in Wall Rose. The Scouts prepare to regroup at Trost.", connection: "The planned destination is Trost, but this conversation happens on the wall; those are different locations." },
        { locationId: "wall-rose-south", people: ["reiner", "bertholdt", "mikasa", "eren"], title: "Reiner and Bertholdt reveal themselves", summary: "Reiner identifies himself as the Armored Titan and Bertholdt as the Colossal Titan. After Mikasa attacks, both transform, and Eren transforms to confront them.", connection: "The identities are established at this point. Their full motives and wider circumstances remain unanswered." }
      ]),
      chapter(32, "The battle on the wall", "Eren fights the Armored Titan while the Scouts face the Colossal Titan.", sources.s2, [
        {"locationId": "wall-rose-south", "people": ["eren", "reiner", "armored"], "title": "Grappling with the armor", "summary": "Eren switches from punches to grappling, using joint locks against the Armored Titan."},
        {"locationId": "wall-rose-south", "people": ["bertholdt", "colossal", "hange", "ymir"], "title": "Steam blocks the approach", "summary": "The Colossal Titan takes Ymir and releases intense steam that keeps the Scouts from reaching him."}
      ]),
      chapter(33, "Preparing the pursuit", "The Scouts regroup after Eren is carried away.", sources.s2, [
        {"locationId": "wall-rose-south", "people": ["eren", "reiner", "bertholdt"], "title": "The fight is lost", "summary": "The Colossal Titan’s falling body interrupts Eren’s attack. Reiner and Bertholdt leave with Eren and Ymir."},
        {"locationId": "wall-rose-south", "people": ["mikasa", "armin", "hannes", "erwin"], "title": "A rescue force gathers", "summary": "Hours later, Mikasa wakes on the wall. Hannes encourages her and Armin while reinforcements prepare to pursue the captors."}
      ]),
      chapter(34, "Waiting in the trees", "Eren and Ymir regain consciousness while their captors wait for night.", sources.s2, [
        {"locationId": null, "people": ["eren", "ymir", "reiner", "bertholdt"], "title": "Escape is out of reach", "summary": "Eren wakes injured among giant trees. Reiner and Bertholdt intend to take their captives away after the surrounding Titans stop moving.", "connection": "This forest’s exact position is not established; it is not assigned to the earlier expedition pin."},
        {"locationId": null, "people": ["ymir", "reiner", "beast"], "title": "Questions without answers", "summary": "Ymir questions Reiner about the Beast Titan and their circumstances. Eren cannot recover enough strength to transform."}
      ]),
      chapter(35, "The rescuers approach", "The Scouts reach the forest as Ymir makes a choice about Historia.", sources.s2, [
        {"locationId": null, "people": ["erwin", "ymir", "historia"], "title": "Before sunset", "summary": "The rescue force reaches the trees. Ymir insists on taking Historia with her as the captors prepare to leave.", "connection": "The forest remains unpinned."},
        {"locationId": null, "people": ["ymir"], "title": "Ymir remembers", "summary": "Ymir recalls being given a revered identity, being punished with others, and spending decades as a Titan before becoming human again.", "connection": "This memory is recorded here without assigning its scenes to guessed places."}
      ]),
      chapter(36, "The charge", "The pursuit leaves the forest and becomes a desperate rescue in open terrain.", sources.s2, [
        {"locationId": null, "people": ["eren", "reiner", "bertholdt", "mikasa", "historia", "ymir"], "title": "A moving target", "summary": "The Armored Titan carries Eren away. Ymir protects Historia and obstructs Mikasa’s attacks on the captors.", "connection": "The precise rescue site is not established here."},
        {"locationId": null, "people": ["erwin", "armin", "eren"], "title": "An opening to escape", "summary": "Erwin draws Titans into the captors’ path. Despite losing an arm, he leads the attack that frees Eren."}
      ]),
      chapter(37, "The return", "Eren’s rescue reaches its conclusion. The Scouts survive with new observations and important unanswered questions.", sources.e37, [
        { locationId: "rescue-field", people: ["eren", "smiling-titan", "hannes"], title: "An unexplained response", summary: "After Eren strikes the smiling Titan’s hand, nearby Titans attack it. They later turn toward Reiner and Bertholdt, giving the Scouts an opening to escape.", connection: "The response is observed; the mechanism and limits of Eren’s power are not explained.", sourceUrl: sources.e37detail },
        { locationId: "wall-rose-south", people: ["eren", "ymir", "reiner", "bertholdt"], title: "Retreat toward Wall Rose", summary: "The surviving Scouts ride back toward Wall Rose with Eren. Ymir chooses to leave with Reiner and Bertholdt.", connection: "This marks the direction of retreat, not an exact gate or verified road.", sourceUrl: sources.e37detail },
        { locationId: "ragako", people: ["hange"], title: "A theory about Ragako", summary: "Hange reports evidence suggesting Ragako’s residents became Titans, while acknowledging the lack of proof. The pin marks the village being discussed, not the report’s meeting room.", kind: "belief", connection: "The earlier village observations now support a theory. Its cause is still unknown.", sourceUrl: sources.e37detail }
      ]),
      chapter(38, "A new Levi squad", "Eren and the other 104th recruits join a new Levi squad, while the Scouts learn that their enemy now includes people inside the walls.", sources.s3, [
        { locationId: null, people: ["hange", "eren"], title: "Can Eren’s Titan harden?", summary: "Hange runs experiments to find out whether Eren can harden his Titan body at will, the plan for sealing the hole in Wall Maria.", connection: "The goal is still to close Wall Maria. The squad works from a hidden location that this map does not place." },
        { locationId: "trost", people: ["nick", "hange"], title: "Pastor Nick is murdered", summary: "Word comes that Pastor Nick has been killed. Hange concludes that the Central Military Police did it, and a letter from Erwin reaches Levi.", connection: "The threat to the Scouts now comes from people inside the walls, not only from Titans.", sourceUrl: sources.s3summary }
      ]),
      chapter(39, "Taken", "The wagon carrying Eren and Historia is attacked, and Levi meets a man from his past.", sources.s3, [
        { locationId: null, people: ["eren", "historia"], title: "Eren and Historia are taken", summary: "The wagon carrying Eren and Historia is attacked and both are carried off.", connection: "Where they are taken is not shown to the Scouts, so the atlas does not pin it." },
        { locationId: null, people: ["levi", "kenny", "jean"], title: "Levi and Kenny", summary: "A man Levi calls Kenny blocks his pursuit. They fight to kill: people against people, both using vertical maneuvering equipment. Jean and the others are drawn into the fighting.", connection: "Levi and Kenny share a past. This episode does not explain it." }
      ]),
      chapter(40, "The Reiss secret", "Historia wakes beside a man who says he is her father, Rod Reiss. Hange and Erwin each move toward the same secret.", sources.s3, [
        { locationId: null, people: ["historia", "rod"], title: "Historia meets her father", summary: "Rod Reiss, who says he is Historia’s father, holds her and tells her a serious secret about the Reiss family.", connection: "The place where she wakes is not named, so it is not pinned." },
        { locationId: null, people: ["hange"], title: "Hange gets an answer", summary: "Hange makes a captured Military Police officer talk and learns the Reiss family’s secret too." },
        { locationId: null, people: ["erwin", "pixis"], title: "Erwin meets Pixis", summary: "Erwin tells Pixis that he is determined to change the course of humanity’s history." }
      ]),
      chapter(41, "Framed", "Accused of killing a civilian, the Survey Corps hides in a forest. Two Military Police patrollers stumble onto them.", sources.s3, [
        { locationId: null, title: "Hunted as murderers", summary: "A Military Police scheme pins a civilian’s murder on the Survey Corps, and its soldiers go into hiding.", connection: "The forest where they hide is not named, so it is not pinned." },
        { locationId: null, people: ["marlo", "hitch", "armin", "levi", "jean"], title: "Marlo and Hitch", summary: "Military Police officers Marlo and Hitch spot Armin fetching water and are captured by Levi’s group. Marlo, doubting his own branch’s methods, offers to help. Levi leaves the two in Jean’s charge." }
      ]),
      chapter(42, "Erwin’s trial", "Erwin faces a final trial in the king’s hall while his execution is prepared.", sources.s3, [
        { locationId: "capital", people: ["erwin"], title: "The last trial", summary: "In the king’s hall, Erwin argues that losing the Survey Corps would cost humanity its spear. No one listens, and he is led away toward execution.", connection: "The decision about the Scouts’ future is made at the centre of the walls, not at the front line." },
        { locationId: "capital", title: "A breach is reported", summary: "Word arrives that the Colossal and Armored Titans have broken through Wall Rose. The report is false: the rulers’ response to it exposes them, and the government loses its hold on power.", connection: "The report tested how those in power would react. No Titan attack took place.", sourceUrl: sources.s3summary }
      ]),
      chapter(43, "Under the chapel", "Eren wakes in chains beneath a chapel, with Historia standing beside her father.", sources.s3, [
        { locationId: "reiss-chapel", people: ["eren", "historia", "rod"], title: "In chains", summary: "Eren wakes chained up beneath the chapel. Historia is standing with Rod.", connection: "He is held underground, out of sight of the rest of the Scouts." },
        { locationId: "reiss-chapel", people: ["eren", "rod", "grisha"], kind: "belief", title: "A memory returns", summary: "When Rod and Historia touch Eren’s back, a buried memory surfaces. Rod says that on a night five years ago, Eren’s father, Grisha Yeager, took his family from him.", connection: "The memory is Eren’s; the account of what it means is Rod’s." }
      ]),
      chapter(44, "An inherited power", "Rod explains what the Reiss family has passed down, and Historia accepts it as her duty.", sources.s3, [
        { locationId: "reiss-chapel", people: ["rod", "eren"], kind: "belief", title: "What the Reiss family kept", summary: "Rod says a Titan power handed down through his family for generations is now inside Eren.", connection: "This is Rod’s explanation. How the power works is not shown." },
        { locationId: "reiss-chapel", people: ["historia", "eren"], title: "Historia’s duty", summary: "Historia declares it her mission to take that power, inherit the world’s history and rid the world of Titans. Eren, overwhelmed by guilt, resolves to leave humanity’s fate to her." }
      ]),
      chapter(45, "Rod transforms", "Historia turns against her father, and Rod becomes a Titan larger than the Colossal.", sources.s3, [
        { locationId: "reiss-chapel", people: ["historia", "rod", "eren"], title: "Historia refuses", summary: "Historia defies Rod and tries to escape with Eren. Rod takes in the drug spilled on the floor and turns into a Titan.", connection: "The plan Rod built around Historia fails because she refuses it." },
        { locationId: "reiss-chapel", people: ["eren"], title: "Bigger than the Colossal", summary: "The Scouts rescue Historia and the still-chained Eren while Rod’s Titan keeps forming, larger even than the Colossal Titan. Eren chooses to trust himself again, and his friends come through the collapse alive.", connection: "The cavern beneath the chapel does not survive the transformation." }
      ]),
      chapter(46, "Stand at Orvud", "Rod’s Titan climbs out and heads slowly for Orvud District, burning the trees around it.", sources.s3, [
        { locationId: "orvud", people: ["erwin"], title: "No evacuation", summary: "Erwin chooses not to evacuate Orvud. Its residents stay as bait so the Titan is stopped before damage reaches the heart of Wall Sina, and the goal is to lose no one.", connection: "The battle is fought outside a district wall, with civilians still behind it." },
        { locationId: "orvud", people: ["rod"], title: "A burning Titan", summary: "The Titan gives off intense heat and scorches the trees as it moves. The Survey Corps prepares to take it on.", connection: "Its path runs from the chapel to Orvud; the route drawn by this map is not exact." }
      ]),
      chapter(47, "The true ruler", "Rod’s Titan falls at Orvud, and Kenny, badly hurt, meets Levi one last time.", sources.s3, [
        { locationId: "orvud", people: ["historia", "rod"], title: "Historia’s final blow", summary: "Rod’s Titan is brought down. Historia deals the final blow herself and, in front of residents and soldiers, declares that she is the true ruler.", connection: "The fight ends at Orvud’s wall, not inside the district." },
        { locationId: "reiss-chapel", people: ["kenny", "levi"], title: "Kenny and Levi", summary: "Kenny lies badly wounded after escaping the collapsed chapel and remembers his life. Levi finds him, and Kenny takes out a syringe holding the Titan drug. Before he dies, he tells Levi he was his mother’s brother.", connection: "This answers the question of how Levi and Kenny were connected, raised in episode 39.", sourceUrl: sources.s3summary }
      ]),
      chapter(48, "After the coronation", "Two months after Historia is crowned, Eren’s hardening is put to work and he places a face from his father’s memory.", sources.s3summary, [
        { locationId: null, people: ["historia"], title: "The cowherd goddess", summary: "Two months after her coronation, Historia looks after orphans on a farm. People there fondly call her the cowherd goddess.", connection: "The farm is not named, so it is not pinned.", sourceUrl: sources.s3 },
        { locationId: null, people: ["eren", "hange"], title: "A weapon from hardening", summary: "Eren masters hardening, and Hange builds a weapon from it that kills Titans without putting soldiers at risk. The experiments wear Eren down, but he accepts the cost.", connection: "Hardening was meant to seal Wall Maria (episode 38). Now it also arms the Scouts." },
        { locationId: null, people: ["keith", "grisha", "eren"], kind: "belief", title: "Keith remembers Grisha", summary: "Eren recognises the Scout in his father’s memory as Keith Shadis, the Training Corps instructor. Keith says he met Grisha outside Wall Maria twenty years ago, a man who said he remembered nothing of his past. After the fall, Grisha led Eren into the woods, and Keith later found the boy alone with the key around his neck.", connection: "This is Keith’s account. It says how Grisha arrived, not where he came from." }
      ]),
      chapter(49, "The night before", "The operation to retake Wall Maria is set for two days later, and Erwin insists on leading it.", sources.s3summary, [
        { locationId: null, people: ["erwin", "levi"], title: "The drug and the commander", summary: "The Titan drug from Kenny’s syringe cannot be analysed. Erwin gives it to Levi, to use if someone has to be turned into a Titan. Levi asks the injured Erwin to stay behind; Erwin refuses, saying he must be there when the truth of the world comes to light.", connection: "Erwin expects that truth in the Yeager family’s basement in Shiganshina." },
        { locationId: "trost", people: ["eren", "mikasa", "armin"], title: "A send-off at Trost", summary: "After a night of feasting in the barracks, the Scouts set out. Trost’s people gather to cheer them, which surprises soldiers more used to being resented.", connection: "The expedition leaves from Trost, bound for Shiganshina." },
        { locationId: null, people: ["reiner", "bertholdt"], title: "Waiting on Wall Maria", summary: "Reiner and Bertholdt stand guard on top of Wall Maria.", connection: "Which stretch of the wall they watch is not shown, so it is not pinned." }
      ]),
      chapter(50, "Back to Shiganshina", "The Scouts ride into Wall Maria by night and reach Shiganshina, the town where it all began.", sources.s3summary, [
        { locationId: "shiganshina", people: ["eren", "armin"], title: "The outer gate is sealed", summary: "Eren’s hardened Titan plugs the hole in Shiganshina’s outer gate with surprising ease. The district is strangely empty of Titans.", connection: "The gate broken in episode 1 is closed again." },
        { locationId: "shiganshina", people: ["armin", "reiner", "armored"], title: "Out of the wall", summary: "Armin finds a fresh campsite and has the soldiers search the wall for hollows. Reiner bursts out of one and becomes the Armored Titan.", connection: "The enemy was waiting inside the wall itself." },
        { locationId: "shiganshina-inner", people: ["beast"], title: "Surrounded", summary: "The Beast Titan appears with an army of Titans and blocks Shiganshina’s inner gate with a boulder. The Scouts are surrounded.", connection: "The Beast Titan was first seen in episode 26. Where it comes from is still unexplained." }
      ]),
      chapter(51, "Thunder spears", "Surrounded, the Scouts protect their horses and throw everything at the Armored Titan.", sources.s3summary, [
        { locationId: "shiganshina-inner", people: ["beast", "erwin", "levi"], title: "Guard the horses", summary: "The Beast Titan sends smaller Titans after the Scouts’ horses, their only way home. Erwin commits most of the squads to protecting them.", connection: "Without the horses, the Scouts would be stranded in Wall Maria." },
        { locationId: "shiganshina", people: ["eren", "hange", "armored"], title: "Spears for the Armored Titan", summary: "Eren lures the Armored Titan away and holds it with hardened fists. Hange’s squad strikes with thunder spears, new weapons made for this enemy, blinding it and blasting open its nape.", connection: "The Scouts believe they have stopped it." }
      ]),
      chapter(52, "Bertholdt arrives", "The Armored Titan stirs again, and the Colossal Titan comes down on Shiganshina.", sources.s3summary, [
        { locationId: "trost", people: ["bertholdt", "reiner", "annie"], title: "What Marco heard", summary: "Bertholdt remembers the battle of Trost: their fellow cadet Marco overheard him, Reiner and Annie talking about being Titans, and they left him to be eaten.", connection: "A memory of the fighting in Trost (episodes 5–13). The pin marks where it happened, not where Bertholdt is now." },
        { locationId: "shiganshina", people: ["armored", "beast", "bertholdt", "armin"], title: "A barrel over the wall", summary: "The Armored Titan rises and roars. The Beast Titan throws a barrel into the district with Bertholdt inside. Armin tries to talk to him, but Bertholdt means to kill them all." },
        { locationId: "shiganshina", people: ["colossal", "hange", "armin"], title: "The blast", summary: "Bertholdt transforms into the Colossal Titan, and the explosion engulfs Hange’s squad. Armin cannot decide whether to attack or retreat as the Colossal Titan advances." }
      ]),
      chapter(53, "Two fronts", "Shiganshina burns, and the Scouts are split between the district and the ground outside it.", sources.s3summary, [
        { locationId: "shiganshina", people: ["colossal", "armin", "jean", "eren"], title: "A sea of fire", summary: "The Colossal Titan sets Shiganshina ablaze. Armin hands command to Jean. Eren tries to stop the Colossal Titan and is knocked unconscious.", connection: "One group of Scouts fights inside the district, the other outside it.", sourceUrl: sources.s3 },
        { locationId: "shiganshina-inner", people: ["beast", "erwin", "levi"], title: "A rain of stones", summary: "The Beast Titan hurls barrages of rock at the Scouts guarding the horses, and the losses mount." },
        { locationId: "shiganshina-inner", people: ["erwin", "levi"], title: "Erwin’s last order", summary: "Erwin proposes a charge: he and the recruits will draw the Beast Titan’s fire so Levi can reach it. Knowing it means their deaths, he says farewell to Levi, tells the recruits their lives and deaths will have meaning, and leads the charge into the stones." }
      ]),
      chapter(54, "The charge", "Erwin’s recruits ride at the Beast Titan while Armin plans against the Colossal Titan.", sources.s3summary, [
        { locationId: "shiganshina-inner", people: ["erwin", "beast"], title: "The charge", summary: "Erwin is struck down early. The recruits ride on until the Beast Titan’s stones wipe them out." },
        { locationId: "shiganshina-inner", people: ["levi", "beast", "four-legged-titan"], title: "Levi reaches the Beast Titan", summary: "Using the distraction, Levi cuts the Beast Titan apart and pulls out the bearded, blond man inside. He means to use the drug so that one of their own, Erwin if possible, can eat the man and take his power. A four-legged Titan snatches the man away first.", connection: "Who the man is, and where the four-legged Titan came from, are not explained." },
        { locationId: "shiganshina", people: ["hange", "reiner", "armored"], title: "Reiner blown out", summary: "Hange survived the blast because Moblit gave his life for her. With the others she blows Reiner out of the Armored Titan." },
        { locationId: "shiganshina", people: ["armin", "eren", "bertholdt", "colossal"], title: "Armin’s plan", summary: "Armin sees that the Colossal Titan stands still while it vents steam, and offers himself as the distraction. He holds on while the steam burns him. Eren, whose Titan only seemed knocked out, catches Bertholdt by surprise and tears him out of the Colossal Titan." }
      ]),
      chapter(55, "One dose", "With Armin and Erwin both dying, Levi has the drug for only one of them.", sources.s3summary, [
        { locationId: "shiganshina", people: ["eren", "armin", "bertholdt"], title: "On the rooftop", summary: "Eren is alone on a roof with Armin, burned almost to death, and the unconscious Bertholdt.", sourceUrl: sources.s3 },
        { locationId: "shiganshina", people: ["four-legged-titan", "beast", "eren"], kind: "belief", title: "A promise to Eren", summary: "The four-legged Titan arrives with the blond man from the Beast Titan. He says Eren’s father lied, promises a bewildered Eren that he will save him, and leaves.", connection: "What he means is not explained." },
        { locationId: "shiganshina", people: ["reiner", "hange", "four-legged-titan"], title: "Reiner escapes", summary: "Hange is about to finish Reiner when the four-legged Titan rescues him too." },
        { locationId: "shiganshina", people: ["levi", "armin", "erwin", "eren", "mikasa"], title: "Armin or Erwin", summary: "Levi is about to inject Armin when Floch, the only recruit to survive the charge, brings in the dying Erwin. Levi chooses Erwin, and Eren and Mikasa turn on him until Hange leads them away. Alone, Levi remembers a conversation with Erwin, lets him rest, and injects Armin instead." },
        { locationId: "shiganshina", people: ["armin", "bertholdt", "colossal", "erwin"], title: "Armin returns", summary: "Armin becomes a Titan and eats Bertholdt, gaining the Colossal Titan’s power. The squad pulls him out of the Titan body, healed, while Levi and Hange mourn Erwin.", connection: "This is the exchange Levi planned for the Beast Titan’s man in episode 54." }
      ]),
      chapter(56, "The basement", "Few Scouts are left on Shiganshina’s wall. Eren finally goes down to his family’s basement.", sources.s3summary, [
        { locationId: "shiganshina", people: ["armin", "levi"], title: "Nine left", summary: "Armin wakes on the wall to learn that nine Scouts are all that remain. He struggles with being chosen over Erwin; Levi says he does not regret it." },
        { locationId: "shiganshina", people: ["eren", "mikasa", "levi", "hange", "grisha"], title: "The key", summary: "Eren, Mikasa, Levi and Hange go down into the Yeager house’s basement. Grisha’s key does not open the door; it opens a desk drawer holding three books.", connection: "This is the basement Erwin hoped would hold the truth of the world." },
        { locationId: "shiganshina", people: ["grisha"], title: "A photograph", summary: "One book holds a picture of Grisha with a woman and a child who are not Carla and Eren. A note calls it a photograph, made with a technique from beyond the walls.", connection: "Who they are is not explained in this episode." },
        { locationId: null, people: ["grisha"], title: "Grisha’s first pages", summary: "After the credits, Grisha’s book recalls his boyhood beyond the walls: with his little sister Faye, he slipped out of their walled district to watch an airship land.", connection: "Where that district lies is not shown, so it is not pinned." }
      ]),
      chapter(57, "Grisha’s memories", "Held in the stockade, Eren relives his father’s life as the books from the basement record it.", sources.s3summary, [
        { locationId: null, people: ["eren", "mikasa"], title: "In the stockade", summary: "Eren and Mikasa are held in the stockade for defying Levi in Shiganshina. In a dream, Eren lives through his father’s memories.", connection: "The stockade is not placed on this map.", sourceUrl: sources.s3 },
        { locationId: null, people: ["grisha", "kruger"], title: "Liberio", summary: "As a boy, Grisha is caught with his sister Faye outside the Liberio internment zone by two officers, Kruger and Gross. Gross has Faye killed in secret. Grisha’s father teaches him their people’s history and how the nation of Marley despises them.", connection: "Liberio is in Marley, across the sea from the walls. It is not on this map." },
        { locationId: null, people: ["grisha", "dina", "zeke"], title: "The Restorationists", summary: "As a man, Grisha joins the Eldian Restoration movement, helped by an informant in the Marleyan military known as the Owl. He marries Dina Fritz, the last Eldian of royal blood on the mainland, and they have a son, Zeke. Raised to infiltrate the Marleyan army, Zeke turns his parents in." },
        { locationId: "sea", people: ["grisha", "dina", "smiling-titan"], title: "The wall on Paradis", summary: "Grisha, Dina and the other Restorationists are taken to the wall of Paradis Island, the island where the walls stand, to be turned into mindless Titans. Marley calls Eldians monsters because they can become Titans. Dina becomes the smiling Titan that later kills Carla.", connection: "This happens on the island’s coast. Where along it is not established; the sea marker stands for the whole coast." },
        { locationId: null, people: ["kruger", "grisha"], title: "The Owl", summary: "Kruger suddenly kills Gross, reveals that he is the Owl and a Titan shifter, transforms and wipes out the Marleyan security soldiers." }
      ]),
      chapter(58, "Kruger’s task", "Armin writes down what Kruger told Grisha, and the government learns what the books say.", sources.s3summary, [
        { locationId: null, people: ["kruger", "grisha", "armin", "eren"], title: "Kruger’s task", summary: "Kruger tells Grisha that anyone who holds a Titan power lives only thirteen years, and explains the Coordinate. He sends Grisha behind the walls of Paradis to take the Founding Titan from the royal family and to start a new family there, then has him injected. He also mentions Mikasa and Armin, names neither man can place.", connection: "Armin records this as Eren recounts it." },
        { locationId: null, people: ["hange"], title: "What the books say", summary: "At a government conference, Hange sets out what Grisha’s books reveal: everyone inside the walls is an Eldian, a Subject of Ymir, one of a people who can turn into Titans and are persecuted by the world outside.", connection: "Where the conference meets is not shown, so it is not pinned." },
        { locationId: "rescue-field", people: ["eren", "smiling-titan", "dina", "historia"], kind: "belief", title: "Why the Titans obeyed", summary: "Eren concludes that he could command mindless Titans because he touched Dina’s Titan, which carried royal blood. He keeps it to himself, fearing what the military might do to Historia.", connection: "This is Eren’s explanation of episode 37. The pin marks where he struck the smiling Titan’s hand." }
      ]),
      chapter(59, "To the sea", "The truth is made public, the survivors are honoured, and a year later the Scouts ride to the sea.", sources.s3summary, [
        { locationId: null, people: ["historia"], title: "The truth told", summary: "Historia decides the people must hear what was hidden for a hundred years: the fall of Wall Maria began an invasion planned by Marley to take the island’s resources, and the king a century ago erased everyone’s memories so they would believe the rest of humanity was gone.", connection: "The announcement is not tied to one place." },
        { locationId: null, people: ["historia", "eren"], title: "Medals", summary: "At a ceremony for the fallen, Historia gives medals to the nine surviving Scouts. When Eren touches her hand, a memory floods in.", connection: "Where the ceremony is held is not shown, so it is not pinned." },
        { locationId: "reiss-chapel", people: ["grisha", "eren"], title: "Grisha and the royal family", summary: "The memory Eren sees through Historia’s hand shows his father confronting the royal family.", connection: "The royal family is the Reiss family, and in episode 43 Rod said Grisha took his family from him. The pin marks their chapel." },
        { locationId: null, people: ["scouts"], title: "Wall Maria is cleared", summary: "It takes a year to kill every Titan inside Wall Maria. Refugees go back to their hometowns, and the Scouts resume expeditions beyond the walls.", connection: "The land between Walls Maria and Rose is held again; the map stops marking it as lost." },
        { locationId: "sea", people: ["scouts", "eren", "armin", "mikasa"], title: "The sea", summary: "Riding far enough, across desert, the Scouts reach the wall where Eren knows his father became a Titan, and see the ocean for the first time. While the others play in the water, Eren asks whether they will be free once they kill their enemies across the sea.", connection: "This is the coast from Grisha’s memory in episode 57. Which way the Scouts rode is not established: the map draws the desert all round, and the sea marker stands for the whole coast." }
      ])
    ],
    // Held and lost ground, and the state of district gates, as of the viewing episode.
    // target: "belt:maria-rose" (the land between Wall Maria and Wall Rose) or "gate:<location id>".
    status: [
      { target: "gate:shiganshina", from: 1, state: "breached", note: "The Colossal Titan breaks the outer gate.", sourceUrl: official(1) },
      { target: "belt:maria-rose", from: 2, state: "lost", note: "Wall Maria’s inner gate falls; the land between Wall Maria and Wall Rose is abandoned to the Titans.", sourceUrl: official(2) },
      { target: "gate:trost", from: 4, state: "breached", note: "The Colossal Titan breaks Trost’s outer gate.", sourceUrl: official(4) },
      { target: "gate:trost", from: 13, state: "sealed", note: "Eren’s Titan seals the gate with a boulder.", sourceUrl: official(13) },
      { target: "gate:shiganshina", from: 50, state: "sealed", note: "Eren’s hardened Titan plugs the hole in the outer gate.", sourceUrl: sources.s3summary },
      { target: "belt:maria-rose", from: 59, state: "held", note: "Over a year, every Titan inside Wall Maria is killed and refugees return home.", sourceUrl: sources.s3summary }
    ],
    // kind: district | village | castle | forest | wall | field | chapel | capital | sea
    // A visible place of kind "sea" also draws the coastline and the water around the whole island, and from
    // its `desertFrom` episode an illustrative patch of coastal sand.
    // area: approximate places are drawn as a dashed area of these radii (map units), not a point.
    // label.side: right (default) | left | below. Aliases are searched but never shown on the map.
    locations: [
      { id: "shiganshina", name: "Shiganshina", subtitle: "Southern district · Wall Maria", x: 600, y: 805, kind: "district", firstEpisode: 1,
        summary: "The home district of Eren, Mikasa, and Armin, built at the southern edge of the outermost wall.", why: "Use this as the southern reference point when comparing the three walls and their districts.", geography: "Southern Wall Maria is established geography. The wall radii follow the episode-one distances; the district outline is illustrative.", tags: ["Wall Maria", "Southern district"], sourceUrl: wiki("Shiganshina_District_%28Anime%29") },
      { id: "trost", name: "Trost", subtitle: "Southern district · Wall Rose", x: 600, y: 721.6667, kind: "district", firstEpisode: 4,
        summary: "A district projecting from the southern edge of Wall Rose, the middle wall.", why: "Trost and Shiganshina are different towns on different walls. Confusing them makes the early battles harder to follow.", geography: "Placed south of Wall Rose. Wall spacing follows the episode-one distances; district size is illustrative.", tags: ["Wall Rose", "Southern district"], sourceUrl: wiki("Trost_District") },
      { id: "karanes", name: "Karanes", subtitle: "Eastern district · Wall Rose", x: 916.6667, y: 405, kind: "district", firstEpisode: 16, aliases: ["Karanese", "Calaneth"],
        summary: "An eastern district of Wall Rose, also translated as Karanese or Calaneth.", why: "It provides the expedition’s eastern departure point, separate from Trost’s southern gate.", geography: "Eastern Wall Rose is established. No exact road or travel distance is implied.", tags: ["Wall Rose", "Eastern district"], sourceUrl: wiki("Calaneth_District_%28Anime%29") },
      { id: "giant-forest", name: "Forest of giant trees", subtitle: "57th expedition · Approximate area", x: 917.89, y: 542.72, kind: "forest", firstEpisode: 18, area: { rx: 58, ry: 44 },
        summary: "The large-tree forest encountered by the 57th expedition between Walls Rose and Maria.", why: "Tall trees create anchor points for mobility gear and change how soldiers can move and fight.", geography: "Between Walls Maria and Rose. This marker represents the expedition forest only; its exact coordinates are not established.", tags: ["Between the walls", "Approximate area"], sourceUrl: wiki("Forest_of_Giant_Trees_%28Anime%29") },
      { id: "stohess", name: "Stohess", subtitle: "Eastern district · Wall Sina", x: 808.3333, y: 405, kind: "district", firstEpisode: 23, aliases: ["Wall Sheena"], label: { side: "left" },
        summary: "A district at the eastern edge of Wall Sina, the innermost of the three walls.", why: "Its location shows how far inward this part of the story is compared with the expedition beyond Wall Rose.", geography: "Eastern Wall Sina, also translated as Wall Sheena. Wall spacing follows the episode-one distances; district size is illustrative.", tags: ["Wall Sina", "Eastern district"], sourceUrl: wiki("Stohess_District") },
      { id: "ragako", name: "Ragako", subtitle: "Connie’s village · Inside Wall Rose", x: 657.17, y: 660.01, kind: "village", firstEpisode: 28,
        summary: "Connie’s home village, in the southern territory enclosed by Wall Rose.", why: "Its position inside the wall is central to the question of how Titans appeared among the settlements.", geography: "Southern territory inside Wall Rose. The specific village coordinates are approximate.", tags: ["Inside Wall Rose", "Village"], sourceUrl: wiki("Ragako") },
      { id: "utgard", name: "Utgard Castle", subtitle: "A ruined castle · Inside Wall Rose", x: 416.08, y: 613.27, kind: "castle", firstEpisode: 28, label: { side: "left" },
        summary: "An abandoned castle near the perimeter inside Wall Rose, used as shelter by searching soldiers.", why: "It is a stop during the search within Wall Rose, not an outpost beyond Wall Maria.", geography: "Inside Wall Rose near its perimeter. The southwest placement and distances are schematic.", tags: ["Inside Wall Rose", "Castle"], sourceUrl: wiki("Utgard_Castle_%28Anime%29") },
      { id: "wall-rose-south", name: "Wall Rose · southern sector", mapLabel: "Southern Wall Rose", subtitle: "Wall-top meeting · Approximate sector", x: 440.52, y: 678, kind: "wall", firstEpisode: 31, label: { side: "left" }, area: { rx: 44, ry: 30 },
        summary: "The section of Wall Rose where soldiers regroup following Utgard. This is an area marker, not a named district.", why: "Conversations and fighting on the wall should not be mistaken for events inside Trost itself.", geography: "Placed on the southwestern arc of Wall Rose for orientation. The precise section is not established by this map.", tags: ["Wall Rose", "Approximate sector"], sourceUrl: sources.e31 },
      { id: "rescue-field", name: "Rescue operation area", subtitle: "Outside Wall Rose · Approximate area", x: 409.97, y: 723.42, kind: "field", firstEpisode: 37, label: { side: "left" }, area: { rx: 56, ry: 34 },
        summary: "The open terrain outside Wall Rose where the rescue and retreat take place. This is a descriptive label, not a canonical place name.", why: "This pin keeps the fighting outside the wall distinct from settlements within it.", geography: "Shown in the belt between Walls Rose and Maria. Position and terrain are deliberately approximate.", tags: ["Beyond Wall Rose", "Approximate area"], sourceUrl: sources.e37detail },
      { id: "capital", name: "Royal capital", subtitle: "Seat of the king · Inside Wall Sina", x: 600, y: 405, kind: "capital", firstEpisode: 42, label: { side: "below" },
        summary: "The seat of the king and the government, at the heart of Wall Sina.", why: "Erwin’s final trial is held in the king’s hall here: the fate of the Scouts is decided at the centre of the walls, far from any Titan.", geography: "Shown at the centre of Wall Sina for orientation. The capital’s size and exact position are not established by this map.", tags: ["Wall Sina", "Capital"], sourceUrl: sources.s3 },
      { id: "reiss-chapel", name: "Reiss family chapel", subtitle: "A cavern beneath · Approximate area", x: 451.16, y: 191.08, kind: "chapel", firstEpisode: 43, label: { side: "left" }, area: { rx: 40, ry: 30 },
        summary: "A chapel of the Reiss family, with a cavern beneath it where Eren is held in chains.", why: "The Reiss family’s secrets are kept here, underground and out of sight.", geography: "Placed between Wall Sina and Wall Rose for orientation. Its real position and distances are not established here.", tags: ["Between Sina and Rose", "Approximate area"], sourceUrl: sources.s3 },
      { id: "orvud", name: "Orvud District", subtitle: "Northern district · Wall Sina", x: 600, y: 196.6667, kind: "district", firstEpisode: 45, aliases: ["Orvud", "Wall Sheena"],
        summary: "A district projecting from the northern side of Wall Sina, the innermost wall.", why: "It moves the story to the north of the walls, far from the southern districts where it began.", geography: "Northern Wall Sina is established. The wall radii follow the episode-one distances; the district outline is illustrative.", tags: ["Wall Sina", "Northern district"], sourceUrl: sources.orvud },
      { id: "shiganshina-inner", name: "Beyond Shiganshina’s inner gate", mapLabel: "Beyond the inner gate", subtitle: "Inside Wall Maria · Approximate area", x: 557.55, y: 764.4, kind: "field", firstEpisode: 50, area: { rx: 50, ry: 20 },
        summary: "Open ground inside Wall Maria, outside Shiganshina’s inner gate, where the Beast Titan gathers its Titans. This is a descriptive label, not a canonical place name.", why: "It keeps the fighting outside the district apart from the battle in Shiganshina’s streets.", geography: "Just north of Shiganshina, in the land between Walls Maria and Rose. Position and extent are approximate.", tags: ["Between the walls", "Approximate area"], sourceUrl: sources.s3summary },
      { id: "sea", name: "The sea", subtitle: "Around Paradis Island · Coast", x: -190, y: 920, kind: "sea", firstEpisode: 57, desertFrom: 59, aliases: ["Ocean", "Coast", "Paradis Island"],
        summary: "The walls stand on Paradis Island, and the sea surrounds it. Grisha’s memories show a wall on its coast.", why: "The world does not end at Wall Maria: Grisha’s memories place Marley across the sea.", geography: "The island outline follows the map shown in episode 57. Its size relative to the walls and the coast marker’s position are approximate. The marker represents the coast generally, not a verified landing site.", tags: ["Beyond Wall Maria", "Coast"], sourceUrl: sources.s3summary }
    ],
    // type: person | titan | group. Every versioned list (name, role, faction) uses the entry with the
    // latest `from` at or before the viewing episode. `notes` are dated facts shown once watched.
    // revealedAs: from that episode on, the entry is known to be the named person.
    // firstEpisode is this edition's visibility threshold, not a claim about a first appearance.
    characters: [
      { id: "eren", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Eren Yeager" }],
        faction: [{ from: 1, key: "civilian" }, { from: 3, key: "cadet" }, { from: 16, key: "survey" }],
        role: [{ from: 1, text: "Shiganshina resident" }, { from: 3, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }, { from: 38, text: "Survey Corps, Levi squad" }],
        notes: [
          { episode: 1, text: "Grew up in Shiganshina and wants to see the world beyond the walls." },
          { episode: 9, text: "Emerges alive from the Titan body after the battle in Trost." },
          { episode: 13, text: "Can turn into a Titan; in that form he seals Trost’s gate with a boulder." },
          { episode: 38, text: "Hange tests whether his Titan body can harden, to seal Wall Maria." },
          { episode: 43, text: "A buried memory of his father and the Reiss family surfaces." },
          { episode: 44, text: "Rod Reiss says the power the Reiss family handed down is inside him." },
          { episode: 45, text: "Chooses to trust himself again and gets his friends through the chapel’s collapse." },
          { episode: 48, text: "Masters hardening; Hange builds a Titan-killing weapon from it." },
          { episode: 50, text: "Seals Shiganshina’s outer gate with his hardened Titan." },
          { episode: 54, text: "Tears Bertholdt out of the Colossal Titan." },
          { episode: 55, text: "Turns on Levi to win the drug for Armin." },
          { episode: 56, text: "Opens his father’s desk drawer in the basement and finds three books." },
          { episode: 57, text: "Held in the stockade with Mikasa; relives his father’s memories in a dream." },
          { episode: 58, text: "Concludes that touching Dina’s Titan let him command Titans, and keeps it to himself to protect Historia." },
          { episode: 59, text: "Sees his father confront the royal family through Historia’s hand; at the sea, asks if killing their enemies would make them free." }
        ],
        positions: [
          { episode: 1, locationId: "shiganshina", note: "Observed in his home district during the attack. This is a recorded observation, not continuous tracking.", sourceUrl: official(1) },
          { episode: 3, locationId: null, note: "Training at a site not pinned on this map.", sourceUrl: official(3) },
          { episode: 4, locationId: "trost", note: "On the wall at Trost when the Colossal Titan returns.", sourceUrl: official(4) },
          { episode: 5, locationId: "trost", note: "Fighting in Trost during the breach.", sourceUrl: official(5) },
          { episode: 13, locationId: "trost", note: "Closes Trost’s breached gate with the boulder.", sourceUrl: official(13) },
          { episode: 14, locationId: null, note: "At the military hearing; its exact site is not pinned.", sourceUrl: official(14) },
          { episode: 15, locationId: null, note: "At the squad headquarters, whose location is not pinned.", sourceUrl: official(15) },
          { episode: 16, locationId: "karanes", note: "Departs with the 57th expedition.", sourceUrl: sources.e16 },
          { episode: 17, locationId: null, note: "Riding with the expedition; the formation’s exact position is not pinned.", sourceUrl: official(17) },
          { episode: 18, locationId: "giant-forest", note: "In the expedition’s central column with Levi’s squad.", sourceUrl: official(18) },
          { episode: 22, locationId: "karanes", note: "Returns with the expedition after being rescued. Karanes is the return location, not the rescue site.", sourceUrl: wiki("Calaneth_District_%28Anime%29") },
          { episode: 23, locationId: "stohess", note: "Helps lure Annie toward the underground passage.", sourceUrl: official(23) },
          { episode: 25, locationId: "stohess", note: "Fights Annie in Stohess. This is the last mapped observation from the episode.", sourceUrl: sources.e25 },
          { episode: 26, locationId: null, note: "Travelling toward Wall Rose; no exact observation site is pinned.", sourceUrl: sources.s2 },
          { episode: 31, locationId: "wall-rose-south", note: "Confronts Reiner at Wall Rose. The marker identifies an approximate sector.", sourceUrl: sources.e31 },
          { episode: 33, locationId: null, note: "Carried away after the battle at Wall Rose.", sourceUrl: sources.s2 },
          { episode: 34, locationId: null, note: "Held in an unnamed forest, not assigned to the earlier expedition pin.", sourceUrl: sources.s2 },
          { episode: 37, locationId: "wall-rose-south", note: "Retreating toward Wall Rose with the Scouts. Area approximate; exact final location unmarked.", sourceUrl: sources.e37detail },
          { episode: 38, locationId: null, note: "With the new Levi squad at a hidden location this map does not place.", sourceUrl: sources.s3 },
          { episode: 39, locationId: null, note: "Carried off with Historia after the wagon is attacked.", sourceUrl: sources.s3 },
          { episode: 43, locationId: "reiss-chapel", note: "Wakes chained beneath the chapel.", sourceUrl: sources.s3 },
          { episode: 46, locationId: "orvud", note: "Takes part in the stand against Rod’s Titan at Orvud.", sourceUrl: sources.s3summary },
          { episode: 49, locationId: "trost", note: "Sets out from Trost with the expedition.", sourceUrl: sources.s3summary },
          { episode: 50, locationId: "shiganshina", note: "Back in his home district to seal the outer gate.", sourceUrl: sources.s3summary },
          { episode: 56, locationId: "shiganshina", note: "Goes down into his family’s basement.", sourceUrl: sources.s3summary },
          { episode: 57, locationId: null, note: "Held in the stockade, which this map does not place.", sourceUrl: sources.s3summary },
          { episode: 59, locationId: "sea", note: "Reaches the sea with the Scouts. Where along the coast is not established.", sourceUrl: sources.s3summary }
        ], sourceUrl: official(1) },
      { id: "mikasa", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Mikasa Ackerman" }],
        faction: [{ from: 1, key: "civilian" }, { from: 3, key: "cadet" }, { from: 16, key: "survey" }],
        role: [{ from: 1, text: "Lives with Eren’s family" }, { from: 3, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }],
        notes: [
          { episode: 1, text: "Lives with Eren’s family in Shiganshina and watches out for him." },
          { episode: 22, text: "Pursues the Female Titan with Levi to get Eren back." },
          { episode: 31, text: "Attacks Reiner and Bertholdt after they reveal themselves." },
          { episode: 55, text: "Turns on Levi with Eren to win the drug for Armin." },
          { episode: 56, text: "One of the nine surviving Scouts; goes into the basement with Eren." },
          { episode: 57, text: "Held in the stockade with Eren for defying Levi." },
          { episode: 59, text: "Receives a medal from Historia and reaches the sea with the Scouts." }
        ], sourceUrl: official(1) },
      { id: "armin", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Armin Arlert" }],
        faction: [{ from: 1, key: "civilian" }, { from: 3, key: "cadet" }, { from: 16, key: "survey" }],
        role: [{ from: 1, text: "Eren’s childhood friend" }, { from: 3, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }, { from: 55, text: "Survey Corps, holds the Colossal Titan’s power" }],
        notes: [
          { episode: 1, text: "Eren’s childhood friend in Shiganshina, more thinker than fighter." },
          { episode: 8, text: "Proposes the plan that gets the soldiers to the supply headquarters in Trost." },
          { episode: 13, text: "Reaches Eren’s Titan so the boulder can be carried to the gate." },
          { episode: 50, text: "Finds a fresh campsite and has the walls searched." },
          { episode: 53, text: "Freezes as the district burns and hands command to Jean." },
          { episode: 54, text: "Offers himself as the distraction; the Colossal Titan’s steam burns him almost to death." },
          { episode: 55, text: "Given the drug, he eats Bertholdt as a Titan and gains the Colossal Titan’s power." },
          { episode: 56, text: "Struggles with being chosen over Erwin." },
          { episode: 58, text: "Writes down Eren’s account of what Kruger told Grisha." },
          { episode: 59, text: "Sees the ocean with the Scouts." }
        ], sourceUrl: official(3) },
      { id: "levi", type: "person", firstEpisode: 14, name: [{ from: 14, text: "Levi" }],
        faction: [{ from: 14, key: "survey" }],
        role: [{ from: 14, text: "Survey Corps, leads his own squad" }],
        notes: [
          { episode: 14, text: "Known as humanity’s strongest soldier." },
          { episode: 22, text: "Frees Eren from the Female Titan." },
          { episode: 39, text: "Recognises Kenny, a man from his past, and fights him." },
          { episode: 47, text: "Kenny tells him before dying that he was his mother’s brother." },
          { episode: 49, text: "Erwin entrusts him with the Titan drug." },
          { episode: 54, text: "Cuts down the Beast Titan, but a four-legged Titan carries off the man inside." },
          { episode: 55, text: "Gives the one dose to Armin instead of Erwin." }
        ],
        positions: [
          { episode: 15, locationId: null, note: "At the squad headquarters, whose location is not pinned.", sourceUrl: official(15) },
          { episode: 17, locationId: null, note: "Riding with the expedition; no exact position is pinned.", sourceUrl: official(17) },
          { episode: 18, locationId: "giant-forest", note: "Leads his squad in the expedition’s central column.", sourceUrl: official(18) },
          { episode: 22, locationId: "giant-forest", note: "Recovers Eren from the Female Titan.", sourceUrl: official(22) },
          { episode: 23, locationId: null, note: "After the expedition; the atlas has no new established place record.", sourceUrl: official(23) },
          { episode: 38, locationId: null, note: "Leads the new squad at a hidden location this map does not place.", sourceUrl: sources.s3 },
          { episode: 39, locationId: null, note: "Fights Kenny after the wagon ambush.", sourceUrl: sources.s3 },
          { episode: 45, locationId: "reiss-chapel", note: "Storms the chapel with the Scouts to rescue Eren and Historia.", sourceUrl: sources.s3 },
          { episode: 47, locationId: "reiss-chapel", note: "Finds Kenny near the collapsed chapel.", sourceUrl: sources.s3 },
          { episode: 50, locationId: "shiganshina", note: "Reaches Shiganshina with the expedition.", sourceUrl: sources.s3summary },
          { episode: 51, locationId: "shiganshina-inner", note: "With Erwin’s group protecting the horses outside the district.", sourceUrl: sources.s3summary },
          { episode: 54, locationId: "shiganshina-inner", note: "Cuts down the Beast Titan during the charge.", sourceUrl: sources.s3summary },
          { episode: 55, locationId: "shiganshina", note: "Decides who receives the drug.", sourceUrl: sources.s3summary },
          { episode: 56, locationId: "shiganshina", note: "Goes down into the Yeager basement.", sourceUrl: sources.s3summary }
        ], sourceUrl: official(15) },
      { id: "erwin", type: "person", firstEpisode: 14, name: [{ from: 14, text: "Erwin Smith" }],
        faction: [{ from: 14, key: "survey" }], role: [{ from: 14, text: "Commander of the Survey Corps" }],
        notes: [
          { episode: 16, text: "Leads the 57th expedition out through Karanes." },
          { episode: 40, text: "Tells Pixis he means to change the course of humanity’s history." },
          { episode: 42, text: "Stands a final trial in the king’s hall; the government falls instead." },
          { episode: 46, text: "Keeps Orvud’s residents in place so Rod’s Titan is stopped outside Wall Sina." },
          { episode: 49, text: "Refuses to stay behind and gives Levi the Titan drug." },
          { episode: 53, text: "Leads the recruits in a charge to draw the Beast Titan’s fire." },
          { episode: 55, text: "Dies after Levi gives the drug to Armin." }
        ], sourceUrl: official(16) },
      { id: "hange", type: "person", firstEpisode: 15, name: [{ from: 15, text: "Hange Zoë" }],
        faction: [{ from: 15, key: "survey" }], role: [{ from: 15, text: "Survey Corps squad leader, studies Titans" }],
        notes: [
          { episode: 15, text: "Studies captured Titans and explains the experiments to Eren." },
          { episode: 37, text: "Presents a theory that Ragako’s residents became Titans, without proof." },
          { episode: 38, text: "Runs the hardening experiments and concludes the Central Military Police killed Pastor Nick." },
          { episode: 40, text: "Learns the Reiss family’s secret from a captured Military Police officer." },
          { episode: 48, text: "Builds a Titan-killing weapon from Eren’s hardening." },
          { episode: 51, text: "Her squad’s thunder spears bring down the Armored Titan." },
          { episode: 54, text: "Survives the Colossal Titan’s blast thanks to Moblit, then blows Reiner out of the Armored Titan." },
          { episode: 56, text: "One of the nine surviving Scouts; goes into the basement." },
          { episode: 58, text: "Presents what Grisha’s books reveal to a government conference." }
        ], sourceUrl: official(15) },
      { id: "jean", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Jean Kirstein" }],
        faction: [{ from: 4, key: "cadet" }, { from: 16, key: "survey" }], role: [{ from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }],
        notes: [
          { episode: 8, text: "Leads a group of soldiers to the supply headquarters in Trost." },
          { episode: 41, text: "Levi leaves the captured Military Police officers in his charge." },
          { episode: 53, text: "Takes command of the squad from Armin." },
          { episode: 56, text: "One of the nine surviving Scouts." }
        ], sourceUrl: official(7) },
      { id: "connie", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Connie Springer" }],
        faction: [{ from: 4, key: "cadet" }, { from: 16, key: "survey" }], role: [{ from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }],
        notes: [
          { episode: 28, text: "Finds his home village, Ragako, wrecked, with no bodies." },
          { episode: 29, text: "Ymir takes his knife before she transforms." },
          { episode: 56, text: "One of the nine surviving Scouts." }
        ], sourceUrl: official(6) },
      { id: "sasha", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Sasha Blouse" }],
        faction: [{ from: 4, key: "cadet" }, { from: 16, key: "survey" }], role: [{ from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }],
        notes: [
          { episode: 26, text: "Waiting with the 104th in southern Wall Rose when Titans are reported inside the wall." },
          { episode: 56, text: "One of the nine surviving Scouts." }
        ],
        sourceUrl: sources.s2 },
      { id: "historia", type: "person", firstEpisode: 4, aliases: ["Krista", "Krista Lenz"],
        name: [{ from: 4, text: "Krista Lenz" }, { from: 30, text: "Historia" }, { from: 40, text: "Historia Reiss" }],
        faction: [{ from: 4, key: "cadet" }, { from: 16, key: "survey" }, { from: 48, key: "crown" }],
        role: [{ from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps, 104th" }, { from: 38, text: "Survey Corps, Levi squad" }, { from: 47, text: "Declared herself the true ruler" }, { from: 48, text: "Queen" }],
        notes: [
          { episode: 16, text: "A 104th recruit known as Krista, kind to everyone and close to Ymir." },
          { episode: 30, text: "Her real name is Historia." },
          { episode: 40, text: "Rod Reiss says he is her father." },
          { episode: 44, text: "Declares it her duty to take the Reiss family’s power." },
          { episode: 45, text: "Defies Rod and tries to escape with Eren." },
          { episode: 47, text: "Deals the final blow to Rod’s Titan and declares that she is the true ruler." },
          { episode: 48, text: "Queen for two months; cares for orphans on a farm, where she is called the cowherd goddess." },
          { episode: 59, text: "Decides the people must be told the truth, and gives medals to the nine surviving Scouts." }
        ],
        positions: [
          { episode: 30, locationId: "utgard", note: "Tells Ymir her real name after the rescue at Utgard.", sourceUrl: sources.s2 },
          { episode: 31, locationId: "wall-rose-south", note: "Regroups with the other survivors on Wall Rose.", sourceUrl: sources.e31 },
          { episode: 38, locationId: null, note: "Hidden with the new Levi squad.", sourceUrl: sources.s3 },
          { episode: 39, locationId: null, note: "Carried off with Eren after the wagon is attacked.", sourceUrl: sources.s3 },
          { episode: 43, locationId: "reiss-chapel", note: "Stands with Rod beneath the chapel.", sourceUrl: sources.s3 },
          { episode: 47, locationId: "orvud", note: "Brings down Rod’s Titan and declares herself the true ruler.", sourceUrl: sources.s3 },
          { episode: 48, locationId: null, note: "On a farm this map does not place.", sourceUrl: sources.s3 }
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
          { episode: 37, text: "Ymir leaves with him and Bertholdt." },
          { episode: 49, text: "Stands guard on Wall Maria with Bertholdt." },
          { episode: 50, text: "Bursts from the wall at Shiganshina and becomes the Armored Titan." },
          { episode: 54, text: "Blown out of the Armored Titan by Hange’s team." },
          { episode: 55, text: "Rescued by the four-legged Titan." }
        ], sourceUrl: sources.e31 },
      { id: "bertholdt", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Bertholdt Hoover" }],
        faction: [{ from: 4, key: "cadet" }, { from: 16, key: "survey" }, { from: 31, key: "shifter" }],
        role: [{ from: 4, text: "104th Training Corps" }, { from: 16, text: "Survey Corps" }, { from: 31, text: "The Colossal Titan" }],
        notes: [
          { episode: 4, text: "A quiet cadet, usually at Reiner’s side." },
          { episode: 31, text: "Revealed as the Colossal Titan." },
          { episode: 49, text: "Stands guard on Wall Maria with Reiner." },
          { episode: 52, text: "Remembers leaving Marco to be eaten in Trost; drops into Shiganshina and becomes the Colossal Titan." },
          { episode: 54, text: "Eren tears him out of the Colossal Titan." },
          { episode: 55, text: "Eaten by Armin’s Titan." }
        ], sourceUrl: sources.e31 },
      { id: "annie", type: "person", firstEpisode: 4, name: [{ from: 4, text: "Annie Leonhart" }],
        faction: [{ from: 4, key: "cadet" }, { from: 23, key: "mp" }, { from: 24, key: "shifter" }],
        role: [{ from: 4, text: "104th Training Corps" }, { from: 23, text: "Military Police, Stohess" }, { from: 24, text: "The Female Titan" }],
        notes: [
          { episode: 4, text: "A cadet with outstanding hand-to-hand skill." },
          { episode: 24, text: "Transforms into the Female Titan when Armin’s plan closes in on her." },
          { episode: 25, text: "Seals herself inside a crystal after the battle in Stohess." },
          { episode: 52, text: "Bertholdt remembers her with him and Reiner when Marco overheard them in Trost." }
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
      { id: "keith", type: "person", firstEpisode: 3, name: [{ from: 3, text: "Keith Shadis" }],
        faction: [{ from: 3, key: "cadet" }],
        role: [{ from: 3, text: "Chief instructor, Training Corps" }, { from: 48, text: "Chief instructor, once Survey Corps commander" }],
        notes: [
          { episode: 3, text: "Drills the new 104th recruits without mercy." },
          { episode: 48, text: "Says he met Grisha outside Wall Maria twenty years ago, and that he handed command of the Survey Corps to Erwin." }
        ], sourceUrl: official(3) },
      { id: "grisha", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Grisha Yeager" }],
        faction: [{ from: 1, key: "civilian" }], role: [{ from: 1, text: "Eren’s father, a doctor" }, { from: 56, text: "Eren’s father, a doctor; grew up beyond the walls" }, { from: 57, text: "Eren’s father; an Eldian from Marley" }],
        notes: [
          { episode: 1, text: "A doctor in Shiganshina, away when the district falls." },
          { episode: 43, text: "Rod Reiss says he took the Reiss family from him five years ago." },
          { episode: 48, text: "Keith Shadis says he met him outside Wall Maria twenty years ago, claiming to remember nothing of his past." },
          { episode: 56, text: "His basement drawer holds three books and a photograph; his own account begins with a boyhood beyond the walls." },
          { episode: 57, text: "Grew up in Liberio, joined the Eldian Restorationists, married Dina Fritz and had a son, Zeke, who turned them in." },
          { episode: 58, text: "Kruger sends him behind the walls to take the Founding Titan from the royal family, then has him injected." },
          { episode: 59, text: "Eren sees him confronting the royal family." }
        ], sourceUrl: sources.s3 },
      { id: "dina", type: "person", firstEpisode: 57, name: [{ from: 57, text: "Dina Fritz" }],
        faction: [{ from: 57, key: "crown" }], role: [{ from: 57, text: "Grisha’s first wife, of royal blood" }],
        notes: [
          { episode: 57, text: "The last Eldian of royal blood on the mainland. Turned into a mindless Titan on Paradis, she becomes the smiling Titan." },
          { episode: 58, text: "Eren concludes that her royal blood is why touching her Titan let him command others." }
        ], sourceUrl: sources.s3summary },
      { id: "zeke", type: "person", firstEpisode: 57, name: [{ from: 57, text: "Zeke" }],
        faction: [{ from: 57, key: "civilian" }], role: [{ from: 57, text: "Grisha and Dina’s son" }],
        notes: [{ episode: 57, text: "Raised to infiltrate the Marleyan army, he turns his parents in instead." }], sourceUrl: sources.s3summary },
      { id: "kruger", type: "person", firstEpisode: 57, name: [{ from: 57, text: "Kruger" }, { from: 58, text: "Eren Kruger" }],
        faction: [{ from: 57, key: "shifter" }], role: [{ from: 57, text: "Marleyan officer, secretly the Owl" }],
        notes: [
          { episode: 57, text: "Catches young Grisha outside Liberio; years later reveals he is the Owl and a Titan shifter." },
          { episode: 58, text: "Tells Grisha a Titan power leaves thirteen years to live, and sends him to take the Founding Titan." }
        ], sourceUrl: sources.s3summary },
      { id: "carla", type: "person", firstEpisode: 1, name: [{ from: 1, text: "Carla Yeager" }],
        faction: [{ from: 1, key: "civilian" }], role: [{ from: 1, text: "Eren’s mother" }],
        notes: [{ episode: 1, text: "Killed by a Titan when the district is overrun." }], sourceUrl: official(2) },
      { id: "colossal", type: "titan", firstEpisode: 1, name: [{ from: 1, text: "Colossal Titan" }], revealedAs: { episode: 31, id: "bertholdt" },
        faction: [{ from: 1, key: "titan" }], role: [{ from: 1, text: "Titan" }],
        notes: [
          { episode: 1, text: "Towers over the wall and breaks Shiganshina’s outer gate." },
          { episode: 5, text: "Breaks Trost’s outer gate, then vanishes in steam." },
          { episode: 52, text: "Bertholdt transforms over Shiganshina; the blast sets the district ablaze." },
          { episode: 55, text: "Armin gains its power by eating Bertholdt." }
        ], sourceUrl: official(1) },
      { id: "armored", type: "titan", firstEpisode: 2, name: [{ from: 2, text: "Armored Titan" }], revealedAs: { episode: 31, id: "reiner" },
        faction: [{ from: 2, key: "titan" }], role: [{ from: 2, text: "Titan" }],
        notes: [
          { episode: 2, text: "Charges through Wall Maria’s inner gate." },
          { episode: 50, text: "Reappears at Shiganshina." },
          { episode: 51, text: "Blinded and stopped by thunder spears." },
          { episode: 54, text: "Hange’s team blows Reiner out of it." }
        ], sourceUrl: official(2) },
      { id: "female-titan", type: "titan", firstEpisode: 17, name: [{ from: 17, text: "Female Titan" }], revealedAs: { episode: 24, id: "annie" },
        faction: [{ from: 17, key: "titan" }], role: [{ from: 17, text: "Titan" }],
        notes: [
          { episode: 17, text: "A Titan that fights with intent and attacks the 57th expedition." },
          { episode: 18, text: "Pursues Eren’s group into the forest of giant trees." }
        ], sourceUrl: official(18) },
      { id: "beast", type: "titan", firstEpisode: 26, name: [{ from: 26, text: "Beast Titan" }],
        faction: [{ from: 26, key: "titan" }], role: [{ from: 26, text: "Titan" }],
        notes: [
          { episode: 26, text: "A tall, fur-covered Titan that can speak. Where it comes from is unexplained." },
          { episode: 50, text: "Appears at Shiganshina with an army of Titans and blocks the inner gate." },
          { episode: 53, text: "Hurls barrages of rock at the Scouts." },
          { episode: 54, text: "Levi cuts it apart and pulls out a bearded, blond man; a four-legged Titan carries him away." },
          { episode: 55, text: "The man tells Eren his father lied and promises to save him." }
        ], sourceUrl: sources.s2 },
      { id: "four-legged-titan", type: "titan", firstEpisode: 54, name: [{ from: 54, text: "Four-legged Titan" }],
        faction: [{ from: 54, key: "titan" }], role: [{ from: 54, text: "Titan" }],
        notes: [
          { episode: 54, text: "Snatches the man from the Beast Titan away from Levi." },
          { episode: 55, text: "Rescues Reiner from Hange." }
        ], sourceUrl: sources.s3summary },
      { id: "smiling-titan", type: "titan", firstEpisode: 1, name: [{ from: 1, text: "The smiling Titan" }], revealedAs: { episode: 57, id: "dina" },
        faction: [{ from: 1, key: "titan" }], role: [{ from: 1, text: "Titan" }],
        notes: [
          { episode: 1, text: "The Titan that kills Carla Yeager in Shiganshina." },
          { episode: 37, text: "Eren strikes its hand and nearby Titans turn on it." },
          { episode: 57, text: "Revealed as Dina Fritz, Grisha’s first wife, turned into a Titan on Paradis." }
        ], sourceUrl: sources.e37detail },
      { id: "scouts", type: "group", firstEpisode: 1, name: [{ from: 1, text: "Survey Corps" }], aliases: ["Scouts", "Scout Regiment"],
        faction: [{ from: 1, key: "survey" }], role: [{ from: 1, text: "Regiment that fights beyond the walls" }],
        notes: [
          { episode: 16, text: "Leaves Karanes on its 57th expedition." },
          { episode: 41, text: "Framed for a civilian’s murder and forced into hiding." },
          { episode: 42, text: "Survives when the government that condemned it falls." },
          { episode: 49, text: "Trost’s people cheer the expedition on its way to retake Wall Maria." },
          { episode: 54, text: "The recruits fall in Erwin’s charge against the Beast Titan." },
          { episode: 56, text: "Nine Scouts survive Shiganshina." },
          { episode: 59, text: "The survivors receive medals; a year later the Corps reaches the sea." }
        ],
        positions: [
          { episode: 16, locationId: "karanes", note: "Expedition departure. The Corps divides into groups; a single pin does not represent every member.", sourceUrl: sources.e16 },
          { episode: 17, locationId: null, note: "Spread through the scouting formation outside Wall Rose.", sourceUrl: official(17) },
          { episode: 18, locationId: "giant-forest", note: "The central column enters the forest while other soldiers remain outside it.", sourceUrl: official(18) },
          { episode: 22, locationId: "karanes", note: "The expedition returns through Karanes.", sourceUrl: wiki("Calaneth_District_%28Anime%29") },
          { episode: 23, locationId: "stohess", note: "The group conducting the capture operation; other Scouts are elsewhere.", sourceUrl: official(23) },
          { episode: 25, locationId: "stohess", note: "Scouts take part in the Stohess operation. This does not place the entire Corps here.", sourceUrl: sources.e25 },
          { episode: 26, locationId: null, note: "Split among the teams responding to the Wall Rose alarm.", sourceUrl: sources.s2 },
          { episode: 28, locationId: "utgard", note: "The soldiers sheltering at Utgard; other Scout groups are elsewhere.", sourceUrl: sources.e28detail },
          { episode: 29, locationId: "utgard", note: "The group defending Utgard faces a night attack.", sourceUrl: sources.e29 },
          { episode: 30, locationId: "utgard", note: "Reinforcements rescue the soldiers at Utgard.", sourceUrl: sources.s2 },
          { episode: 31, locationId: "wall-rose-south", note: "The survivors regroup on Wall Rose.", sourceUrl: sources.e31 },
          { episode: 35, locationId: null, note: "The rescue force reaches a forest whose exact site is not established.", sourceUrl: sources.s2 },
          { episode: 37, locationId: "wall-rose-south", note: "Survivors retreat toward Wall Rose. The pin is an approximate area, not a live position.", sourceUrl: sources.e37detail },
          { episode: 41, locationId: null, note: "In hiding in a forest this map does not place.", sourceUrl: sources.s3 },
          { episode: 42, locationId: "capital", note: "Erwin stands trial in the king’s hall; the rest of the Corps is in hiding.", sourceUrl: sources.s3 },
          { episode: 45, locationId: "reiss-chapel", note: "The Scouts storm the chapel to rescue Eren and Historia.", sourceUrl: sources.s3 },
          { episode: 46, locationId: "orvud", note: "Prepares to stop Rod’s Titan outside Orvud.", sourceUrl: sources.s3 },
          { episode: 49, locationId: "trost", note: "The expedition sets out from Trost.", sourceUrl: sources.s3summary },
          { episode: 50, locationId: "shiganshina", note: "Arrives to retake Wall Maria.", sourceUrl: sources.s3summary },
          { episode: 53, locationId: "shiganshina", note: "Split between the district and the ground outside it; the pin marks the district.", sourceUrl: sources.s3 },
          { episode: 56, locationId: "shiganshina", note: "The nine survivors gather on Shiganshina’s wall.", sourceUrl: sources.s3summary },
          { episode: 59, locationId: "sea", note: "The Corps reaches the sea. Where along the coast is not established.", sourceUrl: sources.s3summary }
        ], sourceUrl: sources.e16 }
    ]
  };
})();
