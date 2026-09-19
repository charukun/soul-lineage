// Profile corrections are in the model's unscaled anatomical palm frame.
// Bone rest orientation and palm dimensions are measured, NOT guessed from VRM version.
export const profiles={
 A:{label:'AvatarSample A',palmInset:.004,palmAlong:.55,handSize:1,ankleClearance:.013},
 B:{label:'AvatarSample B',palmInset:.004,palmAlong:.56,handSize:1,ankleClearance:.013},
 C:{label:'AvatarSample C',palmInset:.004,palmAlong:.56,handSize:1,ankleClearance:.013},
 SHINO:{label:'千駄ヶ谷しの',palmInset:.003,palmAlong:.54,handSize:1,ankleClearance:.009},
 TSUKU:{label:'つくよみちゃん',palmInset:.002,palmAlong:.53,handSize:1,ankleClearance:.012}
};
// Geometry-space points. Mesh +Y is the cutting axis (+Z for fists).
export const weaponSockets={
 sword:{grip:[0,-.065,0],left:[0,-.065,0],scale:1,two:false},
 great:{grip:[0,-.085,0],left:[0,-.30,0],scale:1,two:true},
 katana:{grip:[0,-.07,0],left:[0,-.25,0],scale:1,two:true},
 spear:{grip:[0,.35,0],left:[0,.83,0],scale:1,two:true},
 axe:{grip:[0,-.035,0],left:[0,-.24,0],scale:1,two:true},
 fist:{grip:[0,0,.08],left:[0,0,.08],scale:.76,two:false}
};
