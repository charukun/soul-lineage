# Generation prompts — RINNE, six seconds

Use the numbered roles in REFERENCES.json. The actual protagonist QA images override any invented face or clothes in the storyboard. Do not ask the model to reproduce the board as a grid. Output one full-frame film, no labels.

## Seedance final prompt (paste with references 01, 02, 06, 07)

```text
Create a SIX SECOND, four-shot opening film for the Japanese game RINNE / 百年転生. Then, only if the tool permits an eight-second deliverable, append TWO seconds of a locked-camera living tail. Story is complete and title landing is reached at exactly 6.00 seconds. 16:9, cinematic 3D animation, 24 fps. No text or logo in the video.

REFERENCE PRIORITY: Images 01 and 02 are the real current game protagonist: chunky three-head-tall villager, round black eyes, short swept ivory-blond hair, cream wrap tunic, brown belt and boots, olive trousers. Preserve this geometry and identity through childhood, adulthood and old age; age him, never redesign him. Image 06 is a storyboard ONLY; do not film its borders or labels. Image 07 is the final village composition and daylight. Mother has the game's modest olive-brown Rogue_Hooded silhouette. Characters are stylized volumetric game figures, not anime and not realistic humans.

THEME: One life ends; the world and the bloodline continue. The next child begins with nothing. No inherited weapon, armor or magical power.

0.00–1.35: Bright, expansive coastal village under morning light: mountains behind, harbor on the right, campfire plaza at center, market behind it, clan manor at left, forge at right, two simple watchtowers near the front. A low aerial move crosses swaying foreground grass and drops toward a hooded mother walking with her infant. The infant actively curls its tiny fingers around her finger. Mother steps, cloth sways, chimney smoke curls, sailcloth moves, birds cross distant sea. Keep foreground, middle village and distant coast visibly separate.

1.35–2.75: Match cut from the gripping hand to the SAME grown villager gripping a plain sword. He plants a foot, turns his torso and parries ONE grounded attack by a single modest armored foe. A short lateral camera arc follows the actual contact. No somersault, no beam, no explosion. Wind carries petals across the lens; they become autumn leaves at the cut. Let the viewer see the face and cream tunic.

2.75–4.05: Match the hand's position to the SAME person's aged hand beside the sword now resting at the old village campfire. His hair is white, face recognizably the same, body gently stooped. He exhales, quietly closes his eyes and opens his empty hand as his life ends. Passing seasons are indicated by one sweep of leaves to light snow to thawed grass, not a slideshow. Slow down the camera briefly. Peaceful death, no injury and no gore.

4.05–6.00: A single warm amber reflection passes from the opened hand to a newborn's eye. Newborn opens its eyes and grasps its mother's finger. This is the NEXT life; no weapon, no armor. Pull the camera up and back, physically passing the mother's shoulder, to reveal the SAME continuing village and harbor. Land by 6.00 on the composition of image 07: mother and newborn lower right, campfire plaza below center, harbor and sun on the right, hills on the left, clear sky above for later game UI. Readable daylight, warm sunlight with cool shadows, beautiful depth of field, gentle volumetric atmosphere. World is alive and larger than one person.

6.00–8.00 ONLY if producing an 8-second file: lock the camera completely on that last composition. Breathing, cloth, grass, chimney smoke and distant water remain alive. Subtle cyclic movement that joins frame 8.00 back to frame 6.00. No new story, no new camera motion, no fade to black. Keep audio wind and village only in this tail.

Continuity is essential: same face geometry and clothing, same village geography, same sun direction, the grip match cut between ages. No camera zoom on a static drawing. Actual skeletal body movement, cloth and environment motion in every shot. Four clear edits, not uncontrolled morphing of the whole frame.

Sound if supported: coastal wind and distant birds; soft footfall and one short metal parry; a human exhale and distant bell; a brief breath of silence; newborn breath and a restrained resolving two-note string phrase. No speech, no narrator, no licensed tune, no trailer boom. Film must tell the story when muted.
```

## Global negative prompt

