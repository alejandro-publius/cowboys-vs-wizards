// Card bodies: a full-face front texture (assets/cards, set in match.css by
// data-unit), the shared card back, and edge slices for thickness.
import {tributeCost} from "../game/cards.js";

function span(className) {
  const node=document.createElement("span");
  node.className=className;
  return node;
}
export function describeCard(card) {
  if(card.kind==="spell")return card.name+", spell: "+(card.name==="Singularity"?"remove one enemy orb; optionally relocate the survivor.":"remove one enemy orb.");
  const cost=tributeCost(card.stars);
  return card.name+", "+card.stars+" stars, "+card.attack+" attack, "+card.health+" life orbs, "+(cost?cost+" tribute":"free summon");
}
export function createCardBody(card) {
  const body=span("card-body");
  body.setAttribute("aria-hidden","true");
  const face=span("card-face front-face");
  face.dataset.unit=card.name;
  const reverse=span("card-face card-reverse");
  body.append(face,reverse);
  for(let i=1;i<=7;i++) {
    const slice=span("card-slice");
    slice.style.setProperty("--z",i/8-.5);
    body.append(slice);
  }
  return body;
}
