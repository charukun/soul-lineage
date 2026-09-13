const village=window.village;
if(!village)throw new Error('MURAAAAAAA director touch fix requires a booted village');

const style=document.createElement('style');
style.dataset.muraDirectorTouchFix='1';
style.textContent=`
.muraNowActions{position:relative!important;z-index:3!important}
.muraNowActions button{min-height:44px!important}
#muraFollowMayor{position:relative!important;z-index:4!important;min-width:44px!important;min-height:44px!important}
`;
document.head.append(style);

const follow=document.getElementById('muraFollowMayor');
if(follow){
  follow.setAttribute('aria-label','村長を追う');
  follow.setAttribute('title','村長を追う');
}
