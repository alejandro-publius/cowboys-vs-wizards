// The visual direction for every Showdown card and place, written to be pasted into an image
// generator. One shared style, then one entry per card. export-art.mjs turns this into
// ART-DIRECTION.md and into the "Visual direction" column of cards.csv.
// The style follows the eight card paintings and the title art already in assets/.
// Nothing here generates or commissions art: these are words for Alex to use or change.

// Pasted once at the start of an image session. Everything after it inherits it.
export const STYLE = `Art direction for every image in this set: "Cowboys vs. Wizards", a haunted-Western fantasy card game.
One world, one evening: a frontier ghost town that ends where a wizards' graveyard begins. The Cowboys own the last light of sunset; the Wizards own the night that follows it.
Rendering: a stylized 3D look, like a hand-painted collectible figurine lit on a miniature film set. Sculpted, chunky forms with a bold silhouette you could recognise as a black shape. Slightly exaggerated proportions: large hands, big hats, heavy boots, strong jaws. Hand-painted textures with visible brushwork on leather, cloth, bone and wood. Rich detail on the subject, softer detail behind it. Not photorealistic, not anime, not pixel art, not flat vector.
Cowboy palette: lantern amber, rust red, saddle brown, dusty cream, worn brass, one teal accent. Sky behind Cowboys: burnt-orange sunset bleeding upward into purple, dust hanging in the air.
Wizard palette: deep violet, indigo, bone white, tarnished iron, and green witch-fire as the only bright colour. Sky behind Wizards: moonlit purple night, one large pale full moon, low mist, bare black trees.
The two palettes always touch: a Cowboy image has a violet edge and a hint of the coming night; a Wizard image has one small warm lantern or ember somewhere in it.
Lighting: one strong key light from the subject's faction (warm lantern light from below-left for Cowboys, green witch-fire or violet glow from below-right for Wizards), plus a cool violet rim light from the moon along the opposite edge. Deep plum shadows, never pure black.
Recurring objects: brass sheriff stars, horseshoes, oil lanterns, cartridge belts and weathered timber for the Cowboys; rune-carved stone, wrought-iron lanterns with green flame, cracked headstones, gold-embroidered violet cloth and old bone for the Wizards. Magic is violet with green sparks. Gunfire is gold.
Never include: any text, letters, numbers, signs with writing, card borders, frames, logos, watermarks, user-interface elements, modern objects, or more than the subject described.`;

// Added after the style, by what the card is. The card's frame, name and numbers are drawn by the game, not the image.
export const FRAMING = Object.freeze({
  troop: "Card illustration, portrait 5:7. One character, three-quarter view from slightly below eye level, shown from about the knees up, filling the middle of the picture. Keep the top sixth and bottom fifth free of anything important, because the game lays the name and the numbers there.",
  spell: "Card illustration, portrait 5:7. A spell is a moment, not a person: show the effect itself in motion as the subject, with at most a hand or a weapon entering from the edge of the picture. No faces. Keep the top sixth and bottom third calm, because the game lays the name and the rules text there.",
  trap: "Card illustration, portrait 5:7. A trap is an object lying in wait: show it from a low angle close to the ground, half hidden, with the feeling that something is about to step on it. No characters. Keep the top sixth and bottom third calm.",
  gear: "Card illustration, portrait 5:7. Gear is a single object: show it alone as a hero prop, resting or displayed, lit like a treasure, large in the picture. No characters. Keep the top sixth and bottom third calm.",
  location: "Card illustration, portrait 5:7. A location is a place: a wide establishing view with depth, no characters, the main building or landmark in the middle distance and a clear path leading to it. Keep the top sixth and bottom third calm.",
  place: "Environment painting, landscape 16:9. A wide establishing view with no characters and no creatures, a clear empty ground in the foreground where game pieces could stand, and depth behind it.",
  model: "Model sheet for 3D modelling. The same subject and the same colours and materials, but: the whole figure in frame from head to feet including any weapon or mount, standing in a neutral relaxed pose with arms slightly away from the body, three-quarter front view, alone and centred on a plain flat mid-grey background, soft even lighting from all sides, no cast shadow, no scenery, no smoke, glow, sparks, mist or motion effects, nothing transparent.",
});

