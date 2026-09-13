export function nextVillageGoal(world) {
  if (!world || world.tutorialStep?.()) return null;
  if (world.state?.defense?.raid?.phase === 'warning') return '襲来の気配。警備職と守りの届く範囲を確認';

  const population = world.population();
  const freeBeds = Math.max(0, population.openBeds - population.people);
  if (freeBeds < 1) return '次の住人を迎えるため、寝床のある住まいを増やす';
  if (population.safety <= population.people) return '村が広がっています。警備施設か警備職を増やす';
  if (population.food <= population.people) return '食事の余裕が少なめ。畑や食事の場所を整える';

  const resident = world.people.find(person => !person.dead && !person.jobId && !['mayor','guard'].includes(person.role));
  if (resident) return `${resident.name}の仕事先を用意して、村の生産を伸ばす`;
  return '暮らしは安定。住民を眺めながら内装や景観を整える';
}
