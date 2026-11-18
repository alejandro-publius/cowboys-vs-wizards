import {ACHIEVEMENTS} from '../profile/player-profile.js';
import {renderDeckWorkbench} from './deck-workbench.js';

const $ = (root, selector) => root.querySelector(selector);
function element(tag, text, attrs={}) {
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
  return node;
}

export function mountTitleMenu(root,{profile,onPlay,onSettings,onTryDraft}) {
  const scene=$(root,'.title-scene'),page=$(root,'.menu-page'),content=$(root,'.menu-page-content');
  const heading=$(root,'#menu-page-title'),notice=$(root,'#menu-notice'),play=$(root,'#menu-play');
  // Only the graybox title screen carries data-deck-presets="true"; the illustrated builder has no marker.
  const presets=root.dataset.deckPresets==='true';
  let returnFocus=play;
  // paused tracks show({resume}) on its own; guidedAvailable turns off after any show().
  let guidedAvailable=true,loading=false,paused=false;
  const say=text=>{notice.textContent=text;notice.hidden=!text;};
  const savedMessage=text=>say(profile.isPersistent()?text:'Saved for this session only. Browser storage is unavailable.');
  const button=(text,fn,attrs={})=>{const b=element('button',text,{type:'button',...attrs});b.addEventListener('click',fn);return b;};
  async function start(opener,launch=()=>onPlay(false)){
    if(loading)return;
    loading=true;play.disabled=opener.disabled=true;say('Loading the board…');
    try{await launch();say('');}
    catch(error){console.error(error);say('The board could not load. Please try again.');}
    finally{
      loading=false;play.disabled=opener.disabled=false;
      if(!root.hidden&&opener.getClientRects().length)opener.focus();
    }
  }
  function home(){page.hidden=true;page.classList.remove('deck-page');scene.hidden=false;say('');returnFocus.focus();}
  function open(title,opener){
    page.classList.remove('deck-page');returnFocus=opener;scene.hidden=true;page.hidden=false;heading.textContent=title;
    content.replaceChildren();say('');$(root,'#menu-back').focus();
  }
  function settings(opener){
    open('Settings',opener);
    const current=profile.get().settings;
    for(const [key,label,hint] of [
      ['sound','Attack demo sound','Sound effects for Draw & fire and Singularity.'],
      ['reducedMotion','Reduce card movement','Skip card flights and hover movement. Your device preference is also respected.']
    ]){
      const input=element('input',undefined,{type:'checkbox',id:'setting-'+key});input.checked=current[key];
      const row=element('label',undefined,{class:'setting-row',for:input.id});
      const copy=element('span');copy.append(element('strong',label),element('small',hint));row.append(copy,input);
      input.addEventListener('change',()=>{profile.updateSettings({[key]:input.checked});onSettings(profile.get().settings);savedMessage('Settings saved on this device.');});
      content.append(row);
    }
    const select=element('select',undefined,{id:'setting-performance','aria-label':'Graphics quality'});
    for(const [value,label] of [['auto','Auto'],['low','Battery saver']])select.append(element('option',label,{value}));
    select.value=current.performance;
    select.addEventListener('change',()=>{profile.updateSettings({performance:select.value});onSettings(profile.get().settings);savedMessage('Settings saved on this device.');});
    const graphics=element('label',undefined,{class:'setting-row',for:select.id});
    const copy=element('span');copy.append(element('strong','Graphics'),element('small','Battery saver lowers resolution and turns off real-time shadows.'));
    graphics.append(copy,select);content.append(graphics,element('p',profile.isPersistent()?'Settings and progress are saved in this browser.':'Browser storage is unavailable; settings and progress last for this session.',{class:'menu-hint'}));
  }
  function achievements(opener){
    open('Achievements',opener);const saved=profile.get();
    content.append(element('p',`${saved.stats.matches} matches completed · ${saved.stats.wins} victories`,{class:'menu-intro'}));
    const list=element('ul',undefined,{class:'achievement-list'});
    for(const achievement of ACHIEVEMENTS){
      const earned=Boolean(saved.achievements[achievement.id]);
      const row=element('li',undefined,{'data-achievement':achievement.id,'data-earned':String(earned)});
      const copy=element('span');copy.append(element('strong',achievement.name),element('small',achievement.description));
      row.append(copy,element('span',earned?'Earned':'Locked',{class:'achievement-state'}));list.append(row);
    }
    content.append(list,element('p','Progress starts with matches played in this browser. No account needed.',{class:'menu-hint'}));
  }
  function how(opener){
    open('How to Play',opener);
    content.append(element('p','You lead the Cowboys. The computer commands the Wizards. Break the enemy Base before yours falls.',{class:'menu-intro'}));
    if(guidedAvailable){
      const guided=button('Start guided duel',()=>start(guided,()=>onPlay(true)),{id:'menu-guide',class:'menu-guide-button','aria-describedby':'menu-guide-summary'});
      content.append(guided,element('p','Play a starter-deck match with short hints as you take your first turns.',{id:'menu-guide-summary',class:'menu-guide-summary'}));
    }
    const steps=element('ol',undefined,{class:'how-steps'});
    for(const text of [
      'Choose a glowing card, pick a lane, then confirm your summon.',
      'Sheriffs summon freely. Billy costs one friendly troop; Mounted Billy costs two. Choose those tribute troops before placing the new one.',
      'On your turn, summon up to one troop and cast up to one spell. Both are optional. Summon first if you want to do both.',
      'Deadeye removes one life orb from an enemy troop, even when your lanes are empty. The Wizards’ Singularity removes an orb from one of your troops and can move the survivor to an empty lane.',
      'End your turn when ready. The Wizards act, then opposing troops strike at the same time: both deal damage even if one falls. An unblocked troop attacks the enemy Base.',
      'Each orb is one life. Both Bases start at five. After nine rounds, more Base orbs wins; equal Base orbs is a draw.'
    ])steps.append(element('li',text));
    content.append(steps,element('p','Escape cancels a card selection. Main menu pauses your match. Play resumes it. Restart starts a fresh match.',{class:'menu-hint'}));
  }
  function deck(opener){
    open('Build Deck',opener);
    page.classList.add('deck-page');
    // Try draft plays a copy of the current draft without saving it. Offered only
    // when the host supplies onTryDraft and no paused duel would be replaced.
    const tryDraft=typeof onTryDraft==='function'&&!paused
      ?(counts,opener)=>start(opener,()=>onTryDraft(counts))
      :undefined;
    renderDeckWorkbench({content,profile,say,savedMessage,button,presets,tryDraft});
  }
  const actions={settings,achievements,how,deck};
  for(const item of root.querySelectorAll('[data-menu-page]'))item.addEventListener('click',()=>actions[item.dataset.menuPage](item));
  $(root,'#menu-back').addEventListener('click',home);
  play.addEventListener('click',()=>start(play));
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!page.hidden){event.preventDefault();home();return;}
    if(!page.hidden||!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(event.key))return;
    const buttons=[...root.querySelectorAll('.menu-hotspot')];const at=buttons.indexOf(document.activeElement);
    if(at<0)return;event.preventDefault();const delta=['ArrowUp','ArrowLeft'].includes(event.key)?-1:1;
    buttons[(at+delta+buttons.length)%buttons.length].focus();
  });
  root.dataset.ready="true";
  return {
    show({resume=false}={}){guidedAvailable=false;paused=Boolean(resume);root.hidden=false;home();play.setAttribute('aria-label',resume?'Resume match':'Play');say(resume?'Match paused · Play to resume':'');play.focus();},
    hide(){root.hidden=true;},
    status:say
  };
}