// subject: who or what, so the silhouette, clothes, materials and prop are the same every time.
// scene: where it is and how it is lit, for the card illustration.
// cue: how the picture shows what the card does, so a player can read the rule from the art.
export const LOOK = Object.freeze({
  "cowboy-sheriff": {
    subject: "A stocky, barrel-chested lawman in his fifties with a huge walrus moustache, heavy brows and a weathered scowl. A wide, battered tan hat with a curled brim; a rust-red paisley bandana; a brown leather vest with brass buttons over a cream shirt with rolled sleeves; a five-point brass star on the chest; a cartridge belt with an oval brass buckle; dark wool trousers. One hand rests on a holstered revolver.",
    scene: "He stands on the saloon porch with his other hand on a swinging door. A glowing oil lantern hangs above his shoulder. Behind him the street falls away to a burnt-orange horizon turning purple.",
    cue: "Plain and dependable: feet planted, nothing fancy. He is the card every other Cowboy is measured against."},
  "cowboy-billy": {
    subject: "A lean young gunslinger of about nineteen with wavy dark-brown hair and a cocky half-smile. A tan hat pushed back on his head; a teal neckerchief, the one teal note in the Cowboy palette; a rust leather vest with long tails over a cream shirt; a low-slung gun belt; scuffed boots. He holds a long-barrelled revolver up beside his head, barrel to the sky.",
    scene: "The middle of the main street at sunset, the saloon front soft in the distance, dust curling around his boots.",
    cue: "Young, quick and sure of himself: weight on one hip, mid-stride, the opposite of the Sheriff's planted stance."},
  "cowboy-mounted-billy": {
    subject: "The same young gunslinger as Billy, same teal neckerchief and rust vest, now riding a chestnut horse with a white blaze and a dark mane. The horse rears mid-gallop; he leans forward in the saddle with the revolver raised and the reins in his other hand. Tooled brown saddle, brass tack.",
    scene: "Open ground at the edge of town, a sunset sky behind, a long cloud of kicked-up dust trailing off one side of the picture.",
    cue: "Ride: horse and rider are one diagonal streak of motion, hooves off the ground, dust stretched into speed lines."},
  "cowboy-deadeye": {
    subject: "A heavy engraved revolver enters from the left edge, held in a gloved hand, a curl of smoke at the muzzle. A single bullet hangs in mid-flight down the centre of the picture, leaving a spiralling ring of gold light behind it.",
    scene: "The empty main street at sunset, seen straight down its length, timber fronts on both sides, a far-off target lost in the glare.",
    cue: "One shot, one orb: a single clean gold line through an otherwise still picture."},
  "cowboy-captured-dragon": {
    subject: "The Graveyard Dragon, tamed: the same great horned beast with dark purple scales and a ridged neck, now in Cowboy colours. A heavy harness of brown leather and brass studs crosses its chest; a rust-red bandana is knotted around one horn; a brass star tag hangs from the collar. Its throat and belly glow amber instead of green, and the fire in its jaws is gold.",
    scene: "A timber corral at the edge of town at sunset, split rails splintered where it leans on them, the purple of the graveyard hills far behind.",
    cue: "Sweep: its head swings across the picture with a wide fan of gold fire that covers the whole width of the frame."},
  "cowboy-captured-wraith": {
    subject: "The Lantern Wraith, bound: a tall hooded phantom in a tattered grey-violet shroud with no face, only two points of light in the dark of the hood. It rises out of a brass railroad lantern like smoke from a bottle, and loops of pale rope hold its wrists. Its light has turned from green to warm amber.",
    scene: "A hitching rail on the main street at dusk, the brass lantern hanging from the rail, the sunset behind it showing faintly through its body.",
    cue: "Ghostly: from the waist down it thins to mist and the street shows through it, so a bullet-shaped spell would pass straight through."},
  "cowboy-covered-wagon": {
    subject: "A prairie schooner turned into a barricade: a patched cream canvas bonnet over curved hoops, heavy timber sides reinforced with riveted iron plates and a row of plank shields, tall iron-rimmed wheels chocked with stones. A driver in a slouch hat crouches behind the seat with a shotgun, only his hat and the barrels showing.",
    scene: "Parked broadside across the main street at sunset so nothing can pass, lanterns hung along its side, dust settling.",
    cue: "Guard: it fills the picture from edge to edge like a wall. Wide, low and heavy, the opposite of a rider."},
  "cowboy-outrider": {
    subject: "A lean deputy scout riding low over the neck of a slim grey pinto horse at a flat gallop. A long tan duster streams behind; a rust-red bandana is pulled up over the nose; a small brass deputy star is pinned to the duster; a carbine sits in a saddle scabbard. Light tack, no baggage.",
    scene: "The dry flat outside town at sunset, fence posts blurring past, the horse's shadow stretched long in front of it.",
    cue: "Ride: everything leans forward. A lighter, faster shape than Mounted Billy: thin horse, long coat, one clean line of speed."},
  "cowboy-dynamiter": {
    subject: "A wiry, grinning miner turned outlaw with a soot-smudged face, a singed ginger beard and a dented bowler hat. A bandolier of red dynamite sticks crosses his chest; more are tucked in his belt. He holds one stick high with its fuse spitting sparks, and shields his eyes from it with a scorched leather glove.",
    scene: "The mouth of a timber-framed mine cut at dusk, the lit fuse the brightest thing in the picture, its sparks throwing hard warm light up under his hat.",
    cue: "Last Stand: the burning fuse is the whole story. Whoever takes him down is standing too close."},
  "cowboy-ranger": {
    subject: "A tall, weathered tracker with a long dark braid and a calm, narrowed gaze. A wide flat-brimmed hat with a small brass star on the band; a long olive-brown duster; a rifle slung across the back; a brass spyglass raised to one eye; a coiled rope and a canteen at the hip.",
    scene: "A rock outcrop above the town at sunset, wind pulling the duster sideways, the valley and both ends of the street tiny and far below.",
    cue: "Scout: the spyglass and the high vantage. This is the Cowboy who sees what is coming and draws a card for it."},
  "cowboy-gatling-crew": {
    subject: "A brass multi-barrelled Gatling gun on a two-wheeled timber carriage, crewed by two Cowboys: a broad gunner in a leather apron cranking the handle with his teeth bared, and a wiry loader feeding a tall brass magazine. Barrels blurred with spin, brass casings tumbling out.",
    scene: "Dug in behind a low barricade of sandbags and barrels on the main street at sunset, gun smoke rolling off to one side.",
    cue: "Sweep: a fan of gold tracer lines spreads from the muzzle across the whole width of the picture, hitting everything in front of it at once."},
  "cowboy-lasso": {
    subject: "A spinning rope loop hangs wide open in the centre of the picture, faintly gold along its edge, the rope spiralling back to a gloved hand at the lower corner. Inside the loop, a twist of violet mist is caught and pulled tight.",
    scene: "Dusty open ground at sunset, seen from low down so the loop is ringed by sky.",
    cue: "Stun: the loop has already closed around the violet shape and stopped it mid-motion. Nothing is hurt; it is held."},
  "cowboy-bear-trap": {
    subject: "A heavy rusted iron bear trap with toothed jaws wide open, brass rivets at the hinge and a thick chain staked into the ground. Dust and dry grass are scattered over it so only the teeth catch the light.",
    scene: "The dirt of the main street at dusk, seen from ground level. In the soft distance a faint violet glow approaches, and one glowing footprint is already near the jaws.",
    cue: "It bites first: the open jaws wait in the foreground between the viewer and whatever is coming."},
  "cowboy-six-shooter": {
    subject: "An ornate revolver lying on a folded rust-red bandana: a long engraved steel barrel, a brass frame scrolled with vines, an ivory grip inlaid with a small brass star. Six brass cartridges stand in a row beside it.",
    scene: "A scarred timber table by a window at sunset, an oil lantern just out of frame throwing warm light across the metal.",
    cue: "Gear: a treasure handed to one troop. Lit like a prize, alone, nothing else on the table."},
  "cowboy-sheriffs-office": {
    subject: "A square timber jailhouse at the head of the street: a covered porch, a barred window glowing amber, a large brass star mounted above the door, a hitching rail, a rack of rifles just visible through the open doorway, and a wall of weathered poster boards with blank sheets.",
    scene: "Sunset behind the roofline, lanterns lit along the porch, long shadows of the hitching rail across the dust.",
    cue: "A place that makes every Lawman stronger: the star above the door is the brightest thing in the picture."},
  "wizard-skeleton": {
    subject: "A walking skeleton with a cracked skull and a loose jaw, wrapped in a tattered hooded cloak of faded violet. One rusted iron pauldron is strapped across a shoulder with rotten leather; a notched, rust-eaten dagger hangs in bony fingers.",
    scene: "Climbing over a broken tomb wall in the graveyard at night, the full moon behind its shoulder, a wrought-iron lantern with a green flame on the rune gateway beyond.",
    cue: "Plain and endless: the Wizards' basic troop, the one their other cards raise, pay and replace."},
  "wizard-wizard": {
    subject: "An old wizard with a long tangled white beard and sharp, amused eyes under a crooked wide-brimmed pointed hat set with a green gem. Layered violet robes edged with gold embroidery, a satchel of scrolls on a belt, a gnarled wooden staff topped with a caged green crystal. A small violet vortex turns above his open palm.",
    scene: "The graveyard path before the rune gateway at night, green lanterns on the stones, mist around the hem of his robe.",
    cue: "Raise: threads of green light run from the staff down into the earth at his feet, where a bony hand is pushing up out of the soil."},
  "wizard-dragon": {
    subject: "A colossal horned dragon with dark purple scales, a ridged crest down a long neck, torn bat wings and a glowing green throat and belly. Its jaws are open and green fire spills between the teeth.",
    scene: "Coiled across jagged purple crags above the graveyard at night, the full moon behind its horns, the rune gateway small below it.",
    cue: "Sweep: the fire leaves its mouth as a wide curving arc that crosses the whole picture, not a single jet."},
  "wizard-singularity": {
    subject: "A whirlpool of violet light with a pure black centre, tearing a hole in the air a hand's height above the ground. Green sparks spiral into it, and flagstones lift and crack toward it.",
    scene: "The graveyard at night, headstones leaning toward the pull, the moon and the rune gateway bent slightly at the edges of the picture.",
    cue: "One orb gone: everything in the picture leans inward to one point."},
  "wizard-lantern-wraith": {
    subject: "A tall, thin phantom in a long tattered shroud of grey-violet, its hood holding only darkness and two green points of light. One skeletal hand lifts a wrought-iron lantern on a chain, and the green flame inside is the brightest thing in the picture. It has no legs: the shroud frays into mist.",
    scene: "A crossroads on a bare hill outside the graveyard at night, a crooked signpost with blank boards, fog pooled in the hollows, the moon small and high.",
    cue: "Ghostly: the fence and the hill show through its body. A Wanted boss: it stands dead centre and looks straight at the viewer."},
  "wizard-imp": {
    subject: "A small wiry imp with magenta-violet skin, bat ears, two stubby horns, a barbed tail and a grin full of needle teeth. Ember-green eyes. It is caught mid-leap with both clawed hands stretched forward, trailing green sparks.",
    scene: "Bursting out of a crack in a tomb lid at night, splinters of stone still in the air, the moon behind it.",
    cue: "Quickdraw: it is already in the air and coming at the viewer. No wind-up, no waiting a turn."},
  "wizard-bone-wall": {
    subject: "A wall built of stacked skulls, ribs and thigh bones, bound with rusted iron bands and lit from within by a faint violet glow in the gaps. Skeletal arms reach out of it holding broken tomb slabs as shields.",
    scene: "Risen straight out of the graveyard earth at night, soil still falling from it, blocking the path to the rune gateway from edge to edge.",
    cue: "Guard: a wall, wide and flat, filling the picture side to side. It has no weapon of its own."},
  "wizard-raven-familiar": {
    subject: "A large raven with glossy black feathers that shine violet at the edges, one eye glowing green. A thin silver ring etched with a rune circles one leg, and a small rolled scroll tied with violet thread is held in its beak.",
    scene: "Perched on a tilted headstone at night, wings half open as if it has just landed, the full moon directly behind it.",
    cue: "Scout: it has come back with something. The scroll in its beak is the card it draws."},
  "wizard-headless-horseman": {
    subject: "A rider in a high-collared black-violet greatcoat with tarnished silver buttons and no head: green witch-fire flares up out of the empty collar. One gauntlet holds a curved cavalry sabre. The horse is black and skeletal at the ribs, with green flame for eyes and green fire around its hooves.",
    scene: "Galloping along the graveyard wall at night, mist torn apart by its passing, bare trees whipping by.",
    cue: "Ride: the Wizards' rider. The same forward-leaning streak as the Cowboy riders, in night colours, hooves off the ground."},
  "wizard-jack-o-lantern": {
    subject: "A knee-high scarecrow creature with a carved pumpkin for a head, lit from inside by green fire through a jagged grin and triangle eyes. A ragged burlap body stuffed with straw, twig arms and legs, and a curling stem on top that burns like a fuse.",
    scene: "Standing on a mound of fresh grave earth at night, its own green light the only light on the ground around it.",
    cue: "Last Stand: the burning stem is a fuse, the mirror of the Dynamiter's. It is small, it will fall, and it will take an orb with it."},
  "wizard-hellfire": {
    subject: "Columns of green and violet fire falling from a split in the night sky and bursting where they land, a dozen at once across the whole width of the picture.",
    scene: "The main street seen from the Wizard end at night, fence posts and a wagon wheel in black silhouette against the flames, embers drifting.",
    cue: "Every troop at once: the fire is spread evenly from edge to edge, with no single target."},
  "wizard-hex": {
    subject: "A circle of runes drawn on the ground in chalk and small bones, glowing faint violet under a skin of mist. At its centre sits a small stitched cloth doll stuck with three iron pins. Black candles gutter at the edge of the circle.",
    scene: "A patch of bare earth between headstones at night, seen from ground level, the circle almost invisible until the eye finds the doll.",
    cue: "The attack never lands: the trap is quiet, patient and nearly hidden, the opposite of the Bear Trap's teeth."},
  "wizard-bone-armor": {
    subject: "A breastplate made of ribs and a spine laced together with violet leather, shoulder guards cut from shoulder blades, a collar of small vertebrae, and tarnished iron buckles. It hangs on a wooden stand.",
    scene: "A stone alcove in a crypt, green candles on the ledge beside it, cobwebs in the corners, cold moonlight through a slit window.",
    cue: "Gear: two more orbs for whoever wears it. Displayed like a relic, alone."},
  "wizard-boneyard": {
    subject: "A wide graveyard on a slope: crooked headstones, a leaning iron fence, open graves with fresh earth beside them, a dead black tree, and wrought-iron lanterns with green flames along a winding path that leads up to a rune-carved stone gateway.",
    scene: "Deep night under a large full moon, mist lying in the hollows, the gateway glowing violet at the top of the hill.",
    cue: "A place that makes every Undead stronger: the open graves are the detail to notice."},
});

