// Unknown and Production environments fail closed; the normal game stays untouched.
export function shino25dGuestEnabled(search, environment){
  return ['dev','local'].includes(environment)
    &&new URLSearchParams(search||'').get('character25d')==='shino';
}
