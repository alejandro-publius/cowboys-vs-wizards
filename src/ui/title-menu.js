import {ACHIEVEMENTS} from '../profile/player-profile.js';
import {COWBOY_CATALOG, DEFAULT_COUNTS, validateDeck} from '../game/deck-builder.js';

const $ = (root, selector) => root.querySelector(selector);
function element(tag, text, attrs={}) {
  const node=document.createElement(tag);
  if(text!==undefined)node.textContent=text;
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,value);
  return node;
}

export function mountTitleMenu(root,{profile,onPlay,onSettings}) {
  const scene=$(root,'.title-scene'),page=$(root,'.menu-page'),content=$(root,'.menu-page-content');
  const heading=$(root,'#menu-page-title'),notice=$(root,'#menu-notice'),play=$(root,'#menu-play');
  let returnFocus=play;
  const say=text=>{notice.textContent=text;notice.hidden=!text;};
  const savedMessage=text=>say(profile.isPersistent()?text:'Saved for this session only. Browser storage is unavailable.');
  const button=(text,fn,attrs={})=>{const b=element('button',text,{type:'button',...attrs});b.addEventListener('click',fn);return b;};
  function home(){page.hidden=true;scene.hidden=false;say('');returnFocus.focus();}
  function open(title,opener){
    returnFocus=opener;scene.hidden=true;page.hidden=false;heading.textContent=title;
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
    const steps=element('ol',undefined,{class:'how-steps'});
    for(const text of [
      'Choose a glowing card, pick a lane, then confirm your summon.',
      'Sheriffs summon freely. Billy costs one friendly troop; Mounted Billy costs two. Choose those tribute troops before placing the new one.',
      'Each round allows one summon, then one spell. Deadeye removes one life orb from an enemy troop.',
      'End your turn when ready. The Wizards act, then opposing lanes clash. An unblocked troop attacks the enemy Base.',
      'Each orb is one life. Both Bases start at five; if neither falls, the match resolves after nine rounds.'
    ])steps.append(element('li',text));
    content.append(steps,element('p','Escape cancels a card selection. Main menu pauses your match; Play resumes it. Restart begins a new match with your saved deck.',{class:'menu-hint'}));
  }
  function deck(opener){
    open('Build Deck',opener);
    const stored=profile.get().deck;
    let counts={...(stored&&validateDeck(stored).ok?stored:DEFAULT_COUNTS)};
    content.append(element('p','Your Cowboy deck · 12 cards · up to 6 copies of each card · at least 1 Sheriff', {class:'menu-intro'}));
    const grid=element('div',undefined,{class:'deck-grid'}),total=element('p','',{class:'deck-total',role:'status'});
    const fields=[];
    for(const card of COWBOY_CATALOG){
      const item=element('article',undefined,{class:'deck-choice'});
      const art=element('div',undefined,{class:'deck-art','data-card-type':card.type,role:'img','aria-label':card.name+' illustrated card'});
      const details=card.kind==='spell'?'Spell · removes 1 enemy orb':`${card.attack} attack · ${card.health} life · ${card.stars<5?'free summon':card.stars<7?'1 tribute':'2 tributes'}`;
      const quantity=element('output',String(counts[card.type]??0),{'aria-label':card.name+' copies'});
      const minus=button('−',()=>change(-1),{'aria-label':'Remove '+card.name});
      const plus=button('+',()=>change(1),{'aria-label':'Add '+card.name});
      function change(delta){counts[card.type]=(counts[card.type]??0)+delta;refresh();}
      const controls=element('div',undefined,{class:'deck-quantity'});controls.append(minus,quantity,plus);
      item.append(art,element('h3',card.name),element('p',details),controls);grid.append(item);fields.push({card,quantity,minus,plus});
    }
    const save=button('Save deck',()=>{
      const validation=validateDeck(counts);if(!validation.ok){say(validation.error);return;}
      profile.saveDeck(counts);savedMessage('Deck saved. Your next match will use these cards.');
    },{id:'save-deck'});
    const reset=button('Restore starter deck',()=>{counts={...DEFAULT_COUNTS};refresh();say('Starter deck restored. Choose Save deck to keep it.');});
    const actions=element('div',undefined,{class:'menu-actions'});actions.append(save,reset);
    content.append(grid,total,actions);
    function refresh(){
      const validation=validateDeck(counts);
      total.textContent=`${validation.total} / 12 cards${validation.ok?' · Ready to save':' · '+validation.error}`;
      save.disabled=!validation.ok;
      for(const {card,quantity,minus,plus} of fields){const n=counts[card.type]??0;quantity.textContent=n;minus.disabled=n===0;plus.disabled=n>=6||validation.total>=12;}
    }
    refresh();
  }
  const actions={settings,achievements,how,deck};
  for(const item of root.querySelectorAll('[data-menu-page]'))item.addEventListener('click',()=>actions[item.dataset.menuPage](item));
  $(root,'#menu-back').addEventListener('click',home);
  play.addEventListener('click',async()=>{
    play.disabled=true;say('Loading the board…');
    try{await onPlay();say('');}catch(error){console.error(error);say('The board could not load. Please try Play again.');}
    finally{play.disabled=false;}
  });
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!page.hidden){event.preventDefault();home();return;}
    if(!page.hidden||!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft'].includes(event.key))return;
    const buttons=[...root.querySelectorAll('.menu-hotspot')];const at=buttons.indexOf(document.activeElement);
    if(at<0)return;event.preventDefault();const delta=['ArrowUp','ArrowLeft'].includes(event.key)?-1:1;
    buttons[(at+delta+buttons.length)%buttons.length].focus();
  });
  root.dataset.ready="true";
  return {
    show({resume=false}={}){root.hidden=false;home();play.setAttribute('aria-label',resume?'Resume match':'Play');say(resume?'Match paused · Play to resume':'');play.focus();},
    hide(){root.hidden=true;},
    status:say
  };
}