// Places: the board, the two Bases, the camp, and one view per duel, so the whole game shares one map.
export const PLACES = Object.freeze({
  "The Showdown street (the board)": "One long dirt main street seen from a high three-quarter angle, running from the bottom of the picture to the top. The near end is the Cowboy end: timber store fronts, a saloon porch, hitching rails, oil lanterns, sunset light and long warm shadows. The far end is the Wizard end: the street turns to cracked flagstones, then headstones, and ends at a rune-carved stone gateway under a full moon with green lanterns. In the middle the amber light and the violet night meet in a visible line across the ground. Three clear standing spots on each side of that line.",
  "The Saloon (the Cowboy Base)": "A two-storey timber saloon with a covered porch, swinging doors, warm light pouring from every window, a longhorn skull above the door and an oil lantern on a bracket. Sunset behind it. It should look like the thing worth defending.",
  "The Rune Gateway (the Wizard Base)": "A tall freestanding stone arch carved with glowing green runes, a slow violet vortex turning inside it, wrought-iron lanterns with green flame on either side, broken graveyard wall running off from both edges. Full moon above.",
  "The Camp": "A campfire at dusk on a rise between the two worlds: bedrolls, a coffee pot, a saddle on a log and a leaning signpost with blank boards. To one side the lit town at sunset; to the other the graveyard hill under the rising moon. Warm and safe: the place a player returns to between duels.",
  "Boot Hill": "A small, shallow graveyard on a dry hill just outside town at sunset: plain wooden crosses, a few boots left on the mounds, one hand of bone just breaking the soil. The gentlest, brightest Wizard place: most of the sky is still orange.",
  "Raven Roost": "A dead, many-branched tree on a rocky knoll at dusk, every branch crowded with ravens, nests of twigs and stolen trinkets, a few carved pumpkins among the roots. The sky is half orange, half violet.",
  "The Bone Fence": "A long fence of bones and iron crossing a field at nightfall, taller than a rider, with one barred gate in the middle. Beyond it the first real headstones. Last trace of orange on the horizon.",
  "Imp Hollow": "A narrow rocky hollow at night, its walls full of cracks and small burrows glowing green from inside, scorch marks on the stone, tiny clawed footprints in the dust.",
  "The Hexed Mile": "A straight sunken road at night between two rows of standing stones, each scratched with a rune that glows faintly violet. Chalk circles half hidden on the ground. Nothing moves. The danger is what cannot be seen.",
  "Dragon's Roost": "Jagged purple crags above the graveyard at night, a ledge strewn with charred bones and melted iron, claw marks in the rock, green firelight flickering from a cave mouth. The full moon is huge.",
  "The Stargazer's observatory": "A ruined round tower with a broken dome open to the night sky, a great brass telescope, star charts and floating points of violet light. Brass is the warm note here.",
  "The Imp's den": "A cave lit by a pit of green embers, piled with stolen Cowboy things: hats, spurs, lanterns, a cracked mirror. Mischief, not menace.",
  "The Bonewright's workshop": "A crypt turned workshop: racks of sorted bones, half-built skeletons on frames, iron tools, violet lamp light, a workbench with a ribcage breastplate on it.",
  "The Graveyard Coven": "A circle of tall standing stones on the hilltop behind the rune gateway at midnight, a green bonfire at its centre, the whole graveyard and the lit town far below.",
  "A Wanted poster": "A sheet of torn, yellowed paper nailed to weathered timber by a single iron nail, with a wide blank band at the top, a large empty portrait area in the middle framed by a rough inked border, and a blank band at the bottom. Lantern light from one side. No writing anywhere: the game adds the words.",
  "The card back": "A deep plum field with a worn gold filigree border, a brass horseshoe at the centre holding a violet diamond-cut gem, a small sheriff star above and a small wizard's hat below. Symmetrical top to bottom so it reads the same either way up. No lettering.",
  "A card pack": "A flat pack wrapped in waxed brown paper and tied with twine, sealed with a wax stamp showing a horseshoe around a violet gem, a faint violet glow leaking from one torn corner. On a timber table in lantern light.",
  "A life orb": "A single polished teal glass orb the size of a marble, with a soft inner glow and one bright highlight, set in a small worn brass claw. The one teal object in the game's interface: it must look the same on every card.",
});