```text
text, subtitles, letters, captions, UI, logo, watermark, storyboard grid, panel borders, still image pan, Ken Burns zoom, generic anime fantasy, realistic human, redesigned protagonist, long anime hair, glossy plastic face, inconsistent clothing, face morphing, melting architecture, extra limbs, extra fingers, fused fingers, weapon duplication, floating sword, sliding feet, impossible contact, multiple enemies, giant castle, dragons, gore, wounds, violent death, frightening infant, neon magic, firefly particle field, lens-filling flare, black screen, dark unreadable village, random explosion, excessive camera shake, abrupt unmatched title background, narration, trailer boom
```

## Individual-shot fallback

Generate 4–5 seconds per shot to obtain a clean action; edit only the intended action window into the six-second cut. Do not accelerate a slow still pan to imitate movement. Keep all relevant identity refs in every generation. Use the previous accepted shot's last frame as a continuity reference only after checking it.

| Shot | Prompt | Camera instruction | Motion instruction | Continuity instruction |
|---|---|---|---|---|
| 01 | Hooded mother carries an ivory-haired infant into the coastal home village; infant reaches and curls fingers around mother's finger. Morning, lively modest settlement. | Descend from an expansive 24mm village view through foreground grass to a 50mm hand/face medium close-up, single motivated move, natural focus pull. | Mother takes two grounded steps; infant reaches and grasps; grass, cloth, smoke and sailcloth move independently. | Preserve village layout and mother clothing in landing ref. End with gripping hand at lower-center facing screen-right. |
| 02 | Same infant now grown into the exact referenced cream-tunic villager, one planted sword parry against one armored opponent. Autumn begins. | 35mm low lateral arc about 35 degrees, foreground leaves; end close enough to read the grip. | One step, weight transfer, torso rotation, physically plausible sword contact and recovery. No repeated attack flurry. | Same black eyes, ivory hair and tunic as refs 01/02. Hand placement matches shot01. Enemy style only from ref05. Sword stays one object. |
| 03 | The same man now old at his home plaza, white hair and weathered hands; sword rests beside him; eyes close and empty hand opens in peaceful death. | 65mm intimate 20cm dolly-in with the living village soft in background. Stop camera briefly as breath leaves. | Natural exhale, eyelids close once, fingers relax; one restrained leaf/snow/thaw transition in background. | Preserve face bone shape and tunic. No grave, corpse horror, injury or other invented lore. Sword is left behind. |
| 04 | A newborn in mother's arms opens its eyes and takes her finger; rise over shoulder to the expansive same village composition. | 50mm close view to a 24mm crane pullback with depth, settling by edit time6.0 into ref07 framing. | Baby blinks, reaches and grips; mother rocks once; world moves gently. Hold camera for two additional seconds. | Amber reflection is one brief transition, not souls orbiting. Same mother silhouette, same coast and buildings. Child starts empty-handed. Last2sec must loop. |

Each shot also uses the full global negative prompt. If anatomy, identity or mechanics fail, regenerate that shot instead of covering the error with a flash.

## Veo 3.1 Fast adaptation

Use the final prompt above with an explicit output length of8 seconds. The first6 seconds contain exactly the four cuts, the final2 seconds are the locked-camera tail. Choose one output. Current inspected Flow choice was720p/8s,20 existing credits, with image-rights consent still pending. Do not buy credits or accept service terms without the required action-time consent. If image-reference mode disallows multiple inputs, use the actual three-quarter character and final composition, with the board retained as the director's reference. Never upload the board as a first-frame image if the model is likely to animate the grid itself.

## Editorial and technical handoff

- Generate without baked-in title. Video-safe action stays within the middle70% of the wide frame. Portrait playback preserves the entire16:9 composition rather than cutting off the mother.
- Review all frames at normal speed and quarter speed; check especially parry contact, fingers, eyelids, age cut, baby's eye, final-frame jump, and loop boundary.
- Export an approved master with no black head/tail. H.264 web transcode is separate.
- If model output is8 seconds but camera still moves after6, trim/re-edit/regenerate. Do not simply set landingTime=6 and cover the motion with a menu.
- If loop quality is weak, choose the6-second non-loop delivery, ending on a held decoded frame. A good still is preferable to an obvious loop jump.
- Run `import-title-movie.mjs`, then inspect the matching poster and playtest the ready manifest. The script is an encoder/importer, not a quality judge.
