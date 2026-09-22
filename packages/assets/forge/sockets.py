def create_sockets(spec):
    sockets={
      'head':{'bone':'head','offset':[0,.16,0]},
      'rightHand':{'bone':'hand.R','offset':[0,0,0]},'leftHand':{'bone':'hand.L','offset':[0,0,0]},
      'weapon':{'bone':'hand.R','offset':[0,0,0]},'secondaryGripTarget':{'bone':'hand.R','offset':[0,0,0]},
      'weaponHitboxAnchor':{'bone':'hand.R','offset':[0,.18,0]},'trailOrigin':{'bone':'hand.R','offset':[0,.7,0]},
      'heldItemAnchor':{'bone':'hand.L','offset':[0,0,0]},'talkAnchor':{'bone':'head','offset':[0,.24,0]}}
    spec['sockets']={'definitions':sockets,'aliases':{
      'Head':'head','LeftHand':'leftHand','RightHand':'rightHand','Weapon':'weapon',
      'handR':'rightHand','handL':'leftHand','offhand':'leftHand','secondaryGrip':'secondaryGripTarget',
      'weaponHitbox':'weaponHitboxAnchor','hitbox':'weaponHitboxAnchor','heldItem':'heldItemAnchor'}}
    return sockets