// Card frames: one family, six members, so a card's kind is read from its border whatever the art shows.
// They all start from the frame on the existing cards. These are proposals; the frame look is Alex's to approve.
export const FRAME_BASE = "Empty card frame template, portrait 5:7, seen straight on, evenly lit. A deep plum field with fine grain; a blank name plate across the top; a large empty dark window for the picture in the upper two-thirds; a blank panel across the bottom for numbers or rules. Everything blank: no writing, no numbers, no symbols in the plates.";
export const FRAMES = Object.freeze({
  "Troop": "The frame already on the cards: ornate worn-gold filigree with scrolling corners, a violet diamond-cut gem at the top centre and at each side, a small brass horseshoe at the bottom centre. A plain, continuous gold edge.",
  "Spell": "The same plum field, but the metal is tarnished silver and the edge is a double line. The corner scrolls become thin arcane rings and star points, and the top gem is a round violet crystal with a faint glow. Lighter and finer than the troop frame.",
  "Trap": "The same plum field, but the edge is dark riveted iron, broken into short bars like a chain so it reads as a dashed line. Iron bolt heads at the corners, one small iron jaw motif at the top centre. Heavy and plain.",
  "Gear": "The same plum field, but the edge is stitched saddle leather with brass studs along it, a brass buckle at the top centre and leather corner caps. Warm and hand-made.",
  "Location": "The same plum field, but the edge is weathered timber planks on the left half and rune-carved stone on the right half, meeting at the top centre under a small lantern. Thicker along the bottom, like a foundation.",
  "Boss (Wanted and Captured)": "No plum field: the whole card is a torn, yellowed poster nailed to timber, with a rough inked border, a wide blank band at the top for one word, and a blank band at the bottom. A captured boss uses the same poster with a broken wax seal and a brass star pinned over one corner.",
});

// Troops with no 3D model yet, in the order a new player meets them on the Trail, then the rivals, then the bounties.
// The Sheriff, Billy, the Wizard, Mounted Billy, the Skeleton and the Dragon already have one in assets/models/.
export const MODEL_ORDER = Object.freeze(["cowboy-covered-wagon", "wizard-raven-familiar", "wizard-jack-o-lantern", "cowboy-outrider", "wizard-bone-wall",
  "cowboy-ranger", "wizard-imp", "cowboy-dynamiter", "wizard-headless-horseman", "cowboy-gatling-crew", "wizard-lantern-wraith", "cowboy-captured-wraith", "cowboy-captured-dragon"]);
