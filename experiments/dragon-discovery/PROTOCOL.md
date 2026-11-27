# G10 · First-time Dragon discovery

**Human observations pending.** From the checkout, run `node experiments/dragon-discovery/build.mjs`. Open `dist/g10/index.html` in a dedicated, persistent Chrome profile. Use that file, profile and build for all five players. Each receives a fresh sandboxed game with no access to existing careers or decks.

## Moderator script

1. Recruit five different people who have never played or seen Showdown. Run them individually, out of sight of one another. Confirm consent for anonymous written observations. The moderator verifies eligibility. **Prepare the next title screen** preloads the game.
2. Read only **“Find out how to recruit the Dragon.”** Select **Start on the title** and hand over control. Give no hints. Keep the game focused while the participant reads or thinks. Hidden or unfocused time is excluded.
3. The first accepted Ranger target from Wanted stops the clock. Either target on either table qualifies. A book visit, opening the board, and viewing the undecided turn all leave the clock running. Use **End observation** for an early give-up. The timer records a miss at the 60-second cap as `timeout`.
4. Ask **“What did you find out?”** Transcribe their words, omitting identifiers. Leave a nonresponse blank. Record any assistance up to this point, plus observations such as where they stopped. Move the screen out of the participant’s view, lock the interview and score each point against the recorded words.
5. Download the JSON after each slot. Repeated downloads with the same cohort ID are snapshots of one study. A reload during play consumes the slot as abandoned. A reload after a choice restores the interview or locked quote. Keep all five slots, including abandoned attempts.

**Pass criterion.** At least four of the five must each choose within **60,000 active milliseconds inclusive**, unaided, and independently explain **both** that scouting is free practice and that **winning five real Dragon hunts earns the card**. Accept equivalent wording. Score omissions and contradictions as No. The report stays pending until five slots resolve.

## Parent Chrome check · synthetic only

Append `?check` to the generated file’s URL. Alternatively serve `dist/g10` with `python3 -m http.server 8765 --bind 127.0.0.1 --directory dist/g10` and open `http://127.0.0.1:8765/index.html?check`. The check uses separate storage and stamps the export and rows `synthetic`.

- Start on the title. Choose **Camp → Wanted**. Inspect the Lantern Wraith and close its Field Guide with Escape. Select **Scout with the Ranger → Ranger attacks the Jack-o’-Lantern**. Only the target should open the interview. Lock a synthetic answer, grade it and download. Expect `dragon-c5`, `jack`, active milliseconds, and a `build` matching `LC_ALL=C shasum -a 256 dist/cowboys-vs-wizards-showdown-3d.html`.
- In slot two take **Night Shift Saloon → Open the Wanted board → Scout with the Ranger → Table B → Ranger attacks the Dragon** with Tab/Enter. Switch tabs for ten seconds before choosing. That time should be excluded. Record assistance and verify the slot fails.
- End slot three early. Let slot four time out while focused. Finish both interviews. Reload during slot five and export. Expect a miss, a timeout, an abandonment, five used slots and a failing verdict. The bare URL should still have an empty human cohort. In a disposable profile, compare the origin’s existing career/deck keys before and after.

**Instrument verification.** Eleven automated checks cover the recorder and both legal Ranger positions. In Chrome, four scripted slots chose a target across the two deals and one stopped at the poster. The downloaded JSON reported four qualifying slots, one miss and a synthetic cohort. Reloading between slots preserved the observations. The human cohort still contained zero observations. The G10 workbook supplies the criterion. [Felix Rieseberg’s essay](https://felixrieseberg.com/how-to-be-more-ambitious-a-tutorial-for-humans-with-models/)
